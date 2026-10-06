// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/profile/storage/dependentsStorage.ts   (NEW FILE)
// HeatGuard · Dependents ("Who I'm protecting")
// Kids, pets and older adults the user looks after. Stored only on this phone.
// Keeps the household flags in the Heat Profile in sync, so vehicle
// reminders and Home tiles always match the list.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import { getHeatProfile, saveHeatProfile } from './profileStorage';

export type DependentKind = 'child' | 'pet' | 'adult';

export interface Dependent {
  id: string;
  name: string;
  kind: DependentKind;
  ridesInCar: boolean;
}

export const KIND_LABEL: Record<DependentKind, string> = {
  child: 'Child',
  pet: 'Pet',
  adult: 'Older adult',
};

const KEY = 'heatguard_dependents_v1';

let storage: any = null;
function getStorage() {
  if (storage) return storage;
  if (Platform.OS !== 'web') {
    try {
      const { MMKV } = require('../../../lib/mmkvCompat');
      storage = new MMKV({ id: 'profile-storage' });
    } catch {
      storage = null;
    }
  }
  return storage;
}

export function getDependents(): Dependent[] {
  try {
    const s = getStorage();
    const raw = s ? s.getString(KEY) : typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? (JSON.parse(raw) as Dependent[]) : [];
  } catch {
    return [];
  }
}

function save(list: Dependent[]) {
  const d = JSON.stringify(list);
  try {
    const s = getStorage();
    if (s) s.set(KEY, d);
    else if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, d);
  } catch {}
  syncHousehold(list);
}

/** Kids/pets riding in the car drive the household flags used across the app. */
function syncHousehold(list: Dependent[]) {
  if (list.length === 0) return; // keep whatever the user answered by hand
  const p = getHeatProfile();
  saveHeatProfile({
    ...p,
    drivesWithKids: list.some(d => d.kind === 'child' && d.ridesInCar),
    drivesWithPets: list.some(d => d.kind === 'pet' && d.ridesInCar),
    householdAnswered: true,
  });
}

export function addDependent(name: string, kind: DependentKind, ridesInCar: boolean): Dependent[] {
  const list = getDependents();
  list.push({
    id: `dep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    kind,
    ridesInCar,
  });
  save(list);
  return list;
}

export function updateDependent(id: string, changes: Partial<Omit<Dependent, 'id'>>): Dependent[] {
  const list = getDependents().map(d => (d.id === id ? { ...d, ...changes } : d));
  save(list);
  return list;
}

export function removeDependent(id: string): Dependent[] {
  const list = getDependents().filter(d => d.id !== id);
  save(list);
  if (list.length === 0) {
    // Last one removed: nobody rides along anymore
    const p = getHeatProfile();
    saveHeatProfile({ ...p, drivesWithKids: false, drivesWithPets: false });
  }
  return list;
}

/** Names of everyone who rides in the car. */
export function carRiderNames(): string[] {
  return getDependents().filter(d => d.ridesInCar).map(d => d.name).filter(Boolean);
}

/** "Ayla", "Ayla and Max", "Ayla, Max and Leo" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
