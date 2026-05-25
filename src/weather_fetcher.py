"""
weather_fetcher.py
------------------
Open-Meteo API'den saatlik hava durumu verisi çeker.
API key gerektirmez, tamamen ücretsizdir.
"""

import requests
from datetime import datetime, timezone
import zoneinfo


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

HOURLY_VARIABLES = [
    "temperature_2m",
    "apparent_temperature",
    "precipitation_probability",
    "precipitation",
    "wind_speed_10m",
    "wind_gusts_10m",
    "weathercode",
    "cloud_cover",
]

# WMO Weather Code → Türkçe/İngilizce açıklama
WMO_CODES = {
    0: {"tr": "Açık güneşli", "en": "Clear sky"},
    1: {"tr": "Çoğunlukla açık", "en": "Mainly clear"},
    2: {"tr": "Parçalı bulutlu", "en": "Partly cloudy"},
    3: {"tr": "Bulutlu", "en": "Overcast"},
    45: {"tr": "Sisli", "en": "Foggy"},
    48: {"tr": "Kırağılı sis", "en": "Freezing fog"},
    51: {"tr": "Hafif çisenti", "en": "Light drizzle"},
    53: {"tr": "Orta çisenti", "en": "Moderate drizzle"},
    55: {"tr": "Yoğun çisenti", "en": "Dense drizzle"},
    61: {"tr": "Hafif yağmur", "en": "Light rain"},
    63: {"tr": "Orta yağmur", "en": "Moderate rain"},
    65: {"tr": "Yoğun yağmur", "en": "Heavy rain"},
    71: {"tr": "Hafif kar", "en": "Light snow"},
    73: {"tr": "Orta kar", "en": "Moderate snow"},
    75: {"tr": "Yoğun kar", "en": "Heavy snow"},
    77: {"tr": "Kar taneleri", "en": "Snow grains"},
    80: {"tr": "Hafif sağanak", "en": "Slight showers"},
    81: {"tr": "Orta sağanak", "en": "Moderate showers"},
    82: {"tr": "Şiddetli sağanak", "en": "Violent showers"},
    85: {"tr": "Hafif kar sağanağı", "en": "Slight snow showers"},
    86: {"tr": "Yoğun kar sağanağı", "en": "Heavy snow showers"},
    95: {"tr": "Gök gürültülü fırtına", "en": "Thunderstorm"},
    96: {"tr": "Hafif dolu fırtınası", "en": "Thunderstorm with slight hail"},
    99: {"tr": "Şiddetli dolu fırtınası", "en": "Thunderstorm with heavy hail"},
}


def get_wmo_description(code: int, language: str = "tr") -> str:
    """WMO hava kodunu okunabilir açıklamaya çevirir."""
    desc = WMO_CODES.get(code, {})
    return desc.get(language, desc.get("en", f"Kod {code}"))


def fetch_hourly_forecast(lat: float, lon: float, timezone_str: str) -> dict:
    """
    Open-Meteo API'den sonraki 24 saatlik tahmin verisini çeker.

    Args:
        lat: Enlem
        lon: Boylam
        timezone_str: IANA timezone adı (örn. "Europe/Istanbul")

    Returns:
        {
          "timezone": str,
          "current_time": str,
          "hours": [
            {
              "time": "14:00",
              "date": "2024-05-26",
              "temp": 18.5,
              "feels_like": 16.2,
              "precip_prob": 30,
              "precip_mm": 0.0,
              "wind_kmh": 15.0,
              "wind_gusts_kmh": 22.0,
              "weathercode": 2,
              "weather_desc_tr": "Parçalı bulutlu",
              "weather_desc_en": "Partly cloudy",
            },
            ...
          ]
        }
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(HOURLY_VARIABLES),
        "timezone": timezone_str,
        "forecast_days": 2,  # Bugün + yarın (filtreleme yapacağız)
    }

    response = requests.get(OPEN_METEO_URL, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()

    hourly = data["hourly"]
    times = hourly["time"]  # "2024-05-26T08:00" formatında

    # Şu anki yerel saati bul
    tz = zoneinfo.ZoneInfo(timezone_str)
    now_local = datetime.now(tz)
    now_str = now_local.strftime("%Y-%m-%dT%H:00")

    # Şu andan itibaren 24 saat
    hours_list = []
    count = 0
    found_current = False

    for i, t in enumerate(times):
        if t >= now_str:
            found_current = True

        if found_current:
            dt = datetime.fromisoformat(t).replace(tzinfo=tz)
            hours_list.append({
                "time": dt.strftime("%H:%M"),
                "date": dt.strftime("%Y-%m-%d"),
                "datetime_iso": t,
                "temp": round(hourly["temperature_2m"][i], 1),
                "feels_like": round(hourly["apparent_temperature"][i], 1),
                "precip_prob": int(hourly["precipitation_probability"][i] or 0),
                "precip_mm": round(hourly["precipitation"][i] or 0.0, 1),
                "wind_kmh": round(hourly["wind_speed_10m"][i], 1),
                "wind_gusts_kmh": round(hourly["wind_gusts_10m"][i], 1),
                "weathercode": int(hourly["weathercode"][i]),
                "weather_desc_tr": get_wmo_description(int(hourly["weathercode"][i]), "tr"),
                "weather_desc_en": get_wmo_description(int(hourly["weathercode"][i]), "en"),
            })
            count += 1
            if count >= 24:
                break

    return {
        "timezone": timezone_str,
        "current_time": now_local.strftime("%Y-%m-%d %H:%M"),
        "hours": hours_list,
    }


def summarize_forecast(forecast: dict) -> dict:
    """
    Ham saatlik veriyi özet istatistiklere dönüştürür.
    Gemini'ye daha temiz veri göndermek için kullanılır.
    """
    hours = forecast["hours"]
    if not hours:
        return {}

    temps = [h["temp"] for h in hours]
    feels = [h["feels_like"] for h in hours]
    precip_probs = [h["precip_prob"] for h in hours]
    winds = [h["wind_kmh"] for h in hours]

    # Yağmurlu saatler (%40 üzeri olasılık)
    rainy_hours = [h for h in hours if h["precip_prob"] >= 40]
    rain_windows = []
    if rainy_hours:
        rain_windows = [f"{h['time']} (%{h['precip_prob']}, {h['precip_mm']}mm)" for h in rainy_hours]

    return {
        "temp_min": min(temps),
        "temp_max": max(temps),
        "feels_min": min(feels),
        "feels_max": max(feels),
        "wind_avg": round(sum(winds) / len(winds), 1),
        "wind_max": max(winds),
        "max_precip_prob": max(precip_probs),
        "rain_windows": rain_windows,
        "hourly_data": hours,  # Tüm saatlik veri de gönderilir
    }
