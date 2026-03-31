/**
 * src/features/preparedness/preparednessStorage.ts
 * Persists which checklist actions the user has completed.
 * Platform: MMKV on native, localStorage on web.
 */

import { Platform } from 'react-native';

const KEY = 'heatguard:preparedness:completed_actions';

function getStorage() {
  if (Platform.OS !== 'web') {
    try {
      const { MMKV } = require('react-native-mmkv');
      return new MMKV({ id: 'preparedness-storage' });
    } catch {}
  }
  return null;
}

function read(): string | null {
  try {
    const s = getStorage();
    if (s) return s.getString(KEY) ?? null;
    return localStorage.getItem(KEY);
  } catch { return null; }
}

function write(v: string) {
  try {
    const s = getStorage();
    if (s) s.set(KEY, v);
    else localStorage.setItem(KEY, v);
  } catch {}
}

export function getCompletedActions(): string[] {
  try {
    const raw = read();
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function toggleActionCompleted(id: string): string[] {
  const current = getCompletedActions();
  const updated = current.includes(id)
    ? current.filter(i => i !== id)
    : [...current, id];
  write(JSON.stringify(updated));
  return updated;
}

export function clearCompletedActions(): void {
  try {
    const s = getStorage();
    if (s) s.delete(KEY);
    else localStorage.removeItem(KEY);
  } catch {}
}
