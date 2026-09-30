// Tüm eşikler tek yerde. Kullandıkça buradan ayarlanır.
// Sıcaklıklar °C, rüzgar km/s, yağış mm/saat.

export const T = {
  // Giyim kademesi: penceredeki en düşük hissedilen sıcaklık bu değerin altındaysa (≤) o kademe.
  // 5 kalın mont+bere/eldiven · 4 mont · 3 ceket/kalın hırka · 2 ince ceket/sweatshirt · 1 tişört+ince bir şey · 0 tişört
  tiers: [
    { maxFeels: 0, tier: 5 },
    { maxFeels: 7, tier: 4 },
    { maxFeels: 13, tier: 3 },
    { maxFeels: 18, tier: 2 },
    { maxFeels: 23, tier: 1 },
  ],
  sensitivityShift: 3, // "üşürüm" → 3° daha soğuk say, "sıcaklarım" → 3° daha sıcak say

  // Rüzgar
  coolTemp: 18, // bunun altı "serin": rüzgar kademe artırır; üstü "sıcak": esinti uyarısı
  windMean: 20, // ortalama rüzgar bu ve üstüyse rüzgarlı
  gustCool: 40, // serin havada hamle eşiği
  gustWarm: 35, // sıcak havada esinti eşiği
  // Hamle (ani rüzgar) seviyeleri, Beaufort ölçeğine göre. Parantez içi: Beyoğlu'nda 2023-2025
  // arasında günlük en sert hamlenin bu değeri geçtiği gün sayısı (Open-Meteo arşivi).
  gustNoUmbrella: 50, // "sert": şemsiye ters döner (yılda ~67 gün)
  alertGust: 62, // "çok sert": yürümek zorlaşır → gün içi uyarı (yılda ~12 gün)
  violentGust: 89, // "şiddetli fırtına": ağaç devrilir (yılda ~0 gün)

  // Yağış
  rainProb: 50, // bir saatin "yağmurlu" sayılması için olasılık…
  rainMm: 0.3, // …ve miktar
  maybeRainProb: 30, // bunun üstü "belki yağar"
  coldRainTemp: 12, // yağmur + bunun altı → ıslak soğuk, kademe +1
  heavyRainMm: 7.6, // WMO: 7.6 mm/saat üstü şiddetli yağmur

  // Aşırı hava olayları
  stormGust: 75, // "fırtına": tabela/kiremit uçar → aşırı olay (yılda ~3 gün)
  extremeHeatFeels: 38,
  extremeColdFeels: -15,

  // Diğer
  swing: 8, // pencere içi sıcaklık farkı → katmanlı giyin
  uv: 6, // güneş kremi
  yesterdayDiff: 3, // dünden fark bunun altındaysa "benzer"
  maxTierRaise: 2, // rüzgar + yağmur birlikte en fazla 2 kademe artırır…
  maxRaisedTier: 4, // …ve en fazla "mont"a çıkarır; bere/eldiven (5) sadece gerçekten dondurucu soğukta
} as const;
