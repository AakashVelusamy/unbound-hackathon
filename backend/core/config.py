"""Environment variables and application configuration."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    # Database
    database_url: str = "sqlite:///./workflow.db"

    # Unbound API (Phase 2)
    unbound_api_url: str = "https://api.getunbound.ai/v1/chat/completions"
    unbound_api_key: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
