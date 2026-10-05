// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Weather store
// One shared, cached weather snapshot for the whole app.
//  - Fetches from Open-Meteo using the device location (Tempe fallback, labelled).
//  - Persists the last good snapshot so the app has real (if older) data offline.
//  - Never invents numbers: if nothing has ever loaded, snapshot is null.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { fetchOpenMeteo, type WeatherSnapshot, type HourlyPoint } from './openMeteo';

export type { WeatherSnapshot, HourlyPoint } from './openMeteo';

const STORAGE_KEY = 'heatguard_weather_snapshot_v1';
const FRESH_MS = 15 * 60 * 1000;
const DEFAULT_LOCATION = { lat: 33.4255, lon: -111.94, name: 'Tempe, AZ' };

/** Used only where a number is unavoidable before weather has ever loaded. */
export const FALLBACK_TEMP_F = 100;

let snapshot: WeatherSnapshot | null = null;
let loading = false;
let error: string | null = null;
let inflight: Promise<WeatherSnapshot | null> | null = null;
let hydratePromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

export function subscribeWeather(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getWeatherSnapshot(): WeatherSnapshot | null {
  return snapshot;
}

export function getWeatherState() {
  return { snapshot, loading, error };
}

/** Load the last saved snapshot from disk (once). */
export function hydrateWeather(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && !snapshot) {
          snapshot = JSON.parse(raw) as WeatherSnapshot;
          emit();
        }
      } catch {
        // ignore corrupt cache
      }
    })();
  }
  return hydratePromise;
}

async function resolveLocation(): Promise<{ lat: number; lon: number; name: string; isDefault: boolean }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { ...DEFAULT_LOCATION, name: `${DEFAULT_LOCATION.name} (default)`, isDefault: true };
    }
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    let name = 'Your location';
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      const city = place?.city ?? place?.subregion ?? place?.district;
      const parts = [city, place?.region].filter(Boolean);
      if (parts.length) name = parts.join(', ');
    } catch {
      // reverse geocoding is optional
    }
    return { lat, lon, name, isDefault: false };
  } catch {
    return { ...DEFAULT_LOCATION, name: `${DEFAULT_LOCATION.name} (default)`, isDefault: true };
  }
}

/**
 * Refresh weather. Skips the network if the current snapshot is fresh,
 * unless force = true. Concurrent callers share one request.
 */
export async function refreshWeather(force = false): Promise<WeatherSnapshot | null> {
  await hydrateWeather();
  if (!force && snapshot && Date.now() - snapshot.fetchedAt < FRESH_MS) return snapshot;
  if (inflight) return inflight;

  loading = true;
  emit();

  inflight = (async () => {
    try {
      const loc = await resolveLocation();
      const next = await fetchOpenMeteo(loc.lat, loc.lon, loc.name, loc.isDefault);
      snapshot = next;
      error = null;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    } catch (e) {
      console.warn('Weather refresh failed:', e);
      error = 'Unable to load weather';
      return snapshot; // keep the last good data
    } finally {
      loading = false;
      inflight = null;
      emit();
    }
  })();

  return inflight;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export const fToC = (f: number) => ((f - 32) * 5) / 9;

/**
 * "Today" as a local YYYY-MM-DD key. Uses the later of the snapshot's date and
 * the device's date, so an older cached snapshot never shows yesterday as today.
 */
export function getTodayKey(s: WeatherSnapshot): string {
  const now = new Date();
  const device = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return device > s.todayKey ? device : s.todayKey;
}

/** Today's forecast high (°F) at the snapshot's location. */
export function getTodayHighF(s: WeatherSnapshot | null): number | null {
  if (!s) return null;
  const todayKey = getTodayKey(s);
  const today = s.daily.find(d => d.dateKey === todayKey);
  return today ? Math.round(today.highF) : null;
}

/** Hourly points for one local date, sorted by hour. */
export function getHoursForDate(s: WeatherSnapshot, dateKey: string): HourlyPoint[] {
  return s.hourly.filter(h => h.dateKey === dateKey).sort((a, b) => a.hour - b.hour);
}

/** Local date keys from today onward (today first). */
export function getUpcomingDateKeys(s: WeatherSnapshot, count: number): string[] {
  const todayKey = getTodayKey(s);
  return s.daily.map(d => d.dateKey).filter(k => k >= todayKey).slice(0, count);
}

/** Minutes since the snapshot was fetched. */
export function snapshotAgeMinutes(s: WeatherSnapshot): number {
  return Math.max(0, Math.round((Date.now() - s.fetchedAt) / 60000));
}
