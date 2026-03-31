// ─── Hydration Storage ────────────────────────────────────────────────────────

import { HydrationLog } from './hydrationEngine';

const STORAGE_KEY = 'heatguard_hydration_logs_v1';
const RETENTION_DAYS = 30;

const store = {
  get: (): string | null => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(STORAGE_KEY);
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { MMKV } = require('react-native-mmkv');
      return new MMKV().getString(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  },
  set: (value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, value);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { MMKV } = require('react-native-mmkv');
      new MMKV().set(STORAGE_KEY, value);
    } catch {
      // fail silently
    }
  },
};

export function getHydrationLogs(): HydrationLog[] {
  const raw = store.get();
  if (!raw) return [];
  try {
    return JSON.parse(raw) as HydrationLog[];
  } catch {
    return [];
  }
}

export function addHydrationLog(amountMl: number, note?: string): HydrationLog {
  const log: HydrationLog = {
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    amountMl,
    note,
  };

  const logs = getHydrationLogs();
  logs.push(log);

  // Prune entries older than retention window
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const pruned = logs.filter(
    (l) => new Date(l.timestamp).getTime() > cutoff,
  );

  store.set(JSON.stringify(pruned));
  return log;
}

export function removeHydrationLog(id: string): void {
  const logs = getHydrationLogs().filter((l) => l.id !== id);
  store.set(JSON.stringify(logs));
}

export function getTodayHydrationLogs(): HydrationLog[] {
  const today = new Date().toDateString();
  return getHydrationLogs().filter(
    (l) => new Date(l.timestamp).toDateString() === today,
  );
}

export function getWeeklyTotals(): { date: string; totalMl: number }[] {
  const logs = getHydrationLogs();
  const map = new Map<string, number>();

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    map.set(d.toDateString(), 0);
  }

  for (const log of logs) {
    const key = new Date(log.timestamp).toDateString();
    if (map.has(key)) {
      map.set(key, (map.get(key) ?? 0) + log.amountMl);
    }
  }

  return Array.from(map.entries()).map(([date, totalMl]) => ({ date, totalMl }));
}
