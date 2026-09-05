import os
from functools import lru_cache
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "Luxury Furniture API"
    app_env: Literal["local", "testing", "staging", "production"] = "local"
    app_debug: bool = False

    api_v1_prefix: str = "/api/v1"
    frontend_url: str = "http://localhost:3000"

    database_url: str = Field(
        ...,
        description="Asynchronous PostgreSQL connection string",
    )
    supabase_anon_key: str
    supabase_url: str
    database_echo: bool = False

    # Switches the engine between a pooled connection (one long-lived
    # server) and no client-side pooling (serverless, where every instance
    # is its own process and a pool per instance exhausts the database's
    # connection limit).
    #
    # Defaults from Vercel's own VERCEL environment variable rather than
    # needing to be remembered, because forgetting it produces an
    # intermittent failure under load rather than an obvious one at boot.
    # Setting DB_SERVERLESS explicitly always wins.
    db_serverless: bool = Field(
        default_factory=lambda: os.getenv("VERCEL") == "1",
        description=(
            "Disable client-side connection pooling. Required on "
            "serverless platforms, and must be paired with a "
            "transaction-mode connection pooler."
        ),
    )

    razorpay_key_id: str
    razorpay_key_secret: str
    razorpay_webhook_secret: str
    razorpay_api_url: str = "https://api.razorpay.com/v1"
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:4173"

    @property
    def cors_origin_list(self) -> list[str]:
        """Return configured CORS origins as a clean list."""

        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache  # Without caching, a new settings object could be created repeatedly. This creates it once and reuses it.
def get_settings() -> Settings:
    """Create the settings object once and reuse it."""

    return Settings()  # provides one central place for configuration.
