"""
Live Webcam License Plate Recognition System
This script captures license plates from a webcam in real-time and stores
the results in JSON files (one per session).

Integrates with the parking management API to record entry/exit events.
"""
import json
import os
import argparse
import asyncio
from datetime import datetime
from pathlib import Path
from time import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
import redis as redis_sync  # Sync Redis client for queueing failed detections
from app.routers import auth, plate, user, car, parking_lot, parking, admin
from app.cache import redis_cache
from app.config import settings
from app.workers.retry_worker import retry_worker, start_retry_worker
import cv2
import logging
import warnings

# Suppress verbose logging from ALPR/ONNX libraries BEFORE importing them
warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.ERROR)
for logger_name in [
    "onnxruntime",
    "open_image_models",
    "open_image_models.detection",
    "open_image_models.detection.core",
    "open_image_models.detection.core.yolo_v9",
    "open_image_models.detection.core.yolo_v9.inference",
    "open_image_models.detection.pipeline",
    "fast_plate_ocr",
    "fast_plate_ocr.inference",
    "fast_alpr",
    "urllib3",
    "urllib3.connectionpool",
    "root",
]:
    logging.getLogger(logger_name).setLevel(logging.ERROR)
    logging.getLogger(logger_name).disabled = True

from fast_alpr import ALPR

# Note: Database tables are now managed by Supabase (no SQLAlchemy migration needed)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup: Connect to Redis (required)
    print("Connecting to Redis...")
    try:
        await redis_cache.connect()
        print("Redis connection established")
    except Exception as e:
        print(f"FATAL: Could not connect to Redis: {e}")
        raise RuntimeError("Redis connection required. Please ensure Redis is running.")

    # Start the retry worker as a background task
    print("Starting retry worker...")
    worker_task = asyncio.create_task(start_retry_worker())

    yield

    # Shutdown: Stop retry worker and disconnect from Redis
    print("Stopping retry worker...")
    retry_worker.stop()
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

    print("Disconnecting from Redis...")
    await redis_cache.disconnect()
    print("Redis disconnected")


app = FastAPI(
    title="License Plate Recognition System",
    description="Multi-lot parking management with ALPR",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware - allow requests from React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication & User routes
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(car.router)

# Plate detection routes
app.include_router(plate.router)

# Parking management routes
app.include_router(parking_lot.router)
app.include_router(parking.router)
app.include_router(admin.router)


# ============== Health Check Endpoints ==============

@app.get("/health", tags=["Health"])
async def health_check():
    """Basic health check endpoint for Docker/Kubernetes."""
    return {"status": "healthy", "service": "lpr-api"}


@app.get("/health/ready", tags=["Health"])
async def readiness_check():
    """
    Readiness check - validates all dependencies are available.
    Used by Docker Compose and orchestrators to determine if the service is ready.
    """
    checks = {
        "api": "healthy",
        "redis": "unknown",
        "supabase": "unknown"
    }

    # Check Redis
    try:
        await redis_cache.ping()
        checks["redis"] = "healthy"
    except Exception as e:
        checks["redis"] = f"unhealthy: {str(e)}"

    # Check Supabase (basic connectivity)
    try:
        from app.supabase_client import get_supabase_admin
        supabase = get_supabase_admin()
        # Simple query to verify connection
        supabase.table("parking_lots").select("id").limit(1).execute()
        checks["supabase"] = "healthy"
    except Exception as e:
        checks["supabase"] = f"unhealthy: {str(e)}"

    all_healthy = all(v == "healthy" for v in checks.values())

    return {
        "status": "ready" if all_healthy else "degraded",
        "checks": checks,
        "timestamp": datetime.now().isoformat()
    }


class WebcamALPR:
    """Webcam-based ALPR system with parking management integration."""

    def __init__(
        self,
        detector_model="yolo-v9-t-384-license-plate-end2end",
        ocr_model="cct-xs-v1-global-model",
        output_dir="alpr_sessions",
        min_confidence=0.7,
        duplicate_threshold=5.0,
        api_base_url="http://127.0.0.1:8000",
        lot_id=1,
        mode="auto",
        admin_email=None,
        admin_password=None,
    ):
        """
        Initialize the webcam ALPR system.

        Args:
            detector_model: Name of the detection model
            ocr_model: Name of the OCR model
            output_dir: Directory to store session JSON files
            min_confidence: Minimum confidence threshold for plate detection
            duplicate_threshold: Seconds to wait before recording same plate again
            api_base_url: Base URL of the parking management API
            lot_id: The parking lot ID this camera monitors
            mode: Camera mode - 'entry', 'exit', or 'auto' (auto-detect based on active sessions)
            admin_email: Admin email for API authentication
            admin_password: Admin password for API authentication
        """
        print("Initializing ALPR system...")
        self.alpr = ALPR(detector_model=detector_model, ocr_model=ocr_model)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.min_confidence = min_confidence
        self.duplicate_threshold = duplicate_threshold
        self.api_base_url = api_base_url
        self.lot_id = lot_id
        self.mode = mode
        self.auth_token = None

        # Initialize sync Redis client for queueing failed detections
        try:
            self.redis_client = redis_sync.from_url(settings.redis_url, decode_responses=True)
            self.redis_client.ping()
            print("✓ Redis connected for reliability queue")
        except Exception as e:
            print(f"⚠ Redis unavailable: {e} (failed detections won't be queued)")
            self.redis_client = None

        # Authenticate with the API
        if admin_email and admin_password:
            self._authenticate(admin_email, admin_password)
        else:
            print("WARNING: No admin credentials provided. API calls will fail.")
            print("Use --email and --password arguments to authenticate.")

        # Create session file
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.session_file = self.output_dir / f"session_{self.session_id}.json"

        # Session data
        self.detected_plates = []
        self.last_seen = {}  # Track last time each plate was seen
        self.active_plates = set()  # Track plates currently in the lot

        # Load active sessions from API
        self._load_active_sessions()

        print(f"Session file: {self.session_file}")
        print(f"Monitoring lot ID: {self.lot_id}")
        print(f"Mode: {self.mode}")

    def _authenticate(self, email, password):
        """Authenticate with the API and get access token."""
        try:
            response = requests.post(
                f"{self.api_base_url}/auth/login",
                json={"email": email, "password": password},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("access_token")
                print(f"✓ Authenticated as {email}")
            else:
                print(f"✗ Authentication failed: {response.text}")
        except Exception as e:
            print(f"✗ Authentication error: {e}")

    def _get_auth_headers(self):
        """Get authorization headers for API requests."""
        if self.auth_token:
            return {"Authorization": f"Bearer {self.auth_token}"}
        return {}

    def _load_active_sessions(self):
        """Load currently active parking sessions from the API."""
        if not self.auth_token:
            return
        try:
            response = requests.get(
                f"{self.api_base_url}/lots/{self.lot_id}/active",
                headers=self._get_auth_headers(),
                timeout=10
            )
            if response.status_code == 200:
                sessions = response.json()
                self.active_plates = {s["plate"].upper() for s in sessions}
                print(f"✓ Loaded {len(self.active_plates)} active sessions")
            else:
                print(f"✗ Could not load active sessions: {response.status_code}")
        except Exception as e:
            print(f"✗ Error loading active sessions: {e}")

    def is_duplicate(self, plate_text):
        """
        Check if this plate was recently detected.

        Args:
            plate_text: The plate text to check

        Returns:
            True if this is a duplicate within the threshold time
        """
        current_time = time()
        if plate_text in self.last_seen:
            time_diff = current_time - self.last_seen[plate_text]
            if time_diff < self.duplicate_threshold:
                return True
        return False

    def save_detection(self, plate_text, confidence, detection_confidence):
        """
        Save a plate detection and record entry/exit via API.

        Args:
            plate_text: The detected plate text
            confidence: OCR confidence score
            detection_confidence: Detection confidence score
        """
        # Update last seen time
        self.last_seen[plate_text] = time()
        plate_upper = plate_text.upper()

        # Determine if this is an entry or exit
        is_entry = self._determine_entry_or_exit(plate_upper)
        action = "entry" if is_entry else "exit"

        # Create detection record
        detection = {
            "timestamp": datetime.now().isoformat(),
            "plate": plate_text,
            "ocr_confidence": round(confidence, 4),
            "detection_confidence": round(detection_confidence, 4),
            "action": action,
            "lot_id": self.lot_id,
        }

        self.detected_plates.append(detection)

        # Save to local JSON file (backup)
        with open(self.session_file, "w") as f:
            json.dump(
                {
                    "session_id": self.session_id,
                    "session_start": self.detected_plates[0]["timestamp"],
                    "total_detections": len(self.detected_plates),
                    "lot_id": self.lot_id,
                    "detections": self.detected_plates,
                },
                f,
                indent=2,
            )

        # Send to Parking Management API
        if self.auth_token:
            self._record_parking_event(plate_upper, confidence, is_entry)
        else:
            print(f"⚠ Skipping API (not authenticated): {plate_text}")

        print(f"✓ {action.upper()}: {plate_text} (OCR: {confidence:.2%}, Det: {detection_confidence:.2%})")

    def _determine_entry_or_exit(self, plate_text):
        """
        Determine if the detected plate is entering or exiting.

        Args:
            plate_text: The plate text (uppercase)

        Returns:
            True if entry, False if exit
        """
        if self.mode == "entry":
            return True
        elif self.mode == "exit":
            return False
        else:  # auto mode
            # If plate has an active session, this is an exit
            # Otherwise, this is an entry
            return plate_text not in self.active_plates

    def _queue_failed_detection(self, plate_text, confidence, is_entry, error_reason):
        """Queue a failed detection to Redis for retry by background worker."""
        if not self.redis_client:
            print(f"  → Cannot queue (Redis unavailable)")
            return False

        detection = {
            "plate": plate_text,
            "confidence": confidence,
            "lot_id": self.lot_id,
            "timestamp": datetime.utcnow().isoformat(),
            "error_reason": error_reason,
        }

        try:
            queue_key = "queue:pending_entries" if is_entry else "queue:pending_exits"
            detection["queued_at"] = datetime.utcnow().isoformat()
            detection["retry_count"] = 0
            self.redis_client.lpush(queue_key, json.dumps(detection))
            print(f"  → Queued for retry")
            return True
        except Exception as e:
            print(f"  → Failed to queue: {e}")
            return False

    def _record_parking_event(self, plate_text, confidence, is_entry):
        """
        Record entry or exit via the parking management API.
        Failed detections are queued to Redis for retry.

        Args:
            plate_text: The plate text
            confidence: OCR confidence score
            is_entry: True for entry, False for exit
        """
        try:
            if is_entry:
                # Record entry
                response = requests.post(
                    f"{self.api_base_url}/parking/{self.lot_id}/entry",
                    headers={
                        **self._get_auth_headers(),
                        "Content-Type": "application/json"
                    },
                    json={
                        "plate": plate_text,
                        "entry_confidence": confidence,
                    },
                    timeout=10
                )
                if response.status_code == 201:
                    self.active_plates.add(plate_text)
                    print(f"✓ API Entry recorded: {plate_text}")
                elif response.status_code == 400:
                    error = response.json().get("detail", "Unknown error")
                    print(f"⚠ Entry rejected: {error}")
                    # Don't queue 400 errors - they're intentional rejections (duplicates, lot full, etc.)
                elif response.status_code == 401:
                    print(f"✗ Entry failed (auth expired): {response.text}")
                    self._queue_failed_detection(plate_text, confidence, True, "auth_expired")
                else:
                    print(f"✗ Entry failed ({response.status_code}): {response.text}")
                    self._queue_failed_detection(plate_text, confidence, True, f"http_{response.status_code}")
            else:
                # Record exit
                response = requests.post(
                    f"{self.api_base_url}/parking/{self.lot_id}/exit",
                    headers=self._get_auth_headers(),
                    params={
                        "plate": plate_text,
                        "exit_confidence": confidence,
                    },
                    timeout=10
                )
                if response.status_code == 200:
                    self.active_plates.discard(plate_text)
                    data = response.json()
                    amount = data.get("amount_charged", 0)
                    print(f"✓ API Exit recorded: {plate_text} (charged: ${amount:.2f})")
                elif response.status_code == 404:
                    print(f"⚠ Exit rejected: No active session for {plate_text}")
                    # Maybe this is actually an entry - add to active plates
                    if self.mode == "auto":
                        print(f"  → Treating as entry instead")
                        self._record_parking_event(plate_text, confidence, is_entry=True)
                elif response.status_code == 401:
                    print(f"✗ Exit failed (auth expired): {response.text}")
                    self._queue_failed_detection(plate_text, confidence, False, "auth_expired")
                else:
                    print(f"✗ Exit failed ({response.status_code}): {response.text}")
                    self._queue_failed_detection(plate_text, confidence, False, f"http_{response.status_code}")
        except requests.exceptions.Timeout:
            print(f"✗ API timeout")
            self._queue_failed_detection(plate_text, confidence, is_entry, "timeout")
        except requests.exceptions.ConnectionError:
            print(f"✗ API connection error")
            self._queue_failed_detection(plate_text, confidence, is_entry, "connection_error")
        except Exception as e:
            print(f"✗ API error: {e}")
            self._queue_failed_detection(plate_text, confidence, is_entry, str(e))


    def run(self, camera_index=0):
        """
        Run the webcam ALPR system.

        Args:
            camera_index: Index of the camera to use (default: 0)
        """
        # Open webcam
        cap = cv2.VideoCapture(camera_index)

        if not cap.isOpened():
            print("Error: Could not open webcam.")
            return

        # Camera warmup - discard first few frames to let camera stabilize
        print("Warming up camera...")
        for _ in range(30):  # Read 30 frames to warm up
            ret, _ = cap.read()
            if not ret:
                import time
                time.sleep(0.1)  # Small delay if frame not ready
        print("Camera ready.")

        # Get camera properties
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(cap.get(cv2.CAP_PROP_FPS))

        print(f"\nWebcam opened: {width}x{height} @ {fps}fps")
        print("=" * 60)
        print("INSTRUCTIONS:")
        print("- Show license plates to the camera")
        print("- Press 'q' to quit and end session")
        print("- Press 's' to take a screenshot")
        print("=" * 60)

        frame_count = 0
        process_every_n_frames = 10  # Process every 5th frame for performance

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    print("Error: Could not read frame from webcam.")
                    break

                frame_count += 1
                display_frame = frame.copy()

                # Process frame for plate detection
                if frame_count % process_every_n_frames == 0:
                    try:
                        results = self.alpr.predict(frame)

                        for result in results:
                            detection_conf = result.detection.confidence
                            ocr_result = result.ocr

                            if ocr_result and detection_conf >= self.min_confidence:
                                plate_text = ocr_result.text
                                ocr_conf = ocr_result.confidence

                                # Check if this is a duplicate
                                if not self.is_duplicate(plate_text):
                                    self.save_detection(plate_text, ocr_conf, detection_conf)

                    except Exception as e:
                        print(f"Error during detection: {e}")

                # Draw predictions on display frame
                try:
                    display_frame = self.alpr.draw_predictions(display_frame)
                except:
                    pass

                # Add session info overlay
                cv2.putText(
                    display_frame,
                    f"Session: {self.session_id}",
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2,
                )
                cv2.putText(
                    display_frame,
                    f"Detections: {len(self.detected_plates)}",
                    (10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2,
                )
                cv2.putText(
                    display_frame,
                    "Press 'q' to quit | 's' to screenshot",
                    (10, height - 20),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 255, 255),
                    1,
                )

                # Display the frame
                cv2.imshow("FastALPR - Live Webcam", display_frame)

                # Handle keyboard input
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    print("\nQuitting session...")
                    break
                elif key == ord("s"):
                    screenshot_path = self.output_dir / f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                    cv2.imwrite(str(screenshot_path), display_frame)
                    print(f"Screenshot saved: {screenshot_path}")

        finally:
            # Cleanup
            cap.release()
            cv2.destroyAllWindows()

            # Print session summary
            print("\n" + "=" * 60)
            print("SESSION SUMMARY")
            print("=" * 60)
            print(f"Session ID: {self.session_id}")
            print(f"Total detections: {len(self.detected_plates)}")
            print(f"Session file: {self.session_file}")

            if self.detected_plates:
                print("\nDetected plates:")
                unique_plates = {}
                for detection in self.detected_plates:
                    plate = detection["plate"]
                    if plate not in unique_plates:
                        unique_plates[plate] = 0
                    unique_plates[plate] += 1

                for plate, count in unique_plates.items():
                    print(f"  - {plate}: {count} time(s)")

            print("=" * 60)


def main():
    """Main entry point with CLI argument parsing."""
    parser = argparse.ArgumentParser(
        description="FastALPR - Live Webcam License Plate Recognition with Parking Management",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run with authentication (recommended)
  python -m app.webcam_alpr --email admin@example.com --password secret --lot-id 1

  # Run in entry-only mode (camera at entrance)
  python -m app.webcam_alpr --email admin@example.com --password secret --lot-id 1 --mode entry

  # Run in exit-only mode (camera at exit)
  python -m app.webcam_alpr --email admin@example.com --password secret --lot-id 1 --mode exit

  # Run without API integration (JSON backup only)
  python -m app.webcam_alpr --lot-id 1

Modes:
  auto   - Automatically detect entry/exit based on active sessions (default)
  entry  - All detections are treated as entries
  exit   - All detections are treated as exits
        """
    )

    parser.add_argument(
        "--email", "-e",
        help="Admin email for API authentication",
        default=os.environ.get("ALPR_ADMIN_EMAIL")
    )
    parser.add_argument(
        "--password", "-p",
        help="Admin password for API authentication",
        default=os.environ.get("ALPR_ADMIN_PASSWORD")
    )
    parser.add_argument(
        "--lot-id", "-l",
        type=int,
        default=1,
        help="Parking lot ID to monitor (default: 1)"
    )
    parser.add_argument(
        "--mode", "-m",
        choices=["auto", "entry", "exit"],
        default="auto",
        help="Camera mode: auto, entry, or exit (default: auto)"
    )
    parser.add_argument(
        "--camera", "-c",
        type=int,
        default=0,
        help="Camera index to use (default: 0)"
    )
    parser.add_argument(
        "--api-url", "-u",
        default=os.environ.get("API_BASE_URL", "http://127.0.0.1:8000"),
        help="Base URL of the parking API (default: http://127.0.0.1:8000)"
    )
    parser.add_argument(
        "--confidence", "-C",
        type=float,
        default=0.7,
        help="Minimum detection confidence threshold (default: 0.7)"
    )
    parser.add_argument(
        "--duplicate-threshold", "-d",
        type=float,
        default=5.0,
        help="Seconds to wait before recording same plate again (default: 5.0)"
    )
    parser.add_argument(
        "--output-dir", "-o",
        default="alpr_sessions",
        help="Directory to store session JSON files (default: alpr_sessions)"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("FastALPR - Live Webcam License Plate Recognition")
    print("with Parking Management Integration")
    print("=" * 60)

    # Initialize and run webcam ALPR
    webcam_alpr = WebcamALPR(
        detector_model="yolo-v9-t-384-license-plate-end2end",
        ocr_model="cct-xs-v1-global-model",
        output_dir=args.output_dir,
        min_confidence=args.confidence,
        duplicate_threshold=args.duplicate_threshold,
        api_base_url=args.api_url,
        lot_id=args.lot_id,
        mode=args.mode,
        admin_email=args.email,
        admin_password=args.password,
    )

    webcam_alpr.run(camera_index=args.camera)


if __name__ == "__main__":
    main()
