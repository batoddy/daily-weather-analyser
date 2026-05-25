# 🌤️ Daily Weather Analyser

Her sabah **08:00** ve öğlen **12:00**'da GitHub Actions ile otomatik çalışan,
birden fazla alıcıya konumlarına göre kişiselleştirilmiş hava durumu analizi ve
giyim önerileri gönderen bir Python asistanı.

## Özellikler

- 📍 **Çoklu şehir** — her alıcı farklı bir şehirde olabilir
- 🌡️ Saatlik sıcaklık ve hissedilen sıcaklık trendi
- 🌧️ Yağmur olasılığı ve yağmurlu saatler
- 💨 Rüzgar durumu
- 👗 **AI destekli giyim önerileri** (Gemini)
- 🌍 Dil desteği: Türkçe / İngilizce (alıcıya göre)
- 🔒 Kişisel veriler GitHub Secrets'ta, koordinatlar repoda

## Kurulum

Detaylı kurulum için → [plan.md](plan.md)

### Hızlı Başlangıç

1. Repo'yu fork/clone et
2. `config/cities.yaml`'a şehirleri ekle
3. GitHub Secrets'a ekle: `GEMINI_API_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `RECIPIENTS`
4. Actions → "Daily Weather Report" → "Run workflow" ile test et

## Teknolojiler

| Bileşen | Teknoloji |
|---|---|
| Hava verisi | [Open-Meteo](https://open-meteo.com/) (ücretsiz, key yok) |
| AI analiz | Google Gemini 1.5 Flash |
| Mail gönderimi | Gmail SMTP |
| Zamanlama | GitHub Actions |
