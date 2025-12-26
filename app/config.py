from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Legacy database config (kept for backwards compatibility during migration)
    database_url: Optional[str] = None
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Supabase configuration
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: Optional[str] = None  # For custom JWT verification

    # Redis configuration (required for caching)
    redis_url: str = "redis://localhost:6379"
    cache_ttl_seconds: int = 300
    duplicate_detection_ttl: int = 5  # seconds to prevent duplicate plate entries

    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore extra fields in .env


settings = Settings()