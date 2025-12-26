"""
Supabase Client Module for License Plate Recognition System
Provides singleton Supabase client instances for the FastAPI backend.
"""

from supabase import create_client, Client
from functools import lru_cache
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()


class SupabaseClients:
    """Singleton pattern for Supabase client instances."""

    _instance: Optional['SupabaseClients'] = None
    _client: Optional[Client] = None
    _admin_client: Optional[Client] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def url(self) -> str:
        url = os.getenv("SUPABASE_URL")
        if not url:
            raise ValueError("SUPABASE_URL environment variable is not set")
        return url

    @property
    def anon_key(self) -> str:
        key = os.getenv("SUPABASE_ANON_KEY")
        if not key:
            raise ValueError("SUPABASE_ANON_KEY environment variable is not set")
        return key

    @property
    def service_role_key(self) -> str:
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY environment variable is not set")
        return key

    @property
    def client(self) -> Client:
        """Get the anonymous/authenticated client (uses anon key)."""
        if self._client is None:
            self._client = create_client(self.url, self.anon_key)
        return self._client

    @property
    def admin_client(self) -> Client:
        """Get the admin client (uses service role key) - bypasses RLS."""
        if self._admin_client is None:
            self._admin_client = create_client(self.url, self.service_role_key)
        return self._admin_client

    def get_client_with_token(self, access_token: str) -> Client:
        """Get a client authenticated with a specific user's token."""
        client = create_client(self.url, self.anon_key)
        client.auth.set_session(access_token, "")
        return client


@lru_cache()
def get_supabase_clients() -> SupabaseClients:
    """Get the singleton SupabaseClients instance."""
    return SupabaseClients()


# Convenience functions
def get_supabase() -> Client:
    """Get the Supabase client (anon key)."""
    return get_supabase_clients().client


def get_supabase_admin() -> Client:
    """Get the Supabase admin client (service role key) - bypasses RLS."""
    return get_supabase_clients().admin_client


# FastAPI dependency
def supabase_client() -> Client:
    """FastAPI dependency for Supabase client."""
    return get_supabase()


def supabase_admin_client() -> Client:
    """FastAPI dependency for Supabase admin client."""
    return get_supabase_admin()
