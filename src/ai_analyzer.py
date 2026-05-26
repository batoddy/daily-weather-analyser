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
- Sıcaklık aralığı: {summary['temp_min']}°C – {summary['temp_max']}°C
- Hissedilen sıcaklık: {summary['feels_min']}°C – {summary['feels_max']}°C
- Ortalama rüzgar: {summary['wind_avg']} km/h, maksimum: {summary['wind_max']} km/h
- En yüksek yağmur olasılığı: %{summary['max_precip_prob']}
- {rain_info}

=== GÖREV ===
Aşağıdaki formatta KISA ve PRATİK bir sabah raporu yaz (düz metin, HTML kullanma).
Aşırı uzun olmasın. Emoji kullan. Sıcaklık ve giyim bilgileri NET olsun.

Format şöyle olmalı:
1. Kısa selamlama + şehir + tarih başlığı
2. 🌡️ Sıcaklık özeti (sabah/öğle/akşam trendi, hissedilen)
3. 🌧️ Yağmur durumu (varsa hangi saatler, yoksa kısaca "yağmur yok")
4. 💨 Rüzgar durumu (önemli değilse tek cümle yeter)
5. 👗 Giyim önerisi (bunu özellikle detaylı yap — sabah/öğle/akşam için ne giyilmeli, mont alınmalı mı, şemsiye gerek var mı)

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
- Sıcaklık aralığı: {summary['temp_min']}°C – {summary['temp_max']}°C
- Hissedilen: {summary['feels_min']}°C – {summary['feels_max']}°C
- Rüzgar: ort. {summary['wind_avg']} km/h, maks. {summary['wind_max']} km/h
- {rain_info}

=== GÖREV ===
KISA bir öğlen güncellemesi yaz (HTML formatında, emoji ile).
Sabah bilgilerini tekrarlama. Sadece öğleden sonra ve akşama odaklan.

Format:
1. Kısa "günaydın güncelleme" girişi
2. 🌡️ Öğleden sonra + akşam sıcaklık trendi (akşam soğuyacak mı?)
3. 🌧️ Yağmur/hava değişikliği uyarısı (varsa)
4. 👗 Güncellenen giyim/ekipman önerisi (akşam için mont gerek mi, şemsiye unutma gibi)

Sadece HTML body içeriğini döndür (html/body tag'leri olmadan).
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
