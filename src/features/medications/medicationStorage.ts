/**
 * Medication storage
 *
 * Persists the user's selected medication category IDs.
 * Stored separately from HeatProfile so we don't change that schema.
 *
 * Platform: MMKV on native, localStorage on web.
 */

import { Platform } from 'react-native';

const KEY = 'heatguard:medications:selected_categories';

function getStorage() {
  if (Platform.OS !== 'web') {
    try {
      const { MMKV } = require('react-native-mmkv');
      return new MMKV({ id: 'medication-storage' });
    } catch {}
  }
  return null;
}

function read(): string | null {
  try {
    const s = getStorage();
    if (s) return s.getString(KEY) ?? null;
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(value: string) {
  try {
    const s = getStorage();
    if (s) s.set(KEY, value);
    else localStorage.setItem(KEY, value);
  } catch {}
}

// ── API ───────────────────────────────────────────────────────────────────

export function getSelectedMedCategories(): string[] {
  try {
    const raw = read();
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function saveSelectedMedCategories(ids: string[]): void {
  write(JSON.stringify(ids));
}

export function toggleMedCategory(id: string): string[] {
  const current = getSelectedMedCategories();
  const updated = current.includes(id)
    ? current.filter(c => c !== id)
    : [...current, id];
  saveSelectedMedCategories(updated);
  return updated;
}
