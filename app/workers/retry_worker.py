"""
Background Worker for Retrying Failed Parking Detections

This worker processes entries and exits that failed to be recorded
due to network issues, API timeouts, or auth problems.

Can be run as:
1. Standalone script: python -m app.workers.retry_worker
2. Background task in FastAPI (integrated via lifespan)
"""

import asyncio
import logging
from datetime import datetime

from app.cache import redis_cache
from app.supabase_client import get_supabase_admin
from app.routers.parking import (
    ParkingSessionCreate,
    record_entry,
    record_exit,
    get_duration_minutes,
    calculate_charge,
    charge_owners_by_priority,
)

logger = logging.getLogger(__name__)

# Retry configuration
RETRY_INTERVAL_SECONDS = 30  # How often to check for pending items
MAX_RETRIES = 5  # Max retry attempts before moving to dead letter queue
BATCH_SIZE = 10  # Process this many items per cycle


class RetryWorker:
    """Background worker that retries failed parking detections."""

    def __init__(self):
        self.running = False
        self.stats = {
            "entries_processed": 0,
            "exits_processed": 0,
            "entries_failed": 0,
            "exits_failed": 0,
        }

    async def process_pending_entry(self, detection: dict) -> bool:
        """
        Process a single pending entry detection.
        Returns True if successful, False if should be requeued.
        """
        try:
            supabase = get_supabase_admin()
            plate = detection["plate"].upper().strip()
            lot_id = detection["lot_id"]
            confidence = detection.get("confidence")

            # Check if already processed (might have been recorded manually)
            existing = supabase.table("parking_sessions").select("id").eq(
                "lot_id", lot_id
            ).eq("plate", plate).eq("status", "active").is_("exit_time", "null").execute()

            if existing.data:
                logger.info(f"Entry already exists for {plate} at lot {lot_id}, skipping")
                return True

            # Check lot capacity
            lot = supabase.table("parking_lots").select("*").eq("id", lot_id).single().execute()
            if not lot.data:
                logger.error(f"Lot {lot_id} not found")
                return True  # Don't retry - lot doesn't exist

            # Count active sessions
            active_count = supabase.table("parking_sessions").select(
                "id", count="exact"
            ).eq("lot_id", lot_id).eq("status", "active").is_("exit_time", "null").execute()

            if (active_count.count or 0) >= lot.data["capacity"]:
                logger.warning(f"Lot {lot_id} is full, cannot record entry for {plate}")
                return True  # Don't retry - lot is full

            # Try to match with a registered car
            car = supabase.table("cars").select("id, user_id").eq("license_plate", plate).execute()
            car_data = car.data[0] if car.data else None

            # Create parking session with original timestamp
            entry_time = detection.get("timestamp", datetime.utcnow().isoformat())
            session_data = {
                "lot_id": lot_id,
                "plate": plate,
                "car_id": car_data["id"] if car_data else None,
                "user_id": car_data["user_id"] if car_data else None,
                "entry_time": entry_time,
                "entry_confidence": confidence,
                "status": "active"
            }

            result = supabase.table("parking_sessions").insert(session_data).execute()

            if result.data:
                logger.info(f"✓ Retry successful: Entry for {plate} at lot {lot_id}")
                # Invalidate caches
                await redis_cache.invalidate_lot(lot_id)
                if car_data:
                    await redis_cache.invalidate(f"user:{car_data['user_id']}:activity")
                self.stats["entries_processed"] += 1
                return True
            else:
                logger.error(f"Failed to insert entry for {plate}")
                return False

        except Exception as e:
            logger.error(f"Error processing entry for {detection.get('plate')}: {e}")
            return False

    async def process_pending_exit(self, detection: dict) -> bool:
        """
        Process a single pending exit detection.
        Returns True if successful, False if should be requeued.
        """
        try:
            supabase = get_supabase_admin()
            plate = detection["plate"].upper().strip()
            lot_id = detection["lot_id"]
            confidence = detection.get("confidence")

            # Find active session
            session_result = supabase.table("parking_sessions").select("*").eq(
                "lot_id", lot_id
            ).eq("plate", plate).eq("status", "active").is_("exit_time", "null").single().execute()

            if not session_result.data:
                logger.warning(f"No active session found for {plate} at lot {lot_id}")
                return True  # Don't retry - no session to exit

            session = session_result.data

            # Get lot for pricing
            lot = supabase.table("parking_lots").select("name, hourly_rate").eq("id", lot_id).single().execute()

            # Use original detection time or current time
            exit_time = datetime.fromisoformat(detection.get("timestamp", datetime.utcnow().isoformat()).replace('Z', '+00:00'))
            entry_time = datetime.fromisoformat(session["entry_time"].replace('Z', '+00:00'))

            amount = calculate_charge(entry_time, exit_time, lot.data["hourly_rate"])
            duration = get_duration_minutes(entry_time, exit_time)

            # Update session
            update_result = supabase.table("parking_sessions").update({
                "exit_time": exit_time.isoformat(),
                "exit_confidence": confidence,
                "amount_charged": float(amount),
                "duration_minutes": duration,
                "status": "completed"
            }).eq("id", session["id"]).execute()

            if not update_result.data:
                logger.error(f"Failed to update session for {plate}")
                return False

            # Charge owners
            charged_user_id, _, _ = charge_owners_by_priority(
                supabase,
                plate,
                amount,
                session["id"],
                lot.data["name"]
            )

            # Update session with charged user if different
            if charged_user_id and charged_user_id != session.get("user_id"):
                supabase.table("parking_sessions").update({
                    "user_id": charged_user_id
                }).eq("id", session["id"]).execute()

            # Invalidate caches
            await redis_cache.invalidate_lot(lot_id)
            if session.get("user_id"):
                await redis_cache.clear_user_active_session(session["user_id"])
                await redis_cache.invalidate(f"user:{session['user_id']}:activity")
            if charged_user_id and charged_user_id != session.get("user_id"):
                await redis_cache.clear_user_active_session(charged_user_id)
                await redis_cache.invalidate(f"user:{charged_user_id}:activity")

            logger.info(f"✓ Retry successful: Exit for {plate} at lot {lot_id} (${amount:.2f})")
            self.stats["exits_processed"] += 1
            return True

        except Exception as e:
            logger.error(f"Error processing exit for {detection.get('plate')}: {e}")
            return False

    async def process_queue(self):
        """Process pending entries and exits from Redis queues."""
        # Process pending entries
        for _ in range(BATCH_SIZE):
            detection = await redis_cache.get_pending_entry()
            if not detection:
                break

            success = await self.process_pending_entry(detection)
            if not success:
                await redis_cache.requeue_failed_entry(detection, MAX_RETRIES)
                self.stats["entries_failed"] += 1

        # Process pending exits
        for _ in range(BATCH_SIZE):
            detection = await redis_cache.get_pending_exit()
            if not detection:
                break

            success = await self.process_pending_exit(detection)
            if not success:
                await redis_cache.requeue_failed_exit(detection, MAX_RETRIES)
                self.stats["exits_failed"] += 1

    async def run_forever(self):
        """Run the worker continuously."""
        self.running = True
        logger.info("Retry worker started")

        while self.running:
            try:
                await self.process_queue()
            except Exception as e:
                logger.error(f"Error in retry worker: {e}")

            await asyncio.sleep(RETRY_INTERVAL_SECONDS)

        logger.info("Retry worker stopped")

    def stop(self):
        """Stop the worker gracefully."""
        self.running = False

    def get_stats(self) -> dict:
        """Get worker statistics."""
        return {
            **self.stats,
            "running": self.running,
        }


# Global worker instance
retry_worker = RetryWorker()


async def start_retry_worker():
    """Start the retry worker as a background task."""
    await retry_worker.run_forever()


async def stop_retry_worker():
    """Stop the retry worker."""
    retry_worker.stop()


# CLI entrypoint
if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(__file__).rsplit("/app/", 1)[0])

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    async def main():
        # Connect to Redis
        await redis_cache.connect()
        print("Starting retry worker...")
        print(f"Checking every {RETRY_INTERVAL_SECONDS} seconds")
        print("Press Ctrl+C to stop")
        try:
            await retry_worker.run_forever()
        except KeyboardInterrupt:
            retry_worker.stop()
            print("\nWorker stopped")
        finally:
            await redis_cache.disconnect()

    asyncio.run(main())
