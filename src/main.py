"""
main.py
-------
Ana orkestratör. GitHub Actions ve lokal testler için giriş noktası.

Kullanım:
  python src/main.py --mode morning
  python src/main.py --mode noon
  python src/main.py --mode morning --dry-run  (mail göndermez, çıktıyı ekrana basar)

Gerekli env variable'lar:
  RECIPIENTS       — JSON array (GitHub Secret veya .env dosyası)
  GEMINI_API_KEY   — Google AI Studio API key
  GMAIL_USER       — Gmail adresi
  GMAIL_APP_PASSWORD — Gmail App Password
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv

# Lokal .env dosyasını yükle (GitHub Actions'da env variable'lar direkt tanımlı)
load_dotenv()

# src/ klasörünü Python path'e ekle
sys.path.insert(0, str(Path(__file__).parent))

from weather_fetcher import fetch_hourly_forecast, summarize_forecast
from ai_analyzer import analyze_weather
from email_sender import send_email, build_subject

# Logging ayarları
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def load_cities(config_path: Path) -> dict:
    """config/cities.yaml dosyasını yükler."""
    if not config_path.exists():
        raise FileNotFoundError(f"cities.yaml bulunamadı: {config_path}")
    with open(config_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data.get("cities", {})


def load_recipients() -> list[dict]:
    """
    RECIPIENTS env variable'ından alıcı listesini yükler.
    Format: JSON array
    Örnek: [{"name":"Batuhan","email":"b@gmail.com","city":"Riga","language":"tr"}]
    """
    raw = os.environ.get("RECIPIENTS")
    if not raw:
        raise EnvironmentError(
            "RECIPIENTS environment variable bulunamadı.\n"
            "Lokal test için .env dosyanıza RECIPIENTS=[...] ekleyin.\n"
            "GitHub Actions için Secrets'a RECIPIENTS ekleyin."
        )
    try:
        recipients = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"RECIPIENTS geçerli bir JSON değil: {e}")

    if not isinstance(recipients, list):
        raise ValueError("RECIPIENTS bir JSON array olmalı: [{...}, {...}]")

    # Zorunlu alanları kontrol et
    required_fields = {"name", "email", "city"}
    for i, r in enumerate(recipients):
        missing = required_fields - set(r.keys())
        if missing:
            raise ValueError(f"Alıcı #{i+1} eksik alan: {missing} — {r}")
        # language varsayılanı "tr"
        r.setdefault("language", "tr")

    return recipients


def process_recipient(
    recipient: dict,
    cities: dict,
    mode: str,
    dry_run: bool = False,
) -> bool:
    """
    Tek bir alıcı için tüm akışı çalıştırır:
    hava verisi al → Gemini analizi → mail gönder.

    Returns:
        True: başarılı, False: hata oluştu
    """
    name = recipient["name"]
    city_name = recipient["city"]
    email = recipient["email"]
    language = recipient.get("language", "tr")

    log.info(f"[{name}] İşleniyor... (Şehir: {city_name}, Dil: {language})")

    # Şehri cities.yaml'da ara
    city_data = cities.get(city_name)
    if not city_data:
        log.error(
            f"[{name}] ❌ '{city_name}' şehri config/cities.yaml'da bulunamadı. "
            f"Mevcut şehirler: {list(cities.keys())}"
        )
        return False

    # 1. Hava durumu verisini çek
    try:
        log.info(f"[{name}] Open-Meteo'dan hava verisi çekiliyor...")
        forecast = fetch_hourly_forecast(
            lat=city_data["lat"],
            lon=city_data["lon"],
            timezone_str=city_data["timezone"],
            mode=mode,
        )
        summary = summarize_forecast(forecast)
        log.info(
            f"[{name}] ✅ Hava verisi alındı — "
            f"Sıcaklık: {summary['temp_min']}–{summary['temp_max']}°C, "
            f"Max yağmur olasılığı: %{summary['max_precip_prob']}"
        )
    except Exception as e:
        log.error(f"[{name}] ❌ Hava verisi alınamadı: {e}")
        return False

    # 2. Gemini analizi
    try:
        log.info(f"[{name}] Gemini analizi yapılıyor...")
        html_content = analyze_weather(
            recipient=recipient,
            city=city_name,
            summary=summary,
            mode=mode,
        )
        log.info(
            f"[{name}] ✅ Gemini analizi tamamlandı ({len(html_content)} karakter)"
        )
    except Exception as e:
        log.error(f"[{name}] ❌ Gemini analizi başarısız: {e}")
        return False

    # Veri kaynağı footer'ı ekle
    source = summary.get("source", "open-meteo")
    source_label = "MET Norway (yr.no)" if source == "met-norway" else "Open-Meteo"
    html_content += f"\n\n---\n📡 Veri kaynağı: {source_label}"

    # 3. Mail gönder
    subject = build_subject(city_name, mode, language)

    if dry_run:
        log.info(f"[{name}] 🔍 DRY RUN — Mail gönderilmedi.")
        print(f"\n{'='*60}")
        print(f"TO: {email}")
        print(f"SUBJECT: {subject}")
        print(f"{'='*60}")
        print(html_content)
        print(f"{'='*60}\n")
        return True

    try:
        log.info(f"[{name}] Mail gönderiliyor → {email}")
        send_email(
            to_email=email,
            subject=subject,
            html_body=html_content,
            recipient_name=name,
            city=city_name,
            mode=mode,
        )
        log.info(f"[{name}] ✅ Mail gönderildi → {email}")
        return True
    except Exception as e:
        log.error(f"[{name}] ❌ Mail gönderilemedi: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Günlük hava durumu analizi ve mail gönderimi"
    )
    parser.add_argument(
        "--mode",
        choices=["morning", "noon"],
        default="morning",
        help="'morning' = sabah raporu, 'noon' = öğlen güncellemesi",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mail göndermez, çıktıyı terminale basar (test için)",
    )
    args = parser.parse_args()

    log.info(f"🚀 Başlatılıyor — mod: {args.mode}, dry-run: {args.dry_run}")

    # cities.yaml yükle
    config_path = Path(__file__).parent.parent / "config" / "cities.yaml"
    try:
        cities = load_cities(config_path)
        log.info(f"📍 {len(cities)} şehir yüklendi: {list(cities.keys())}")
    except Exception as e:
        log.critical(f"cities.yaml yüklenemedi: {e}")
        sys.exit(1)

    # Alıcıları yükle
    try:
        recipients = load_recipients()
        log.info(f"👥 {len(recipients)} alıcı bulundu")
    except Exception as e:
        log.critical(f"Alıcı listesi yüklenemedi: {e}")
        sys.exit(1)

    # Her alıcıyı işle
    results = []
    for recipient in recipients:
        success = process_recipient(
            recipient=recipient,
            cities=cities,
            mode=args.mode,
            dry_run=args.dry_run,
        )
        results.append((recipient["name"], success))

    # Özet rapor
    log.info("=" * 50)
    log.info("📊 ÖZET:")
    success_count = 0
    for name, ok in results:
        status = "✅" if ok else "❌"
        log.info(f"  {status} {name}")
        if ok:
            success_count += 1

    log.info(f"Toplam: {success_count}/{len(results)} başarılı")

    # Tüm alıcılar başarısız olduysa hata kodu döndür
    if success_count == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
