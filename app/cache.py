import redis.asyncio as redis
import json
from typing import Optional, Any
from datetime import datetime
from app.config import settings


class RedisCache:
    """Redis cache manager for parking lot system."""

    def __init__(self, url: str = None):
        self.url = url or settings.redis_url
        self.client: Optional[redis.Redis] = None

    async def connect(self):
        """Establish Redis connection."""
        self.client = redis.from_url(self.url, decode_responses=True)
        await self.ping()

    async def disconnect(self):
        """Close Redis connection."""
        if self.client:
            await self.client.close()

    async def ping(self) -> bool:
        """Test Redis connection - raises exception if unavailable."""
        if not self.client:
            raise ConnectionError("Redis client not initialized")
        return await self.client.ping()

    # ============== Lot Status Cache ==============

    async def get_lot_status(self, lot_id: int) -> Optional[dict]:
        """Get cached lot status."""
        key = f"lot:{lot_id}:status"
        data = await self.client.get(key)
        return json.loads(data) if data else None

    async def set_lot_status(self, lot_id: int, status: dict, ttl: int = 30):
        """Cache lot status with TTL."""
        key = f"lot:{lot_id}:status"
        await self.client.setex(key, ttl, json.dumps(status, default=str))

    async def invalidate_lot_status(self, lot_id: int):
        """Invalidate lot status cache."""
        key = f"lot:{lot_id}:status"
        await self.client.delete(key)

    # ============== Active Sessions Cache ==============

    async def get_active_sessions(self, lot_id: int) -> Optional[list]:
        """Get cached active sessions for a lot."""
        key = f"lot:{lot_id}:active_sessions"
        data = await self.client.get(key)
        return json.loads(data) if data else None

    async def set_active_sessions(self, lot_id: int, sessions: list, ttl: int = 60):
        """Cache active sessions for a lot."""
        key = f"lot:{lot_id}:active_sessions"
        await self.client.setex(key, ttl, json.dumps(sessions, default=str))

    async def invalidate_active_sessions(self, lot_id: int):
        """Invalidate active sessions cache."""
        key = f"lot:{lot_id}:active_sessions"
        await self.client.delete(key)

    # ============== Duplicate Detection Cache ==============

    async def check_duplicate_entry(self, plate: str, lot_id: int) -> bool:
        """Check if plate was recently seen at this lot (prevents duplicate entries)."""
        key = f"plate:{plate.upper()}:last_seen:{lot_id}"
        return await self.client.exists(key) > 0

    async def mark_plate_seen(self, plate: str, lot_id: int, ttl: int = None):
        """Mark plate as seen at lot to prevent duplicate entries."""
        ttl = ttl or settings.duplicate_detection_ttl
        key = f"plate:{plate.upper()}:last_seen:{lot_id}"
        await self.client.setex(key, ttl, datetime.utcnow().isoformat())

    async def clear_plate_seen(self, plate: str, lot_id: int):
        """Clear plate seen marker (on exit)."""
        key = f"plate:{plate.upper()}:last_seen:{lot_id}"
        await self.client.delete(key)

    # ============== User Active Session Cache ==============

    async def get_user_active_session(self, user_id: int) -> Optional[dict]:
        """Get user's currently active parking session."""
        key = f"user:{user_id}:active_session"
        data = await self.client.get(key)
        return json.loads(data) if data else None

    async def set_user_active_session(self, user_id: int, session: dict, ttl: int = 3600):
        """Cache user's active session."""
        key = f"user:{user_id}:active_session"
        await self.client.setex(key, ttl, json.dumps(session, default=str))

    async def clear_user_active_session(self, user_id: int):
        """Clear user's active session cache (on checkout)."""
        key = f"user:{user_id}:active_session"
        await self.client.delete(key)

    # ============== Generic API Cache ==============

    async def get_cached(self, key: str) -> Optional[Any]:
        """Get generic cached value."""
        data = await self.client.get(key)
        return json.loads(data) if data else None

    async def set_cached(self, key: str, value: Any, ttl: int = None):
        """Set generic cached value."""
        ttl = ttl or settings.cache_ttl_seconds
        await self.client.setex(key, ttl, json.dumps(value, default=str))

    async def invalidate(self, key: str):
        """Delete a cache key."""
        await self.client.delete(key)

    async def invalidate_pattern(self, pattern: str):
        """Delete all keys matching pattern."""
        keys = await self.client.keys(pattern)
        if keys:
            await self.client.delete(*keys)

    # ============== Lot Invalidation Helper ==============

    async def invalidate_lot(self, lot_id: int):
        """Invalidate all caches related to a lot."""
        await self.invalidate_lot_status(lot_id)
        await self.invalidate_active_sessions(lot_id)


# Global cache instance
redis_cache = RedisCache()
