// Nominatim (OpenStreetMap). Open-Meteo'nun kendi geocoding'i GeoNames tabanlı ve
// ilçelerde hatalı ("Kadıköy" → Yalova'daki köy); OSM ilçe/mahalle verisinde çok daha iyi.
// Kullanım koşulu: tanımlayıcı User-Agent + saniyede en fazla 1 istek (sadece onboarding'de çağrılıyor).

const NOMINATIM = "https://nominatim.openstreetmap.org";
const HEADERS = { "User-Agent": "daily-weather-bot/2.0 (github.com/batoddy/daily-weather-analyser)" };

export interface Place {
  label: string; // "Kadıköy, İstanbul"
  lat: number;
  lon: number;
}

interface NominatimAddress {
  [key: string]: string | undefined;
}

export async function searchPlaces(query: string, lang: string): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "4",
    addressdetails: "1",
    "accept-language": lang,
  });
  const res = await fetch(`${NOMINATIM}/search?${params}`, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const results = (await res.json()) as { lat: string; lon: string; name: string; address: NominatimAddress }[];
  const places = results.map((r) => ({
    label: searchLabel(r.name, r.address),
    lat: Number(r.lat),
    lon: Number(r.lon),
  }));
  // Aynı etiketli sonuçlar (ör. aynı mahallenin iki OSM kaydı) tek butona düşsün
  return places.filter((p, i) => places.findIndex((q) => q.label === p.label) === i);
}

export async function reverseLabel(lat: number, lon: number, lang: string): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
    zoom: "14",
    "accept-language": lang,
  });
  try {
    const res = await fetch(`${NOMINATIM}/reverse?${params}`, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: NominatimAddress };
    return data.address ? placeLabel(data.address) : null;
  } catch {
    return null;
  }
}

/** Arama sonucu etiketi: "ad, ilçe, il" (tekrarlar atılır) → "Kadıköy, İstanbul", "Kadıköy, Refahiye, Erzincan" */
export function searchLabel(name: string, a: NominatimAddress): string {
  const parts = [name, a.town ?? a.county ?? a.city_district, a.province ?? a.state ?? a.city];
  return [...new Set(parts.filter((p): p is string => !!p))].join(", ");
}

/** Adresten "ilçe, il" etiketi üretir (paylaşılan GPS konumu için). */
export function placeLabel(a: NominatimAddress): string | null {
  const local = a.town ?? a.city_district ?? a.suburb ?? a.village ?? a.municipality ?? a.county ?? a.city;
  const region = a.province ?? a.city ?? a.state ?? a.country;
  if (!local) return region ?? null;
  return region && region !== local ? `${local}, ${region}` : local;
}
