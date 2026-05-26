"""
email_sender.py
---------------
Gmail SMTP üzerinden düz metin mail gönderir.
Standart kütüphane (smtplib) kullanır, ek paket gerekmez.

Gerekli env variable'lar:
  GMAIL_USER         — Gmail adresi (örn. sen@gmail.com)
  GMAIL_APP_PASSWORD — Gmail App Password (16 karakter)
"""

import os
import smtplib
from email.mime.text import MIMEText
from datetime import datetime


SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def build_subject(city: str, mode: str, language: str = "tr") -> str:
    """Mail konu satırını oluşturur. Tarih + saat eklenerek her mail benzersiz olur (threading önlenir)."""
    now = datetime.now()
    date_str = now.strftime("%d %B %Y")
    if language == "tr":
        if mode == "morning":
            return f"☀️ {city} — {date_str} Sabah"
        else:
            return f"🌤️ {city} — {date_str} Öğlen"
    else:
        if mode == "morning":
            return f"☀️ {city} — {date_str} Morning"
        else:
            return f"🌤️ {city} — {date_str} Afternoon"


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    recipient_name: str = "",
    city: str = "",
    mode: str = "morning",
) -> None:
    """
    Gmail SMTP üzerinden düz metin mail gönderir.

    Args:
        to_email: Alıcı mail adresi
        subject: Mail konusu
        html_body: Gemini'den gelen metin içerik (plain text)
        recipient_name: Kullanılmıyor, geriye dönük uyumluluk için
        city: Kullanılmıyor, geriye dönük uyumluluk için
        mode: Kullanılmıyor, geriye dönük uyumluluk için

    Raises:
        EnvironmentError: Gerekli env variable'lar eksikse
        smtplib.SMTPException: Mail gönderilemezse
    """
    gmail_user = os.environ.get("GMAIL_USER")
    gmail_password = os.environ.get("GMAIL_APP_PASSWORD")

    if not gmail_user:
        raise EnvironmentError("GMAIL_USER environment variable bulunamadı.")
    if not gmail_password:
        raise EnvironmentError("GMAIL_APP_PASSWORD environment variable bulunamadı.")

    msg = MIMEText(html_body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = gmail_user
    msg["To"] = to_email

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(gmail_user, gmail_password)
        server.sendmail(gmail_user, to_email, msg.as_string())
