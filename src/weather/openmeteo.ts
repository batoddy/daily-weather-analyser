// Open-Meteo: ücretsiz, API anahtarı yok. Ulusal meteoroloji servislerinin
// modellerini (ECMWF, DWD ICON, NOAA GFS, MET Norway…) konuma göre harmanlıyor.

export interface Hour {
  time: string; // yerel "YYYY-MM-DDTHH:00"
  temp: number; // °C
  feels: number; // hissedilen °C (rüzgar ve nemi hesaba katar)
  precipProb: number; // %
  precip: number; // mm (o saat içinde)
  wind: number; // km/s, 10 m ortalama
  gust: number; // km/s, hamle
  code: number; // WMO hava kodu
  uv: number;
}

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const HOURLY = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "wind_speed_10m",
  "wind_gusts_10m",
  "weather_code",
  "uv_index",
] as const;

type HourlyResponse = {
  hourly: { time: string[] } & Record<(typeof HOURLY)[number], (number | null)[]>;
};

export interface Point {
  lat: number;
  lon: number;
}

/**
 * Birden fazla konum için dün + bugün + 2 gün sonrası saatlik veri (hepsi aynı yerel saatle).
 * Tek istek: ev, iş ve şehir ızgarası aynı çağrıda gelir (alt-istek sınırı için önemli).
 */
export async function fetchHoursMulti(points: Point[], timezone: string): Promise<Hour[][]> {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(","),
    longitude: points.map((p) => p.lon).join(","),
    hourly: HOURLY.join(","),
    timezone,
    past_days: "1",
    forecast_days: "3",
  });
  const data = await getJson<HourlyResponse | HourlyResponse[]>(`${FORECAST_URL}?${params}`);
  return (Array.isArray(data) ? data : [data]).map(toHours);
}

export async function fetchHours(lat: number, lon: number, timezone: string): Promise<Hour[]> {
  return (await fetchHoursMulti([{ lat, lon }], timezone))[0]!;
}

function toHours(data: HourlyResponse): Hour[] {
  const h = data.hourly;
  return h.time.map((time, i) => ({
    time,
    temp: num(h.temperature_2m[i]),
    feels: num(h.apparent_temperature[i]),
    precipProb: num(h.precipitation_probability[i]),
    precip: num(h.precipitation[i]),
    wind: num(h.wind_speed_10m[i]),
    gust: num(h.wind_gusts_10m[i]),
    code: num(h.weather_code[i]),
    uv: num(h.uv_index[i]),
  }));
}

/** Koordinatın IANA saat dilimi ("Europe/Istanbul"). */
export async function lookupTimezone(lat: number, lon: number): Promise<string> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m",
    timezone: "auto",
  });
  const data = await getJson<{ timezone: string }>(`${FORECAST_URL}?${params}`);
  return data.timezone;
}

function num(v: number | null | undefined): number {
  return typeof v === "number" ? v : 0;
}

async function getJson<T>(url: string, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${await res.text()}`);
      return (await res.json()) as T;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}
