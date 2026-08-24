from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    web3forms_access_key: str | None = None
    stripe_secret_key: str | None = None
    stripe_payment_method_configuration_id: str | None = None
    stripe_webhook_secret: str | None = None
    orders_database_path: Path = Path(__file__).resolve().parents[1] / "data" / "orders.db"
    reviews_database_path: Path = Path(__file__).resolve().parents[1] / "data" / "reviews.db"
    checkout_success_url: str = "http://localhost:5173/checkout/success?session_id={CHECKOUT_SESSION_ID}"
    checkout_cancel_url: str = "http://localhost:5173/checkout"
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173"
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
