// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/risk/riskEngine.ts
// HeatGuard · Shared heat-risk engine (v2: NWS categories + CDC risk groups)
// One answer to "how risky is today's heat for me?", used by Home, the Daily
// brief, and the "Your heat risk" explainer page (app/risk/index.tsx).
//
// 1. Weather level — from today's peak feels-like temperature, using the
//    National Weather Service heat index categories:
//        below 80°F            → Low
//        80–89°F   Caution     → Moderate
//        90–102°F  Extreme caution → High
//        103°F+    Danger / Extreme danger → Very high
// 2. Personal step — if the profile puts the user in any CDC higher-risk
//    group (65+, chronic condition, heat-sensitive medicines, hard outdoor
//    work, no reliable AC, living alone), the level goes up ONE step.
//    NWS notes heat-sensitive groups need to act below the general
//    thresholds; "one step" is HeatGuard's simplification, stated as such
//    on the explainer page.
// 3. The ring shows the level (1–4 of 4), not a made-up score.
// Not a medical device. Wording on app/risk/index.tsx must match this file.
// ─────────────────────────────────────────────────────────────────────────────

import type { HeatProfile } from '../profile/storage/profileStorage';
import type { WeatherSnapshot } from '../../services/weather/weatherStore';
import { getTodayKey } from '../../services/weather/weatherStore';

export type RiskLevel = 'low' | 'moderate' | 'high' | 'veryHigh';
export type NwsCategory = 'none' | 'caution' | 'extremeCaution' | 'danger' | 'extremeDanger';

export const LEVELS: RiskLevel[] = ['low', 'moderate', 'high', 'veryHigh'];

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  veryHigh: 'Very high',
};

export const NWS_LABEL: Record<NwsCategory, string> = {
  none: 'Below caution',
  caution: 'Caution',
  extremeCaution: 'Extreme caution',
  danger: 'Danger',
  extremeDanger: 'Extreme danger',
};

/** NWS heat index categories (°F) with their official health wording, paraphrased plainly. */
export const NWS_BANDS: { category: NwsCategory; range: string; meaning: string }[] = [
  { category: 'caution', range: '80–89°F', meaning: 'Fatigue possible with long exposure or activity.' },
  { category: 'extremeCaution', range: '90–102°F', meaning: 'Heat cramps, heat exhaustion, or heat stroke possible with long exposure or activity.' },
  { category: 'danger', range: '103–124°F', meaning: 'Heat cramps or exhaustion likely; heat stroke possible with long exposure or activity.' },
  { category: 'extremeDanger', range: '125°F+', meaning: 'Heat stroke highly likely.' },
];

export type RiskGroup = 'age' | 'condition' | 'medicines' | 'outdoors' | 'cooling' | 'alone';

export const GROUP_LABEL: Record<RiskGroup, string> = {
  age: 'Age 65 or older',
  condition: 'A heart, lung, kidney, or diabetes condition',
  medicines: 'Daily medicines, some of which affect how the body handles heat',
  outdoors: 'Hard work or exercise outdoors',
  cooling: "Home AC that isn't always on or reliable",
  alone: 'Living alone, so help may be slower to arrive',
};

export interface RiskAssessment {
  level: RiskLevel;
  weatherLevel: RiskLevel;   // before the personal step
  nws: NwsCategory;
  groups: RiskGroup[];
  stepped: boolean;          // true if the personal step raised the level
  feelsLikeF: number;
  /** 1–4, for the ring */
  levelNumber: number;
}

export function nwsCategory(feelsF: number): NwsCategory {
  if (feelsF >= 125) return 'extremeDanger';
  if (feelsF >= 103) return 'danger';
  if (feelsF >= 90) return 'extremeCaution';
  if (feelsF >= 80) return 'caution';
  return 'none';
}

const NWS_TO_LEVEL: Record<NwsCategory, RiskLevel> = {
  none: 'low',
  caution: 'moderate',
  extremeCaution: 'high',
  danger: 'veryHigh',
  extremeDanger: 'veryHigh',
};

export function riskGroups(p: HeatProfile): RiskGroup[] {
  const g: RiskGroup[] = [];
  const age = Number(p.age);
  if (p.isElderly || age >= 65) g.push('age');
  if (p.hasHeartDisease || p.hasDiabetes || p.hasRespiratoryIssues || p.healthConcern) g.push('condition');
  if (p.takesMedications) g.push('medicines');
  if (p.worksOutdoors || p.activityLevel === 'high') g.push('outdoors');
  if (p.noAC || p.acUnreliable || p.acOffToSave) g.push('cooling');
  if (p.livesAlone) g.push('alone');
  return g;
}

export function assessRisk(feelsLikeF: number, profile: HeatProfile): RiskAssessment {
  const nws = nwsCategory(feelsLikeF);
  const weatherLevel = NWS_TO_LEVEL[nws];
  const groups = riskGroups(profile);
  const idx = LEVELS.indexOf(weatherLevel);
  const finalIdx = groups.length ? Math.min(idx + 1, LEVELS.length - 1) : idx;
  const level = LEVELS[finalIdx];
  return {
    level,
    weatherLevel,
    nws,
    groups,
    stepped: finalIdx > idx,
    feelsLikeF: Math.round(feelsLikeF),
    levelNumber: finalIdx + 1,
  };
}

/** Today's peak feels-like (°F), or null if the forecast isn't loaded. */
export function getTodayPeakFeelsF(s: WeatherSnapshot | null): number | null {
  if (!s) return null;
  const key = getTodayKey(s);
  const today = s.daily.find(d => d.dateKey === key);
  if (!today) return null;
  return Math.round(Math.max(today.feelsLikeMaxF, today.highF));
}

/** Today's risk: peak feels-like when known, otherwise the current reading. */
export function assessToday(s: WeatherSnapshot | null, profile: HeatProfile): RiskAssessment | null {
  const peak = getTodayPeakFeelsF(s);
  const feels = peak ?? (s ? s.current.feelsLikeF : null);
  return feels === null ? null : assessRisk(feels, profile);
}

/** One calm, specific line of advice for the day. */
export const RISK_HEADLINE: Record<RiskLevel, string> = {
  low: 'A comfortable day. Stay aware as it warms up.',
  moderate: 'A warm day. Plan time outside for the morning or evening.',
  high: 'High heat risk today. Limit time outside and keep water close.',
  veryHigh: 'Dangerous heat for you today. Stay somewhere cool this afternoon.',
};

/** Plain meaning of each app level, for the explainer page. */
export const LEVEL_MEANING: Record<RiskLevel, string> = {
  low: 'Below the NWS caution range. Normal care.',
  moderate: 'NWS Caution. Take breaks, drink water.',
  high: 'NWS Extreme caution. Limit time outside, especially midday.',
  veryHigh: 'NWS Danger or worse. Stay somewhere cool in the afternoon.',
};
