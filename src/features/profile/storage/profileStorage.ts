// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/profile/storage/profileStorage.ts
// HeatGuard · Heat Profile storage
// Adds "Who are you protecting?" answers (household fields). Older saved
// profiles load fine: missing fields fall back to the defaults below.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';

export type ActivityLevel = 'low' | 'medium' | 'high';

export interface HeatProfile {
  name: string;
  age: string;
  activityLevel: ActivityLevel;
  alertThreshold: number;
  hasDiabetes: boolean;
  hasHeartDisease: boolean;
  hasRespiratoryIssues: boolean;
  isElderly: boolean;
  takesMedications: boolean;
  profileComplete: boolean;
  // ── Household ("Who are you protecting?") ──
  drivesWithKids: boolean;
  drivesWithPets: boolean;
  worksOutdoors: boolean;
  livesAlone: boolean;
  householdAnswered: boolean;
}

export type HouseholdAnswers = Pick<
  HeatProfile,
  'drivesWithKids' | 'drivesWithPets' | 'worksOutdoors' | 'livesAlone'
>;

const DEFAULT_PROFILE: HeatProfile = {
  name: '',
  age: '',
  activityLevel: 'medium',
  alertThreshold: 35,
  hasDiabetes: false,
  hasHeartDisease: false,
  hasRespiratoryIssues: false,
  isElderly: false,
  takesMedications: false,
  profileComplete: false,
  drivesWithKids: false,
  drivesWithPets: false,
  worksOutdoors: false,
  livesAlone: false,
  householdAnswered: false,
};

const KEY = 'heatguard_heat_profile';

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

export function saveHeatProfile(p: HeatProfile) {
  const d = JSON.stringify(p);
  const s = getStorage();
  if (s) s.set(KEY, d);
  else {
    try { localStorage.setItem(KEY, d); } catch {}
  }
}

export function getHeatProfile(): HeatProfile {
  try {
    const s = getStorage();
    let d: string | null = null;
    if (s) d = s.getString(KEY) ?? null;
    else d = localStorage.getItem(KEY);
    if (d) return { ...DEFAULT_PROFILE, ...JSON.parse(d) };
  } catch {}
  return { ...DEFAULT_PROFILE };
}

export function clearHeatProfile() {
  const s = getStorage();
  if (s) s.delete(KEY);
  else {
    try { localStorage.removeItem(KEY); } catch {}
  }
}

/** Save only the household answers, keeping the rest of the profile as is. */
export function saveHouseholdAnswers(answers: HouseholdAnswers) {
  saveHeatProfile({ ...getHeatProfile(), ...answers, householdAnswered: true });
}

/** True if kids or pets ever ride in the user's car. */
export function hasVehicleDependents(p: HeatProfile): boolean {
  return p.drivesWithKids || p.drivesWithPets;
}

export function getRiskMultiplier(p: HeatProfile): number {
  let m = 1.0;
  if (p.isElderly) m += 0.3;
  if (p.hasDiabetes) m += 0.2;
  if (p.hasHeartDisease) m += 0.25;
  if (p.hasRespiratoryIssues) m += 0.2;
  if (p.takesMedications) m += 0.15;
  if (p.activityLevel === 'high') m += 0.2;
  if (p.activityLevel === 'low') m -= 0.1;
  return Math.min(m, 2.0);
}
