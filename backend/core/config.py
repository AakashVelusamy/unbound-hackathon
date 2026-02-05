"""Environment variables and application configuration. No secrets in defaults."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    # Supabase / PostgreSQL (set in .env). Run db/schema.sql in Supabase SQL Editor.
    database_url: str = ""

    # Unbound API — load from env
    unbound_api_url: str = "https://api.getunbound.ai/v1/chat/completions"
    unbound_api_key: str = ""

    # Server (for run from main.py)
    host: str = "0.0.0.0"
    port: int = 8000

    # Email alerts: send mail when workflow completes/fails/paused (optional)
    alert_email_to: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
