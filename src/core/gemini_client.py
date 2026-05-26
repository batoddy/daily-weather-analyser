"""
gemini_client.py
----------------
Minimal Gemini client using the Google Gen AI SDK.
"""

from google import genai
from google.genai import types

from core.config import Config


class GeminiClient:
    """
    Minimal Gemini client using the Google Gen AI SDK.
    """

    def __init__(self):
        if not Config.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is missing. Please check your .env file.")

        self.client = genai.Client(api_key=Config.GEMINI_API_KEY)
        self.model_name = Config.GEMINI_MODEL

    def generate(self, prompt: str) -> str:
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0),
        )

        if not response or not response.text:
            raise RuntimeError("Gemini returned an empty response.")

        return response.text.strip()
