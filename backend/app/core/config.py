# app/core/config.py

from pydantic_settings import BaseSettings
from functools import lru_cache
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int

    STORAGE_BACKEND: str
    UPLOAD_DIR: str

    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_BUCKET_NAME: str
    AWS_REGION: str

    TESSERACT_CMD: str
    SMTP_HOST: str
    SMTP_PORT: int
    SMTP_USER: str
    SMTP_PASSWORD: str
    EMAIL_FROM: str

    API_KEY: str

    # Old Meta fields can stay. They will not break anything.
    WHATSAPP_API_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: str = "letzstudy_verify_token_2024"
    WHATSAPP_APP_SECRET: str = ""
    WHATSAPP_API_VERSION: str = "v1"

    # Gateway API from team lead
    WHATSAPP_GATEWAY_BASE: str = "http://127.0.0.1:8000/api/v1"
    WHATSAPP_WEBHOOK_KEY: str = ""

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
genai.configure(api_key=settings.API_KEY)