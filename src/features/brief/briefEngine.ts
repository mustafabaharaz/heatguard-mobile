// ─── Daily Brief Engine ───────────────────────────────────────────────────────
// Synthesizes forecast, personal risk profile, acclimation progress,
// hydration status, and medication warnings into a single daily safety brief.

// Matches the actual HeatProfile boolean-field shape from profileStorage
interface ProfileInput {
  name: string;
  age: number;
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

export type BriefRiskLevel = 'low' | 'moderate' | 'high' | 'extreme';

export interface DailyBrief {
  date: string;
  overallScore: number;
  riskLevel: BriefRiskLevel;
  headline: string;
  forecastHighF: number;
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
  profile: ProfileInput;
  forecastHighF: number;
  hydrationTargetOz: number;
  hydrationPercentComplete: number;
  acclimationDay: number | null;
  acclimationScore: number;
  medicationWarnings: number;
}

// ─── Risk Multiplier ──────────────────────────────────────────────────────────

function computeRiskMultiplier(profile: ProfileInput): number {
  let multiplier = 1.0;

  const age = profile.age ?? 35;
  if (age > 70) multiplier *= 1.6;
  else if (age > 65) multiplier *= 1.4;
  else if (age > 55) multiplier *= 1.2;
  else if (age < 12) multiplier *= 1.3;

  const cond = profile.conditions ?? [];
  if (profile.hasHeartDisease || cond.includes('heart_disease') || cond.includes('cardiac')) multiplier *= 1.5;
  if (profile.hasDiabetes    || cond.includes('diabetes'))      multiplier *= 1.3;
  if (profile.hasKidneyDisease || cond.includes('kidney_disease')) multiplier *= 1.25;
  if (profile.isObese        || cond.includes('obesity'))       multiplier *= 1.2;

  const activityPenalty: Record<string, number> = {
    athlete: 0.85, active: 0.9, high: 0.9,
    moderate: 1.0,
    light: 1.1, low: 1.15, sedentary: 1.2, none: 1.2,
  };
  multiplier *= activityPenalty[profile.activityLevel] ?? 1.0;

  if (profile.takesMedications || (profile.medications?.length ?? 0) > 0) multiplier *= 1.15;

  return Math.min(multiplier, 3.0);
}

// ─── Brief Generator ──────────────────────────────────────────────────────────

export function generateDailyBrief(input: BriefInput): DailyBrief {
  const { profile, forecastHighF, hydrationTargetOz, hydrationPercentComplete, acclimationDay, acclimationScore, medicationWarnings } = input;

  const riskMultiplier = computeRiskMultiplier(profile);
  const heatBase = Math.min(Math.max(Math.round(((forecastHighF - 65) / 65) * 100), 0), 100);
  const overallScore = Math.min(Math.round(heatBase * riskMultiplier), 100);

  const riskLevel: BriefRiskLevel =
    overallScore < 25 ? 'low' : overallScore < 50 ? 'moderate' : overallScore < 75 ? 'high' : 'extreme';

  const firstName = profile.name?.split(' ')[0] || 'there';
  const headlines: Record<BriefRiskLevel, string> = {
    low: `Good conditions today, ${firstName}. Stay aware.`,
    moderate: `Warm day ahead, ${firstName}. Plan outdoor time carefully.`,
    high: `High heat risk today. Limit outdoor exposure.`,
    extreme: `Extreme danger. Stay indoors if at all possible.`,
  };

  return {
    date: new Date().toDateString(),
    overallScore,
    riskLevel,
    headline: headlines[riskLevel],
    forecastHighF,
    forecastSummary: buildForecastSummary(forecastHighF),
    personalRiskNote: buildPersonalNote(profile, riskMultiplier, acclimationScore),
    hydrationTargetOz,
    hydrationPercentComplete,
    acclimationDay,
    acclimationScore,
    medicationWarnings,
    topRecommendations: buildRecommendations({ forecastHighF, hydrationPercentComplete, hydrationTargetOz, medicationWarnings, acclimationDay, profile }).slice(0, 4),
    generatedAt: new Date().toISOString(),
  };
}

function buildForecastSummary(tempF: number): string {
  if (tempF >= 115) return `High of ${tempF}°F. Catastrophic heat — all outdoor plans cancelled.`;
  if (tempF >= 110) return `High of ${tempF}°F. Life-threatening conditions. Avoid all outdoor exposure.`;
  if (tempF >= 105) return `High of ${tempF}°F. Extreme heat. Outdoor activity strongly discouraged.`;
  if (tempF >= 100) return `High of ${tempF}°F. Dangerous heat. Limit outdoor time severely.`;
  if (tempF >= 95)  return `High of ${tempF}°F. Very hot. Stay hydrated and seek shade.`;
  if (tempF >= 85)  return `High of ${tempF}°F. Hot conditions. Normal precautions apply.`;
  return `High of ${tempF}°F. Manageable heat today.`;
}

function buildPersonalNote(profile: ProfileInput, multiplier: number, acclimationScore: number): string {
  const cond = profile.conditions ?? [];
  if (profile.hasHeartDisease || cond.includes('heart_disease'))
    return 'Your heart condition significantly amplifies heat strain. Take extra precautions.';
  if ((profile.age ?? 0) > 70)
    return 'Adults over 70 are at the highest risk in extreme heat. Stay cool and hydrated.';
  if (profile.hasDiabetes || cond.includes('diabetes'))
    return "Diabetes affects your body's cooling response. Monitor yourself closely.";
  if (acclimationScore < 30)
    return `You are only ${acclimationScore}% acclimated — your body is still adapting to this heat.`;
  if (multiplier > 1.8)
    return `Your personal risk multiplier is ${multiplier.toFixed(1)}×. Extra vigilance required.`;
  return `Your risk profile is well-managed. Maintain good habits today.`;
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

  const isVulnerable = (profile.age ?? 0) > 65 || profile.isElderly ||
    profile.hasHeartDisease || profile.hasDiabetes || cond.length > 0;
  if (forecastHighF >= 105 && isVulnerable) recs.push('Check on elderly or vulnerable neighbors today');

  if (forecastHighF >= 100) recs.push('Never leave children or pets in a parked vehicle');

  recs.push('Wear loose, light-colored, breathable clothing outdoors');
  return recs;
}

// ─── Visual Helpers ───────────────────────────────────────────────────────────

export function getRiskColor(level: BriefRiskLevel): string {
  const map: Record<BriefRiskLevel, string> = { low: '#22C55E', moderate: '#F59E0B', high: '#F97316', extreme: '#EF4444' };
  return map[level];
}

export function getRiskGradient(level: BriefRiskLevel): readonly [string, string] {
  const map: Record<BriefRiskLevel, readonly [string, string]> = {
    low: ['#052e16', '#14532d'], moderate: ['#2d1a00', '#78350f'],
    high: ['#2d0c00', '#7c2d12'], extreme: ['#1a0000', '#7f1d1d'],
  };
  return map[level];
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const BRIEF_KEY = 'heatguard_daily_brief_v1';

const briefStore = {
  get: (): string | null => {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(BRIEF_KEY);
      const { MMKV } = require('react-native-mmkv'); // eslint-disable-line @typescript-eslint/no-var-requires
      return new MMKV().getString(BRIEF_KEY) ?? null;
    } catch { return null; }
  },
  set: (value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') { localStorage.setItem(BRIEF_KEY, value); return; }
      const { MMKV } = require('react-native-mmkv'); // eslint-disable-line @typescript-eslint/no-var-requires
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
