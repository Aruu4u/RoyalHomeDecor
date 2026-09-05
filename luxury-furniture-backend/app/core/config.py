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
