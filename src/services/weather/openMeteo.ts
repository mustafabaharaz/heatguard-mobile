// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Open-Meteo client
// Free, keyless weather API (https://open-meteo.com). All temps in °F.
// Times are the location's local time, so hours/dates line up with the user.
// ─────────────────────────────────────────────────────────────────────────────

export interface CurrentConditions {
  tempF: number;
  feelsLikeF: number;
  humidity: number;      // %
  uvIndex: number;
  description: string;   // e.g. "Clear sky"
  isDay: boolean;
}

export interface HourlyPoint {
  time: number;          // UTC epoch ms
  dateKey: string;       // local YYYY-MM-DD
  hour: number;          // local 0–23
  tempF: number;
  feelsLikeF: number;
  humidity: number;
  uvIndex: number;
}

export interface DailyPoint {
  dateKey: string;       // local YYYY-MM-DD
  highF: number;
  lowF: number;
  feelsLikeMaxF: number;
  uvMax: number;
}

export interface WeatherSnapshot {
  fetchedAt: number;     // epoch ms when fetched
  lat: number;
  lon: number;
  locationName: string;
  isDefaultLocation: boolean;
  todayKey: string;      // local YYYY-MM-DD at fetch time
  current: CurrentConditions;
  hourly: HourlyPoint[]; // past 14 days + next ~5 days
  daily: DailyPoint[];   // past 14 days + today + next days
}

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// WMO weather codes → short description
function describe(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Mixed conditions';
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && isFinite(v) ? v : fallback;

export async function fetchOpenMeteo(
  lat: number,
  lon: number,
  locationName: string,
  isDefaultLocation: boolean,
): Promise<WeatherSnapshot> {
  const params = [
    // Rounded to ~1 km: plenty for weather, and keeps the user's exact spot private
    `latitude=${lat.toFixed(2)}`,
    `longitude=${lon.toFixed(2)}`,
    'current=temperature_2m,relative_humidity_2m,apparent_temperature,uv_index,weather_code,is_day',
    'hourly=temperature_2m,apparent_temperature,relative_humidity_2m,uv_index',
    'daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,uv_index_max',
    'temperature_unit=fahrenheit',
    'timezone=auto',
    'past_days=14',  // covers Exposure History's 14-day window
    'forecast_days=6',
  ].join('&');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}?${params}`, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = await res.json();

  const offsetMs = num(data.utc_offset_seconds) * 1000;
  const toUtc = (local: string) => Date.parse(`${local}:00Z`) - offsetMs;

  const c = data.current ?? {};
  const currentTime: string = c.time ?? new Date().toISOString().slice(0, 16);

  const h = data.hourly ?? {};
  const hourly: HourlyPoint[] = (h.time ?? []).map((t: string, i: number) => ({
    time: toUtc(t),
    dateKey: t.slice(0, 10),
    hour: parseInt(t.slice(11, 13), 10),
    tempF: num(h.temperature_2m?.[i]),
    feelsLikeF: num(h.apparent_temperature?.[i], num(h.temperature_2m?.[i])),
    humidity: num(h.relative_humidity_2m?.[i]),
    uvIndex: num(h.uv_index?.[i]),
  }));

  const d = data.daily ?? {};
  const daily: DailyPoint[] = (d.time ?? []).map((t: string, i: number) => ({
    dateKey: t,
    highF: num(d.temperature_2m_max?.[i]),
    lowF: num(d.temperature_2m_min?.[i]),
    feelsLikeMaxF: num(d.apparent_temperature_max?.[i], num(d.temperature_2m_max?.[i])),
    uvMax: num(d.uv_index_max?.[i]),
  }));

  if (typeof c.temperature_2m !== 'number' || hourly.length === 0) {
    throw new Error('Open-Meteo returned incomplete data');
  }

  return {
    fetchedAt: Date.now(),
    lat,
    lon,
    locationName,
    isDefaultLocation,
    todayKey: currentTime.slice(0, 10),
    current: {
      tempF: c.temperature_2m,
      feelsLikeF: num(c.apparent_temperature, c.temperature_2m),
      humidity: num(c.relative_humidity_2m),
      uvIndex: num(c.uv_index),
      description: describe(num(c.weather_code)),
      isDay: c.is_day === 1,
    },
    hourly,
    daily,
  };
}
