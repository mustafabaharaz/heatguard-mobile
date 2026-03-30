// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Forecast Storage
// Persists the user's last-viewed forecast day so the screen reopens where
// they left off. Uses MMKV on native and localStorage on web.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';

const KEYS = {
  LAST_DAY: 'forecast_last_viewed_day',
  GENERATED_AT: 'forecast_generated_at',
} as const;

// ── Storage adapter ────────────────────────────────────────────────────────

let nativeStorage: { set(k: string, v: string): void; getString(k: string): string | undefined } | null = null;

if (Platform.OS !== 'web') {
  try {
    const { MMKV } = require('react-native-mmkv');
    nativeStorage = new MMKV({ id: 'forecast-storage' });
  } catch {
    // MMKV unavailable — will fall through to web path
  }
}

function setItem(key: string, value: string): void {
  if (nativeStorage) {
    nativeStorage.set(key, value);
  } else if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(key, value); } catch { /* quota exceeded / SSR */ }
  }
}

function getItem(key: string): string | null {
  if (nativeStorage) {
    return nativeStorage.getString(key) ?? null;
  }
  if (typeof window !== 'undefined') {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Persist which forecast day (0–4) the user was last viewing. */
export function saveLastViewedDay(dayIndex: number): void {
  setItem(KEYS.LAST_DAY, String(dayIndex));
  setItem(KEYS.GENERATED_AT, String(Date.now()));
}

/** Retrieve the last-viewed day index (defaults to 0 = Today). */
export function getLastViewedDay(): number {
  const raw = getItem(KEYS.LAST_DAY);
  if (!raw) return 0;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), 4);
}

/**
 * How stale the last forecast is, in milliseconds.
 * Returns Infinity if no timestamp is stored.
 */
export function getForecastAge(): number {
  const ts = getItem(KEYS.GENERATED_AT);
  if (!ts) return Infinity;
  const parsed = parseInt(ts, 10);
  return isNaN(parsed) ? Infinity : Date.now() - parsed;
}

/** True if the cached forecast is older than 1 hour. */
export function isForecastStale(): boolean {
  return getForecastAge() > 60 * 60 * 1000;
}
