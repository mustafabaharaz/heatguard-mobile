// ─── Daily Brief Engine ───────────────────────────────────────────────────────
// Synthesizes forecast, personal risk profile, acclimation progress,
// hydration status, and medication warnings into a single daily safety brief.
// Risk level and score come from the shared engine (features/risk/riskEngine)
// so the brief, Home, and alerts always agree.

import type { HeatProfile } from '../profile/storage/profileStorage';
import { assessRisk, RISK_HEADLINE, type RiskLevel, type NwsCategory, type RiskAssessment } from '../risk/riskEngine';

// Matches the actual HeatProfile boolean-field shape from profileStorage
interface ProfileInput {
  name: string;
  age: number | string;   // HeatProfile stores age as a string
  activityLevel: string;
  // boolean condition flags (real HeatProfile shape)
  isElderly?: boolean;
  hasDiabetes?: boolean;
  hasHeartDisease?: boolean;
  hasRespiratoryIssues?: boolean;
  hasKidneyDisease?: boolean;
  isObese?: boolean;
  takesMedications?: boolean;
  medications?: string[];
  // optional conditions array (used by acclimation/hydration engines)
  conditions?: string[];
}

export type BriefRiskLevel = RiskLevel;

export interface DailyBrief {
  date: string;
  /** Ring fill, 25/50/75/100 = risk level 1–4 of 4 (not a clinical score) */
  overallScore: number;
  riskLevel: BriefRiskLevel;
  nwsCategory?: NwsCategory;
  /** True if the user's CDC risk group raised the level one step */
  stepped?: boolean;
  headline: string;
  forecastHighF: number;
  forecastFeelsMaxF: number;
  forecastSummary: string;
  personalRiskNote: string;
  hydrationTargetOz: number;
  hydrationPercentComplete: number;
  acclimationDay: number | null;
  acclimationScore: number;
  medicationWarnings: number;
  topRecommendations: string[];
  generatedAt: string;
}

export interface BriefInput {
  profile: HeatProfile;
  forecastHighF: number;
  /** Today's peak feels-like; falls back to the high if missing */
  forecastFeelsMaxF?: number;
  hydrationTargetOz: number;
  hydrationPercentComplete: number;
  acclimationDay: number | null;
  acclimationScore: number;
  medicationWarnings: number;
}

// ─── Brief Generator ──────────────────────────────────────────────────────────

export function generateDailyBrief(input: BriefInput): DailyBrief {
  const { profile, forecastHighF, hydrationTargetOz, hydrationPercentComplete, acclimationDay, acclimationScore, medicationWarnings } = input;

  const feelsMaxF = Math.round(Math.max(input.forecastFeelsMaxF ?? forecastHighF, forecastHighF));
  const risk = assessRisk(feelsMaxF, profile);
  const overallScore = risk.levelNumber * 25;
  const riskLevel = risk.level;

  return {
    date: new Date().toDateString(),
    overallScore,
    riskLevel,
    nwsCategory: risk.nws,
    stepped: risk.stepped,
    headline: RISK_HEADLINE[riskLevel],
    forecastHighF,
    forecastFeelsMaxF: feelsMaxF,
    forecastSummary: buildForecastSummary(forecastHighF, feelsMaxF),
    personalRiskNote: buildPersonalNote(risk, acclimationScore),
    hydrationTargetOz,
    hydrationPercentComplete,
    acclimationDay,
    acclimationScore,
    medicationWarnings,
    topRecommendations: buildRecommendations({ forecastHighF, hydrationPercentComplete, hydrationTargetOz, medicationWarnings, acclimationDay, profile: profile as unknown as ProfileInput }).slice(0, 4),
    generatedAt: new Date().toISOString(),
  };
}

function buildForecastSummary(highF: number, feelsMaxF: number): string {
  const feels = feelsMaxF > highF + 1 ? `, feels like ${feelsMaxF}°F` : '';
  const base = `High of ${highF}°F${feels}.`;
  if (feelsMaxF >= 112) return `${base} Life-threatening heat. Avoid being outside in the afternoon.`;
  if (feelsMaxF >= 105) return `${base} Extreme heat. Keep outdoor time short.`;
  if (feelsMaxF >= 95) return `${base} Very hot. Shade, water, and breaks.`;
  if (feelsMaxF >= 85) return `${base} Hot. Normal precautions.`;
  return `${base} Manageable heat today.`;
}

/** Calm, non-alarming note. Details live on the "Your heat risk" page. */
function buildPersonalNote(risk: RiskAssessment, acclimationScore: number): string {
  if (risk.groups.includes('outdoors') && acclimationScore < 30)
    return 'You work or exercise outside and your body may not be used to the heat yet. Ease in, and see Heat acclimation in More tools.';
  if (risk.stepped) return 'Heat affects you more than most, so your level is one step above the weather alone. Take it easy today.';
  if (risk.groups.length) return 'Heat affects you more than most. Small breaks and water make a big difference.';
  return 'Your level matches the weather today. Keep your usual habits.';
}

function buildRecommendations(params: {
  forecastHighF: number; hydrationPercentComplete: number; hydrationTargetOz: number;
  medicationWarnings: number; acclimationDay: number | null; profile: ProfileInput;
}): string[] {
  const { forecastHighF, hydrationPercentComplete, hydrationTargetOz, medicationWarnings, acclimationDay, profile } = params;
  const cond = profile.conditions ?? [];
  const recs: string[] = [];

  if (hydrationPercentComplete < 20) recs.push(`Start hydrating — your ${hydrationTargetOz} oz target begins now`);
  else if (hydrationPercentComplete < 50) recs.push(`You are behind on hydration — ${hydrationTargetOz} oz goal today`);

  if (medicationWarnings > 0) recs.push(`Review ${medicationWarnings} medication heat interaction${medicationWarnings > 1 ? 's' : ''} in your profile`);

  if (acclimationDay !== null && acclimationDay >= 1 && acclimationDay <= 14)
    recs.push(`Complete Day ${acclimationDay} of your acclimation program`);

  if (forecastHighF >= 110) recs.push('Stay indoors between 10 AM and 5 PM without exception');
  else if (forecastHighF >= 100) recs.push('Stay indoors between 11 AM and 4 PM');

  const isVulnerable = (Number(profile.age) || 0) > 65 || profile.isElderly ||
    profile.hasHeartDisease || profile.hasDiabetes || cond.length > 0;
  if (forecastHighF >= 105 && isVulnerable) recs.push('Check on elderly or vulnerable neighbors today');

  if (forecastHighF >= 100) recs.push('Never leave children or pets in a parked vehicle');

  recs.push('Wear loose, light-colored, breathable clothing outdoors');
  return recs;
}

// ─── Visual Helpers ───────────────────────────────────────────────────────────

export function getRiskColor(level: BriefRiskLevel): string {
  const map: Record<BriefRiskLevel, string> = { low: '#22C55E', moderate: '#F59E0B', high: '#F97316', veryHigh: '#EF4444' };
  return map[level] ?? map.high;
}

export function getRiskGradient(level: BriefRiskLevel): readonly [string, string] {
  const map: Record<BriefRiskLevel, readonly [string, string]> = {
    low: ['#052e16', '#14532d'], moderate: ['#2d1a00', '#78350f'],
    high: ['#2d0c00', '#7c2d12'], veryHigh: ['#1a0000', '#7f1d1d'],
  };
  return map[level] ?? map.high;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const BRIEF_KEY = 'heatguard_daily_brief_v3'; // v3: NWS categories + CDC risk groups

const briefStore = {
  get: (): string | null => {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(BRIEF_KEY);
      const { MMKV } = require('../../lib/mmkvCompat'); // eslint-disable-line @typescript-eslint/no-var-requires
      return new MMKV().getString(BRIEF_KEY) ?? null;
    } catch { return null; }
  },
  set: (value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') { localStorage.setItem(BRIEF_KEY, value); return; }
      const { MMKV } = require('../../lib/mmkvCompat'); // eslint-disable-line @typescript-eslint/no-var-requires
      new MMKV().set(BRIEF_KEY, value);
    } catch {}
  },
};

export function getCachedBrief(): DailyBrief | null {
  const raw = briefStore.get();
  if (!raw) return null;
  try {
    const brief = JSON.parse(raw) as DailyBrief;
    return brief.date === new Date().toDateString() ? brief : null;
  } catch { return null; }
}

export function cacheBrief(brief: DailyBrief): void {
  briefStore.set(JSON.stringify(brief));
}
