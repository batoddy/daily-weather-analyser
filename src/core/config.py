"""
config.py
---------
Uygulama genelinde kullanılan environment variable'ları tek yerden okur.
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL") or "gemini-3.1-flash-lite"

    GMAIL_USER: str = os.environ.get("GMAIL_USER", "")
    GMAIL_APP_PASSWORD: str = os.environ.get("GMAIL_APP_PASSWORD", "")

    RECIPIENTS_JSON: str = os.environ.get("RECIPIENTS", "[]")
