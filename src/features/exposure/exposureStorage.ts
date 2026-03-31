/**
 * Exposure session storage.
 *
 * Persists the currently-active exposure tracking session so it survives
 * app restarts and background interruptions.
 *
 * Platform: MMKV on native, localStorage on web.
 */

import { Platform } from 'react-native';

const KEY = 'heatguard:exposure:active_session';

export interface ExposureSession {
  sessionStart: number;
  sessionMinutes: number;
  weightedMinutes: number;
  safeLimit: number;
  lastTickAt: number;
  currentTempF: number;
}

// ── MMKV (native) / localStorage (web) ───────────────────────────────────

let storage: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void };

if (Platform.OS === 'web') {
  storage = {
    getItem: (k) => {
      try { return localStorage.getItem(k); } catch { return null; }
    },
    setItem: (k, v) => {
      try { localStorage.setItem(k, v); } catch {}
    },
    removeItem: (k) => {
      try { localStorage.removeItem(k); } catch {}
    },
  };
} else {
  try {
    const { MMKV } = require('react-native-mmkv');
    const mmkv = new MMKV({ id: 'exposure-storage' });
    storage = {
      getItem: (k) => mmkv.getString(k) ?? null,
      setItem: (k, v) => mmkv.set(k, v),
      removeItem: (k) => mmkv.delete(k),
    };
  } catch {
    // Fallback: in-memory (dev / jest)
    const mem: Record<string, string> = {};
    storage = {
      getItem: (k) => mem[k] ?? null,
      setItem: (k, v) => { mem[k] = v; },
      removeItem: (k) => { delete mem[k]; },
    };
  }
}

// ── API ───────────────────────────────────────────────────────────────────

/** Save the current active session. Pass null to clear. */
export async function saveExposureSession(session: ExposureSession | null): Promise<void> {
  if (session === null) {
    storage.removeItem(KEY);
  } else {
    storage.setItem(KEY, JSON.stringify(session));
  }
}

/** Load the last persisted session. Returns null if none exists. */
export async function loadCurrentSession(): Promise<ExposureSession | null> {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExposureSession;
  } catch {
    return null;
  }
}
