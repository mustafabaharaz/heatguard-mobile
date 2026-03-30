// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Exposure Storage
// Thin adapter that reads check-in history from the existing checkInStorage
// and exposes it to the intelligence layer without coupling the namespaces.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';

const CHECKINS_KEY = 'check_in_records';

// ── Storage adapter (mirrors existing checkInStorage pattern) ──────────────

function storageGet(key: string): string | null {
  if (Platform.OS === 'web') {
    try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; }
    catch { return null; }
  }
  try {
    const { MMKV } = require('react-native-mmkv');
    const s = new MMKV();
    return s.getString(key) ?? null;
  } catch { return null; }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns raw check-in records from storage.
 * Timestamps are normalised to Date objects.
 * Returns an empty array (not null) if storage is empty.
 */
export function loadCheckInsForExposure(): Array<{
  residentId?: string;
  timestamp: Date;
  temperature?: number;
  status?: string;
  [key: string]: unknown;
}> {
  const raw = storageGet(CHECKINS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r: Record<string, unknown>) => ({
      ...r,
      timestamp: new Date(r.timestamp as string | number),
    }));
  } catch {
    return [];
  }
}
