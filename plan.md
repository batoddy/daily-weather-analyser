# Daily Weather Analyser — Plan

## Ne Yapıyor?

Her sabah 08:00 ve öğlen 12:00'da GitHub Actions ile otomatik çalışan,
birden fazla alıcıya konuma göre kişiselleştirilmiş hava durumu analizi ve
giyim önerileri gönderen bir Python asistanı.

- **Hava verisi**: Open-Meteo API (ücretsiz, API key yok)
- **AI analiz**: Google Gemini
- **Mail**: Gmail SMTP
- **Zamanlama**: GitHub Actions cron

---

## Proje Yapısı

```
├── .github/workflows/weather-report.yml   # GitHub Actions
├── src/
│   ├── main.py              # Ana orkestratör (--mode morning/noon)
│   ├── weather_fetcher.py   # Open-Meteo API entegrasyonu
│   ├── ai_analyzer.py       # Gemini analiz + giyim önerileri
│   └── email_sender.py      # Gmail SMTP gönderimi
├── config/
│   └── cities.yaml          # Şehir koordinatları (PUBLIC, repoda açık)
├── requirements.txt
├── .env.example
└── .gitignore
```

---

## Gizlilik Mimarisi

| Veri | Nerede Durur |
|---|---|
| Şehir koordinatları | `config/cities.yaml` — repoda açık |
| Mail adresi, isim, şehir | `RECIPIENTS` GitHub Secret |
| Gemini API key | `GEMINI_API_KEY` GitHub Secret |
| Gmail şifresi | `GMAIL_APP_PASSWORD` GitHub Secret |

---

## Yeni Alıcı Ekleme

1. Şehir `config/cities.yaml`'da yoksa ekle + commit at
2. GitHub → Settings → Secrets and variables → Actions → `RECIPIENTS` secret'ını düzenle:
   ```json
   [
     {"name": "Batuhan", "email": "b@gmail.com", "city": "Riga", "language": "tr"},
     {"name": "Yeni Kişi", "email": "yeni@gmail.com", "city": "Berlin", "language": "en"}
   ]
   ```

## Yeni Şehir Ekleme

`config/cities.yaml` dosyasına ekle:
```yaml
  SehirAdi:
    lat: 00.0000
    lon: 00.0000
    timezone: "Continent/City"
```
Timezone listesi: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

---

## Kurulum (İlk Kez)

### 1. Gmail App Password Oluştur
- Gmail → Hesap Ayarları → Güvenlik → 2 Adımlı Doğrulama → Uygulama Şifreleri
- "Uygulama Şifresi Oluştur" → adı ver → 16 haneli kodu kopyala

### 2. Gemini API Key Al
- https://aistudio.google.com/ → "Get API Key" → Ücretsiz

### 3. GitHub Secrets Ekle
GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
- `GEMINI_API_KEY` → Gemini API anahtarı
- `GMAIL_USER` → Gmail adresi (örn. `sen@gmail.com`)
- `GMAIL_APP_PASSWORD` → 16 haneli app password
- `RECIPIENTS` → JSON array (yukarıdaki format)

### 4. Test Et
GitHub → Actions → "Daily Weather Report" → "Run workflow" → mode: morning, dry_run: true

---

## Lokal Test

```bash
# 1. Bağımlılıkları kur
pip install -r requirements.txt

# 2. .env dosyası oluştur
cp .env.example .env
# .env dosyasını düzenle, gerçek değerleri doldur

# 3. Dry run (mail göndermez)
python src/main.py --mode morning --dry-run

# 4. Gerçek mail gönder
python src/main.py --mode morning
```

---

## Zamanlama (UTC)

| Yerel Saat | UTC (Yaz) | UTC (Kış) | Cron |
|---|---|---|---|
| 08:00 Riga/İstanbul | 05:00 | 06:00* | `0 5 * * *` |
| 12:00 Riga/İstanbul | 09:00 | 10:00* | `0 9 * * *` |

*Kış aylarında Riga UTC+2'ye düşer (Türkiye UTC+3 kalır).
Kışın Riga saati için workflow'daki cron'u `0 6 * * *` / `0 10 * * *` yap.
