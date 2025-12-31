from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pathlib import Path


# Get the project root directory (parent of app/)
PROJECT_ROOT = Path(__file__).parent.parent
ENV_FILE = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    # Legacy database config (kept for backwards compatibility during migration)
    database_url: Optional[str] = None
    secret_key: str = "default-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Supabase configuration - uses SUPABASE_URL, SUPABASE_ANON_KEY, etc. from .env
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: Optional[str] = None  # For custom JWT verification

    # Redis configuration (required for caching)
    redis_url: str = "redis://localhost:6379"
    cache_ttl_seconds: int = 300
    duplicate_detection_ttl: int = 5  # seconds to prevent duplicate plate entries

    model_config = SettingsConfigDict(
        # Load .env file if it exists (dev), otherwise rely on env vars (Docker/prod)
        env_file=str(ENV_FILE) if ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,  # SUPABASE_URL matches supabase_url
    )


# Initialize settings - will raise error if required env vars are missing
try:
    settings = Settings()
except Exception as e:
    print("=" * 60)
    print("ERROR: Failed to load configuration!")
    print("=" * 60)
    if ENV_FILE.exists():
        print(f"Tried loading from: {ENV_FILE}")
    else:
        print("No .env file found - expecting environment variables")
    print("\nRequired environment variables:")
    print("  - SUPABASE_URL")
    print("  - SUPABASE_ANON_KEY")
    print("  - SUPABASE_SERVICE_ROLE_KEY")
    print(f"\nError: {e}")
    print("=" * 60)
    raise