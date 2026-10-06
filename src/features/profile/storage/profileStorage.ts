// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/profile/storage/profileStorage.ts
// HeatGuard · Heat Profile storage
//  - "Home & lifestyle" answers (car riders, outdoor work, living alone,
//    age 65+, heat-sensitive health condition)
//  - "Home surroundings" answers (AC yes/no, reliable?, turned off to save)
// Older saved profiles load fine: missing fields fall back to the defaults.
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
  // ── Home & lifestyle ──
  drivesWithKids: boolean;
  drivesWithPets: boolean;
  worksOutdoors: boolean;
  livesAlone: boolean;
  /** Onboarding shortcut: "heart, lung or diabetes condition" (details live in Heat profile). */
  healthConcern: boolean;
  householdAnswered: boolean;
  // ── Home surroundings ──
  noAC: boolean;
  acUnreliable: boolean;
  /** "I sometimes turn the AC off to save on bills." */
  acOffToSave: boolean;
  homeAnswered: boolean;
}

export type HouseholdAnswers = Pick<
  HeatProfile,
  'drivesWithKids' | 'drivesWithPets' | 'worksOutdoors' | 'livesAlone' | 'isElderly' | 'healthConcern'
>;

export type HomeAnswers = Pick<HeatProfile, 'noAC' | 'acUnreliable' | 'acOffToSave'>;

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
  healthConcern: false,
  householdAnswered: false,
  noAC: false,
  acUnreliable: false,
  acOffToSave: false,
  homeAnswered: false,
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
    if (d) {
      const p: HeatProfile = { ...DEFAULT_PROFILE, ...JSON.parse(d) };
      // Profiles saved before "Home surroundings" existed: an AC answer counts
      if (!p.homeAnswered && (p.noAC || p.acUnreliable)) p.homeAnswered = true;
      return p;
    }
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

// ── Home & lifestyle ──────────────────────────────────────────────────────────

export function getHouseholdAnswers(p: HeatProfile = getHeatProfile()): HouseholdAnswers {
  return {
    drivesWithKids: p.drivesWithKids,
    drivesWithPets: p.drivesWithPets,
    worksOutdoors: p.worksOutdoors,
    livesAlone: p.livesAlone,
    isElderly: p.isElderly,
    healthConcern: p.healthConcern,
  };
}

/** Save only the household answers, keeping the rest of the profile as is. */
export function saveHouseholdAnswers(answers: HouseholdAnswers) {
  saveHeatProfile({ ...getHeatProfile(), ...answers, householdAnswered: true });
}

// ── Home surroundings ─────────────────────────────────────────────────────────

export function getHomeAnswers(p: HeatProfile = getHeatProfile()): HomeAnswers {
  return { noAC: p.noAC, acUnreliable: p.acUnreliable, acOffToSave: p.acOffToSave };
}

/** Save only the home answers, keeping the rest of the profile as is. */
export function saveHomeAnswers(answers: HomeAnswers) {
  const clean: HomeAnswers = answers.noAC
    ? { noAC: true, acUnreliable: false, acOffToSave: false }
    : answers;
  saveHeatProfile({ ...getHeatProfile(), ...clean, homeAnswered: true });
}

// ── Derived flags ─────────────────────────────────────────────────────────────

/** True if kids or pets ever ride in the user's car. */
export function hasVehicleDependents(p: HeatProfile): boolean {
  return p.drivesWithKids || p.drivesWithPets;
}

/** True if home cooling can't be counted on (no AC, unreliable, or turned off to save). */
export function hasCoolingRisk(p: HeatProfile): boolean {
  return p.noAC || p.acUnreliable || p.acOffToSave;
}

/** Any heat-sensitive health condition. */
export function hasHealthCondition(p: HeatProfile): boolean {
  return p.healthConcern || p.hasDiabetes || p.hasHeartDisease || p.hasRespiratoryIssues;
}

/** Older adults, people living alone, and people with health conditions get the home questions. */
export function isHomeVulnerable(p: HeatProfile): boolean {
  return p.isElderly || p.livesAlone || hasHealthCondition(p);
}

/** Who gets the safety check inside the daily check-in by default. */
export function needsSafetyCheck(p: HeatProfile): boolean {
  return isHomeVulnerable(p) || hasCoolingRisk(p);
}

/**
 * Personal heat-risk factor (1.0 = typical adult, max 2.0).
 * The single source used by the shared risk engine (features/risk/riskEngine)
 * and by the forecast, planner, exposure and preparedness screens.
 */
export function getRiskMultiplier(p: HeatProfile): number {
  let m = 1.0;
  const age = Number(p.age);
  if (age >= 75) m += 0.4;
  else if (p.isElderly || age >= 65) m += 0.3;
  if (p.hasDiabetes) m += 0.2;
  if (p.hasHeartDisease) m += 0.25;
  if (p.hasRespiratoryIssues) m += 0.2;
  if (p.healthConcern && !p.hasDiabetes && !p.hasHeartDisease && !p.hasRespiratoryIssues) m += 0.2;
  if (p.takesMedications) m += 0.15;
  if (p.activityLevel === 'high') m += 0.2;
  else if (p.worksOutdoors) m += 0.15;
  if (p.noAC) m += 0.25;
  else if (p.acUnreliable || p.acOffToSave) m += 0.1;
  return Math.min(m, 2.0);
}
