"""
weather_fetcher.py
------------------
Hava durumu verisi çeker.
Birincil: Open-Meteo (ücretsiz, key yok)
Yedek:    MET Norway / yr.no (ücretsiz, key yok, ECMWF tabanlı, Avrupa için çok doğru)
"""

import requests
from datetime import datetime, timezone
import zoneinfo


# --- Open-Meteo ---
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

# --- MET Norway (yr.no) ---
MET_NORWAY_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
# MET Norway zorunlu kılar: User-Agent header'ı (uygulama adı + iletişim)
MET_NORWAY_HEADERS = {
    "User-Agent": "daily-weather-analyser/1.0 github.com/batuhan/daily-weather-analyser"
}

# MET Norway symbol_code → Türkçe/İngilizce
MET_NORWAY_SYMBOLS = {
    "clearsky":          {"tr": "Açık güneşli",       "en": "Clear sky"},
    "fair":              {"tr": "Çoğunlukla açık",     "en": "Mainly clear"},
    "partlycloudy":      {"tr": "Parçalı bulutlu",     "en": "Partly cloudy"},
    "cloudy":            {"tr": "Bulutlu",              "en": "Overcast"},
    "fog":               {"tr": "Sisli",               "en": "Foggy"},
    "rain":              {"tr": "Yağmurlu",            "en": "Rainy"},
    "rainshowers":       {"tr": "Sağanak yağışlı",     "en": "Rain showers"},
    "sleet":             {"tr": "Karla karışık yağmur","en": "Sleet"},
    "sleetshowers":      {"tr": "Karla karışık sağanak","en": "Sleet showers"},
    "snow":              {"tr": "Karlı",               "en": "Snowy"},
    "snowshowers":       {"tr": "Kar sağanağı",        "en": "Snow showers"},
    "heavyrain":         {"tr": "Yoğun yağmur",        "en": "Heavy rain"},
    "heavyrainshowers":  {"tr": "Şiddetli sağanak",    "en": "Heavy showers"},
    "heavysleet":        {"tr": "Yoğun karla karışık", "en": "Heavy sleet"},
    "heavysnow":         {"tr": "Yoğun kar",           "en": "Heavy snow"},
    "lightrain":         {"tr": "Hafif yağmur",        "en": "Light rain"},
    "lightrainshowers":  {"tr": "Hafif sağanak",       "en": "Light showers"},
    "lightsleet":        {"tr": "Hafif karla karışık", "en": "Light sleet"},
    "lightsnow":         {"tr": "Hafif kar",           "en": "Light snow"},
    "thunder":           {"tr": "Gök gürültülü fırtına","en": "Thunderstorm"},
    "thundershowers":    {"tr": "Gök gürültülü sağanak","en": "Thunder showers"},
}

# WMO Weather Code → Türkçe/İngilizce (Open-Meteo için)
WMO_CODES = {
    0:  {"tr": "Açık güneşli",             "en": "Clear sky"},
    1:  {"tr": "Çoğunlukla açık",          "en": "Mainly clear"},
    2:  {"tr": "Parçalı bulutlu",          "en": "Partly cloudy"},
    3:  {"tr": "Bulutlu",                  "en": "Overcast"},
    45: {"tr": "Sisli",                    "en": "Foggy"},
    48: {"tr": "Kırağılı sis",             "en": "Freezing fog"},
    51: {"tr": "Hafif çisenti",            "en": "Light drizzle"},
    53: {"tr": "Orta çisenti",             "en": "Moderate drizzle"},
    55: {"tr": "Yoğun çisenti",            "en": "Dense drizzle"},
    61: {"tr": "Hafif yağmur",             "en": "Light rain"},
    63: {"tr": "Orta yağmur",              "en": "Moderate rain"},
    65: {"tr": "Yoğun yağmur",             "en": "Heavy rain"},
    71: {"tr": "Hafif kar",                "en": "Light snow"},
    73: {"tr": "Orta kar",                 "en": "Moderate snow"},
    75: {"tr": "Yoğun kar",                "en": "Heavy snow"},
    77: {"tr": "Kar taneleri",             "en": "Snow grains"},
    80: {"tr": "Hafif sağanak",            "en": "Slight showers"},
    81: {"tr": "Orta sağanak",             "en": "Moderate showers"},
    82: {"tr": "Şiddetli sağanak",         "en": "Violent showers"},
    85: {"tr": "Hafif kar sağanağı",       "en": "Slight snow showers"},
    86: {"tr": "Yoğun kar sağanağı",       "en": "Heavy snow showers"},
    95: {"tr": "Gök gürültülü fırtına",    "en": "Thunderstorm"},
    96: {"tr": "Hafif dolu fırtınası",     "en": "Thunderstorm with slight hail"},
    99: {"tr": "Şiddetli dolu fırtınası",  "en": "Thunderstorm with heavy hail"},
}


def get_wmo_description(code: int, language: str = "tr") -> str:
    desc = WMO_CODES.get(code, {})
    return desc.get(language, desc.get("en", f"Kod {code}"))


def _get_met_norway_description(symbol_code: str, language: str = "tr") -> str:
    """MET Norway symbol code'unu okunabilir açıklamaya çevirir."""
    # symbol_code örnekleri: "clearsky_day", "rain_night", "partlycloudy_day"
    base = symbol_code.split("_")[0] if "_" in symbol_code else symbol_code
    desc = MET_NORWAY_SYMBOLS.get(base, {})
    return desc.get(language, desc.get("en", symbol_code))


def _precip_to_probability(precip_mm: float) -> int:
    """
    MET Norway yağış miktarından tahmini olasılık üretir.
    (MET Norway compact endpoint'i yağış olasılığı vermiyor)
    """
    if precip_mm <= 0:
        return 0
    elif precip_mm < 0.3:
        return 30
    elif precip_mm < 1.0:
        return 60
    elif precip_mm < 3.0:
        return 75
    else:
        return 90


def _feels_like(temp_c: float, wind_ms: float, humidity_pct: float) -> float:
    """
    Basit hissedilen sıcaklık hesabı (wind chill + heat index kombinasyonu).
    MET Norway apparent_temperature vermediği için hesaplanır.
    """
    wind_kmh = wind_ms * 3.6
    if temp_c <= 10 and wind_kmh > 4.8:
        # Wind chill (Kanada/ABD standardı)
        feels = (13.12 + 0.6215 * temp_c
                 - 11.37 * (wind_kmh ** 0.16)
                 + 0.3965 * temp_c * (wind_kmh ** 0.16))
    elif temp_c >= 27:
        # Basit ısı indeksi
        feels = temp_c + 0.33 * (humidity_pct / 100 * 6.105 * (17.27 * temp_c / (237.7 + temp_c))) - 4.0
    else:
        feels = temp_c
    return round(feels, 1)


# ---------------------------------------------------------------------------
# Open-Meteo
# ---------------------------------------------------------------------------

def _fetch_open_meteo(lat: float, lon: float, timezone_str: str, mode: str) -> dict:
    """Open-Meteo'dan veri çeker. Başarısız olursa exception fırlatır."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(HOURLY_VARIABLES),
        "timezone": timezone_str,
        "forecast_days": 2,
    }

    response = requests.get(OPEN_METEO_URL, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()

    hourly = data["hourly"]
    times = hourly["time"]

    tz = zoneinfo.ZoneInfo(timezone_str)
    now_local = datetime.now(tz)
    now_str = now_local.strftime("%Y-%m-%dT%H:00")
    today_str = now_local.strftime("%Y-%m-%d")
    end_str = f"{today_str}T12:00" if mode == "morning" else f"{today_str}T23:00"

    hours_list = []
    found_current = False

    for i, t in enumerate(times):
        if t >= now_str:
            found_current = True
        if found_current:
            if t > end_str:
                break
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

    if not hours_list:
        raise ValueError(
            f"Open-Meteo: '{mode}' modu için veri yok "
            f"(şu an {now_local.strftime('%H:%M')}, pencere geçmiş olabilir)"
        )

    return {
        "source": "open-meteo",
        "timezone": timezone_str,
        "current_time": now_local.strftime("%Y-%m-%d %H:%M"),
        "hours": hours_list,
    }


# ---------------------------------------------------------------------------
# MET Norway (yr.no) — yedek
# ---------------------------------------------------------------------------

def _fetch_met_norway(lat: float, lon: float, timezone_str: str, mode: str) -> dict:
    """MET Norway API'den veri çeker. Birincil API başarısız olunca kullanılır."""
    params = {"lat": lat, "lon": lon}

    response = requests.get(
        MET_NORWAY_URL, params=params, headers=MET_NORWAY_HEADERS, timeout=15
    )
    response.raise_for_status()
    data = response.json()

    tz = zoneinfo.ZoneInfo(timezone_str)
    now_local = datetime.now(tz)
    today_str = now_local.strftime("%Y-%m-%d")
    end_str = f"{today_str}T12:00" if mode == "morning" else f"{today_str}T23:00"

    # MET Norway UTC döndürür, yerel saate çevireceğiz
    now_utc_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00:00Z")

    hours_list = []
    for entry in data["properties"]["timeseries"]:
        t_utc = entry["time"]  # "2026-05-26T08:00:00Z"

        if t_utc < now_utc_str:
            continue

        # UTC → yerel zaman
        dt_utc = datetime.fromisoformat(t_utc.replace("Z", "+00:00"))
        dt_local = dt_utc.astimezone(tz)
        local_iso = dt_local.strftime("%Y-%m-%dT%H:00")

        if local_iso > end_str:
            break

        instant = entry["data"]["instant"]["details"]
        temp = round(instant["air_temperature"], 1)
        wind_ms = instant.get("wind_speed", 0)
        humidity = instant.get("relative_humidity", 50)
        wind_kmh = round(wind_ms * 3.6, 1)
        wind_gusts_kmh = round(instant.get("wind_speed_of_gust", wind_ms) * 3.6, 1)

        # Sonraki 1 saatlik veri
        next1h = entry["data"].get("next_1_hours", {})
        symbol = next1h.get("summary", {}).get("symbol_code", "cloudy")
        precip_mm = round(next1h.get("details", {}).get("precipitation_amount", 0.0), 1)
        precip_prob = _precip_to_probability(precip_mm)

        hours_list.append({
            "time": dt_local.strftime("%H:%M"),
            "date": dt_local.strftime("%Y-%m-%d"),
            "datetime_iso": local_iso,
            "temp": temp,
            "feels_like": _feels_like(temp, wind_ms, humidity),
            "precip_prob": precip_prob,
            "precip_mm": precip_mm,
            "wind_kmh": wind_kmh,
            "wind_gusts_kmh": wind_gusts_kmh,
            "weathercode": 0,  # MET Norway WMO kodu vermiyor
            "weather_desc_tr": _get_met_norway_description(symbol, "tr"),
            "weather_desc_en": _get_met_norway_description(symbol, "en"),
        })

    if not hours_list:
        raise ValueError(
            f"MET Norway: '{mode}' modu için veri yok "
            f"(şu an {now_local.strftime('%H:%M')}, pencere geçmiş olabilir)"
        )

    return {
        "source": "met-norway",
        "timezone": timezone_str,
        "current_time": now_local.strftime("%Y-%m-%d %H:%M"),
        "hours": hours_list,
    }


# ---------------------------------------------------------------------------
# Ana fonksiyon — fallback mantığı burada
# ---------------------------------------------------------------------------

def fetch_hourly_forecast(lat: float, lon: float, timezone_str: str, mode: str = "morning") -> dict:
    """
    Hava durumu verisini çeker.
    Önce Open-Meteo dener, başarısız olursa MET Norway'e geçer.

    Args:
        lat: Enlem
        lon: Boylam
        timezone_str: IANA timezone (örn. "Europe/Istanbul")
        mode: "morning" (08-12) veya "noon" (12-23)
    """
    try:
        result = _fetch_open_meteo(lat, lon, timezone_str, mode)
        return result
    except Exception as primary_error:
        # Open-Meteo başarısız — MET Norway'e geç
        try:
            result = _fetch_met_norway(lat, lon, timezone_str, mode)
            result["fallback_reason"] = str(primary_error)
            return result
        except Exception as fallback_error:
            raise RuntimeError(
                f"Her iki API de başarısız:\n"
                f"  Open-Meteo: {primary_error}\n"
                f"  MET Norway: {fallback_error}"
            )


# ---------------------------------------------------------------------------
# Özet istatistikler
# ---------------------------------------------------------------------------

def summarize_forecast(forecast: dict) -> dict:
    """
    Ham saatlik veriyi özet istatistiklere dönüştürür.

    Zaman dilimleri:
      sabah    → 06:00–11:59
      öğle     → 12:00–18:59
      akşam    → 19:00–23:59
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
    rain_windows = [
        f"{h['time']} (%{h['precip_prob']}, {h['precip_mm']}mm)"
        for h in rainy_hours
    ]

    def hour_int(h):
        return int(h["time"].split(":")[0])

    morning_temps   = [h["temp"] for h in hours if 6  <= hour_int(h) < 12]
    afternoon_temps = [h["temp"] for h in hours if 12 <= hour_int(h) < 19]
    evening_temps   = [h["temp"] for h in hours if hour_int(h) >= 19]

    def avg(lst):
        return round(sum(lst) / len(lst), 1) if lst else None

    return {
        "source": forecast.get("source", "unknown"),
        "temp_min": min(temps),
        "temp_max": max(temps),
        "temp_avg": round(sum(temps) / len(temps), 1),
        "feels_min": min(feels),
        "feels_max": max(feels),
        "wind_avg": round(sum(winds) / len(winds), 1),
        "wind_max": max(winds),
        "max_precip_prob": max(precip_probs),
        "rain_windows": rain_windows,
        "morning_avg":   avg(morning_temps),
        "afternoon_avg": avg(afternoon_temps),
        "evening_avg":   avg(evening_temps),
        "hourly_data": hours,
    }
