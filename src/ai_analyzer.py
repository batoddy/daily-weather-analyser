"""
ai_analyzer.py
--------------
Google Gemini API kullanarak hava durumu verilerini analiz eder
ve kişiselleştirilmiş giyim önerileri + günlük özet üretir.
"""

from core.gemini_client import GeminiClient


def _build_morning_prompt(recipient: dict, city: str, summary: dict, language: str) -> str:
    """Sabah raporu için Gemini prompt'u oluşturur."""

    hourly_text = "\n".join([
        f"  {h['time']}: {h['temp']}°C (hissedilen {h['feels_like']}°C), "
        f"yağmur %{h['precip_prob']}, rüzgar {h['wind_kmh']}km/h, {h['weather_desc_tr']}"
        for h in summary.get("hourly_data", [])
    ])

    rain_info = ""
    if summary.get("rain_windows"):
        rain_info = f"Yağmur beklenen saatler: {', '.join(summary['rain_windows'])}"
    else:
        rain_info = "Gün içinde önemli yağmur beklentisi yok."

    if language == "tr":
        lang_instruction = "Yanıtını TÜRKÇE yaz."
        name_greeting = f"Merhaba {recipient['name']}!"
    else:
        lang_instruction = "Write your response in ENGLISH."
        name_greeting = f"Good morning {recipient['name']}!"

        # İngilizce için hourly text'i de İngilizce yapalım
        hourly_text = "\n".join([
            f"  {h['time']}: {h['temp']}°C (feels like {h['feels_like']}°C), "
            f"rain {h['precip_prob']}%, wind {h['wind_kmh']}km/h, {h['weather_desc_en']}"
            for h in summary.get("hourly_data", [])
        ])
        if summary.get("rain_windows"):
            rain_info = f"Expected rain hours: {', '.join(summary['rain_windows'])}"
        else:
            rain_info = "No significant rain expected today."

    prompt = f"""
{lang_instruction}

Sen bir kişisel hava durumu asistanısın. Aşağıdaki saatlik hava verilerini analiz ederek
{recipient['name']} için sabah raporu hazırla.

Şehir: {city}
Tarih: {summary.get('hourly_data', [{}])[0].get('date', 'bugün') if summary.get('hourly_data') else 'bugün'}

=== SAATLIK HAVA VERİSİ ===
{hourly_text}

=== ÖZET ===
- Sabah (06-12) ort.: {summary.get('morning_avg', '—')}°C
- Öğle (12-19) ort.: {summary.get('afternoon_avg', '—')}°C
- Akşam (19-23) ort.: {summary.get('evening_avg', '—')}°C
- Dönem geneli ort.: {summary['temp_avg']}°C | Min: {summary['temp_min']}°C | Maks: {summary['temp_max']}°C
- Hissedilen: {summary['feels_min']}°C – {summary['feels_max']}°C
- Rüzgar: ort. {summary['wind_avg']} km/h, maks. {summary['wind_max']} km/h
- En yüksek yağmur olasılığı: %{summary['max_precip_prob']}
- {rain_info}

=== GÖREV ===
Aşağıdaki formatta sabah raporu yaz (düz metin, HTML kullanma).
Bu rapor 08:00–12:00 arası hava verisini kapsar.

--- ÖZET ---
Yeni uyanmış, henüz kahvesini bile içmemiş biri için yaz. Sade, samimi, doğal bir dil.
1-2 cümle. Şunları içermeli: hava nasıl (sıcak/soğuk/ılık), yağmur veya sert rüzgar varsa saat ver, ne giymeli.
Sanki bir arkadaşın mesaj atıyormuş gibi — teknik değil, insan gibi konuş.
Örnek: "Sabah fena soğuk (8°C, hissedilen 5°C), mont olmadan çıkma. 10:00 civarı yağmur da başlıyor, şemsiyeni al."
Örnek: "Güneşli bir sabah seni bekliyor, 22°C. Saat 11:00'den sonra biraz serinleyecek ama çok değil."
Örnek: "Sabah ılık (18°C) ama 10:00'dan itibaren ani soğuma var (12°C'ye düşüyor), üstüne bir şeyler al."

--- Detaylı Analiz ---
🌡️ Sıcaklık: sabah trendi ve hissedilen, ortalama sıcaklık da belirt
🌧️ Yağmur: varsa hangi saatler ve şiddet — yoksa bu satırı atla
💨 Rüzgar: dikkat çekecek kadar güçlüyse yaz (hız + saat) — normalse atla
⚠️ Ani değişimler: beklenmedik yağmur, ani rüzgar artışı veya ani soğuma varsa saatiyle uyar — yoksa atla

Detaylı analiz sabah okunabilecek uzunlukta olsun, aşırı uzatma.
Sadece düz metin döndür, kesinlikle HTML tag'i kullanma.
"""
    return prompt


def _build_noon_prompt(recipient: dict, city: str, summary: dict, language: str) -> str:
    """Öğlen raporu için Gemini prompt'u oluşturur (öğleden sonra + akşam odaklı)."""

    hourly_text = "\n".join([
        f"  {h['time']}: {h['temp']}°C (hissedilen {h['feels_like']}°C), "
        f"yağmur %{h['precip_prob']}, rüzgar {h['wind_kmh']}km/h, {h['weather_desc_tr']}"
        for h in summary.get("hourly_data", [])
    ])

    rain_info = ""
    if summary.get("rain_windows"):
        rain_info = f"Yağmur beklenen saatler: {', '.join(summary['rain_windows'])}"
    else:
        rain_info = "Öğleden sonra önemli yağmur beklentisi yok."

    if language == "tr":
        lang_instruction = "Yanıtını TÜRKÇE yaz."
    else:
        lang_instruction = "Write your response in ENGLISH."
        hourly_text = "\n".join([
            f"  {h['time']}: {h['temp']}°C (feels like {h['feels_like']}°C), "
            f"rain {h['precip_prob']}%, wind {h['wind_kmh']}km/h, {h['weather_desc_en']}"
            for h in summary.get("hourly_data", [])
        ])
        if summary.get("rain_windows"):
            rain_info = f"Expected rain hours: {', '.join(summary['rain_windows'])}"
        else:
            rain_info = "No significant rain expected this afternoon."

    prompt = f"""
{lang_instruction}

Sen bir kişisel hava durumu asistanısın. Aşağıdaki verileri kullanarak
{recipient['name']} için ÖĞLEDEN SONRA ve AKŞAM odaklı kısa bir güncelleme hazırla.

Şehir: {city}

=== KALAN GÜN SAATLIK HAVA VERİSİ ===
{hourly_text}

=== ÖZET ===
- Öğle (12-19) ort.: {summary.get('afternoon_avg', '—')}°C
- Akşam (19-23) ort.: {summary.get('evening_avg', '—')}°C
- Dönem geneli ort.: {summary['temp_avg']}°C | Min: {summary['temp_min']}°C | Maks: {summary['temp_max']}°C
- Hissedilen: {summary['feels_min']}°C – {summary['feels_max']}°C
- Rüzgar: ort. {summary['wind_avg']} km/h, maks. {summary['wind_max']} km/h
- {rain_info}

=== GÖREV ===
Aşağıdaki formatta öğlen güncellemesi yaz (düz metin, HTML kullanma).
Bu rapor 12:00–23:00 arası hava verisini kapsar, yarına taşmaz.
Sabah zaten rapor aldı, tekrar etme. Sadece öğleden sonra ve akşama odaklan.

--- ÖZET ---
Samimi, arkadaş gibi bir dille 1-2 cümle. Öğleden sonra ne değişiyor, akşam nasıl, uyarı var mı?
Örnek: "Akşam 19:00'da yağmur geliyor, şemsiyeni unutma."
Örnek: "Geri kalan gün sakin geçecek ama akşam 10°C'ye düşüyor, üşümek istemiyorsan bir şeyler al yanına."
Örnek: "Şu an iyi ama 16:00'dan sonra hava bozuluyor, ani rüzgar ve yağmur var — dışarıda planın varsa dikkat."

--- Detaylı Analiz ---
🌡️ Sıcaklık: öğleden sonra + akşam trendi, ortalama ve hissedilen
🌧️ Yağmur: varsa saat ve şiddet — yoksa bu satırı atla
💨 Rüzgar: dikkat çekecek kadar güçlüyse yaz — yoksa atla
⚠️ Ani değişimler: beklenmedik yağmur, ani rüzgar, ani soğuma varsa saatiyle uyar — yoksa atla

Sadece düz metin döndür, kesinlikle HTML tag'i kullanma.
"""
    return prompt


def analyze_weather(
    recipient: dict,
    city: str,
    summary: dict,
    mode: str = "morning",
) -> str:
    """
    Hava durumu verisini Gemini'ye göndererek HTML mail içeriği üretir.

    Args:
        recipient: {"name": str, "email": str, "city": str, "language": str}
        city: Şehir adı (görüntüleme için)
        summary: weather_fetcher.summarize_forecast() çıktısı
        mode: "morning" veya "noon"

    Returns:
        HTML formatında mail içeriği (body içeriği)
    """
    language = recipient.get("language", "tr")

    if mode == "morning":
        prompt = _build_morning_prompt(recipient, city, summary, language)
    else:
        prompt = _build_noon_prompt(recipient, city, summary, language)

    return GeminiClient().generate(prompt)
