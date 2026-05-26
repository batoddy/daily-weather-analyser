# 🌤️ Daily Weather Analyser

Her sabah **08:00** ve öğlen **12:00**'da GitHub Actions ile otomatik çalışan, birden fazla alıcıya konumlarına göre kişiselleştirilmiş hava durumu analizi ve giyim önerileri gönderen bir Python asistanı.

Sabah maili: uyanır uyanmaz okuyabileceğin kısa bir özet + detaylı analiz.  
Öğlen maili: öğleden sonra ve akşam için güncelleme.

## Özellikler

- 📍 Çoklu şehir desteği — her alıcı farklı bir konumda olabilir
- 🌡️ Saatlik sıcaklık ve hissedilen sıcaklık analizi
- 🌧️ Yağmur tahmini — varsa saat ve şiddetiyle
- 💨 Rüzgar uyarısı — ani artışlar saatiyle belirtilir
- ⚠️ Ani hava değişimi uyarıları
- 🧥 Doğal dilde kıyafet önerisi
- 🌍 Dil desteği: Türkçe / İngilizce (alıcıya göre)
- 🔒 Kişisel veriler GitHub Secrets'ta, koordinatlar repoda açık

## Nasıl Çalışır

```
Open-Meteo API → saatlik hava verisi
      ↓
Gemini 3.1 Flash Lite → analiz + öneri
      ↓
Gmail SMTP → kişiselleştirilmiş mail
```

## Kurulum

### 1. Şehirleri ekle

`config/cities.yaml` dosyasına şehir koordinatlarını ekle:

```yaml
SehirAdi:
  lat: 00.0000
  lon: 00.0000
  timezone: "Continent/City"
```

### 2. GitHub Secrets ekle

GitHub → Settings → Secrets and variables → Actions:

| Secret               | Açıklama                                                      |
| -------------------- | ------------------------------------------------------------- |
| `GEMINI_API_KEY`     | [aistudio.google.com](https://aistudio.google.com) → ücretsiz |
| `GMAIL_USER`         | Gönderi yapacak Gmail adresi                                  |
| `GMAIL_APP_PASSWORD` | Gmail → Güvenlik → Uygulama Şifreleri                         |
| `RECIPIENTS`         | JSON array (aşağıya bak)                                      |

**RECIPIENTS formatı** (tek satır, boşluksuz):

```json
[
  { "name": "Ad", "email": "mail@gmail.com", "city": "Riga", "language": "tr" },
  {
    "name": "Ad2",
    "email": "mail2@gmail.com",
    "city": "Istanbul",
    "language": "tr"
  }
]
```

### 3. Test et

Actions → **Daily Weather Report** → **Run workflow** → `morning`

## Lokal Test

```bash
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt

# .env dosyasını doldur
cp .env.example .env

# Mail göndermeden test et
python src/main.py --mode morning --dry-run

# Gerçek mail gönder
python src/main.py --mode morning
```

## Zamanlama

| Tetiklenme         | Yerel saat            | UTC (yaz) |
| ------------------ | --------------------- | --------- |
| Sabah raporu       | 08:00 (Riga/İstanbul) | 05:00     |
| Öğlen güncellemesi | 12:00 (Riga/İstanbul) | 09:00     |

## Teknolojiler

| Bileşen        | Teknoloji                                                     |
| -------------- | ------------------------------------------------------------- |
| Hava verisi    | [Open-Meteo](https://open-meteo.com/) — ücretsiz, API key yok |
| AI analiz      | Google Gemini 3.1 Flash Lite                                  |
| Mail gönderimi | Gmail SMTP                                                    |
| Zamanlama      | GitHub Actions                                                |
