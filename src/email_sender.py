"""
email_sender.py
---------------
Gmail SMTP üzerinden HTML mail gönderir.
Standart kütüphane (smtplib) kullanır, ek paket gerekmez.

Gerekli env variable'lar:
  GMAIL_USER         — Gmail adresi (örn. sen@gmail.com)
  GMAIL_APP_PASSWORD — Gmail App Password (16 karakter, boşluksuz)
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime


SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def _wrap_html(content: str, recipient_name: str, city: str, mode: str) -> str:
    """
    Gemini'den gelen ham HTML içeriğini tam bir mail şablonuna sarar.
    """
    today = datetime.now().strftime("%d %B %Y")
    mode_label = "Sabah Raporu" if mode == "morning" else "Öğlen Güncellemesi"

    return f"""<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hava Durumu — {city}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f0f4f8;
      margin: 0;
      padding: 20px;
      color: #2d3748;
    }}
    .container {{
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.07);
    }}
    .header {{
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px 28px;
    }}
    .header h1 {{
      margin: 0;
      font-size: 22px;
      font-weight: 700;
    }}
    .header p {{
      margin: 6px 0 0;
      opacity: 0.85;
      font-size: 14px;
    }}
    .content {{
      padding: 24px 28px;
      line-height: 1.7;
      font-size: 15px;
    }}
    .footer {{
      background: #f7fafc;
      padding: 16px 28px;
      font-size: 12px;
      color: #a0aec0;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌤️ {city} — {mode_label}</h1>
      <p>{today}</p>
    </div>
    <div class="content">
      {content}
    </div>
    <div class="footer">
      Bu mail otomatik olarak oluşturulmuştur • Open-Meteo + Gemini AI
    </div>
  </div>
</body>
</html>"""


def build_subject(city: str, mode: str, language: str = "tr") -> str:
    """Mail konu satırını oluşturur."""
    today = datetime.now().strftime("%d %B")
    if language == "tr":
        if mode == "morning":
            return f"☀️ {city} Sabah Hava Raporu — {today}"
        else:
            return f"🌤️ {city} Öğlen Güncellemesi — {today}"
    else:
        if mode == "morning":
            return f"☀️ {city} Morning Weather Report — {today}"
        else:
            return f"🌤️ {city} Afternoon Update — {today}"


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    recipient_name: str = "",
    city: str = "",
    mode: str = "morning",
) -> None:
    """
    Gmail SMTP üzerinden HTML mail gönderir.

    Args:
        to_email: Alıcı mail adresi
        subject: Mail konusu
        html_body: Gemini'den gelen HTML içerik (body content)
        recipient_name: Alıcı adı (şablon için)
        city: Şehir adı (şablon için)
        mode: "morning" veya "noon"

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

    # Tam HTML şablona sar
    full_html = _wrap_html(html_body, recipient_name, city, mode)

    # MIME mesajı oluştur
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Hava Durumu Asistanı <{gmail_user}>"
    msg["To"] = to_email

    # HTML parçası ekle
    html_part = MIMEText(full_html, "html", "utf-8")
    msg.attach(html_part)

    # SMTP bağlantısı kur ve gönder
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(gmail_user, gmail_password)
        server.sendmail(gmail_user, to_email, msg.as_string())
