"""
Legacy database module - kept for backwards compatibility.
The application now uses Supabase for all database operations.
"""

from sqlalchemy.orm import declarative_base

# Base is still needed for model definitions (used by some imports)
Base = declarative_base()

# Legacy SQLAlchemy components are no longer used
# All database operations now go through app/supabase_client.py
engine = None
SessionLocal = None

def get_db():
    """
    Legacy database dependency - no longer used.
    All routes now use Supabase client directly.
    """
    raise NotImplementedError(
        "SQLAlchemy database is no longer used. "
        "Use Supabase client from app.supabase_client instead."
    )
