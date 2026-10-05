// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Forecast Engine
// Generates a 5-day personalised heat forecast, factoring in the user's
// heat profile to produce adjusted risk levels and actionable directives.
// ─────────────────────────────────────────────────────────────────────────────

import type { HeatProfile } from '../profile/storage/profileStorage';
import {
  getWeatherSnapshot,
  getHoursForDate,
  getUpcomingDateKeys,
  type WeatherSnapshot,
} from '../../services/weather/weatherStore';

export type ThermalLevel = 'safe' | 'caution' | 'highAlert' | 'extreme' | 'crisis';

export interface HourlyData {
  hour: number;          // 0–23
  temp: number;          // base temperature °F
  effectiveTemp: number; // personalised apparent temperature °F
  level: ThermalLevel;
}

export interface DayForecast {
  index: number;
  date: Date;
  dayLabel: string;   // "Today", "Tomorrow", "Wed"
  dateLabel: string;  // "Jun 15"
  highTemp: number;
  lowTemp: number;
  peakLevel: ThermalLevel;
  hourly: HourlyData[]; // hours 5–22 (5 AM–10 PM)
  dangerStart: number | null;
  dangerEnd: number | null;
  safeStart: number | null;
  safeEnd: number | null;
  directive: string;
  personalizedTip: string;
}

// ── Loose profile type (mirrors Phase 1 HeatProfile) ──────────────────────

export interface ProfileInput {
  name?: string;
  age?: number;
  activityLevel?: 'low' | 'moderate' | 'high';
  threshold?: number;
  conditions?: string[];
  medications?: string[];
}

/**
 * Accepts either the real HeatProfile (flat boolean flags, age as string)
 * or a ProfileInput, and returns a clean ProfileInput.
 */
export function normalizeProfile(p: ProfileInput | HeatProfile | null | undefined): ProfileInput {
  if (!p) return {};
  if ('hasDiabetes' in p) {
    const hp = p as HeatProfile;
    const parsedAge = parseInt(String(hp.age), 10);
    return {
      name: hp.name,
      age: Number.isFinite(parsedAge) ? parsedAge : hp.isElderly ? 65 : undefined,
      activityLevel: hp.activityLevel === 'medium' ? 'moderate' : hp.activityLevel,
      threshold: hp.alertThreshold,
      conditions: [
        ...(hp.hasHeartDisease ? ['heart disease'] : []),
        ...(hp.hasDiabetes ? ['diabetes'] : []),
        ...(hp.hasRespiratoryIssues ? ['respiratory'] : []),
      ],
      medications: hp.takesMedications ? ['yes'] : [],
    };
  }
  return p as ProfileInput;
}

// ── Risk Multiplier ────────────────────────────────────────────────────────

/**
 * Converts a heat profile into a risk multiplier (1.0 = baseline).
 * Each 0.1 above 1.0 adds ~2 °F of effective temperature in the engine.
 */
export function getRiskMultiplierFromProfile(profile: ProfileInput): number {
  let m = 1.0;

  const age = profile.age ?? 35;
  if (age >= 65) m += 0.30;
  else if (age >= 50) m += 0.15;
  if (age <= 12) m += 0.25;

  if (profile.activityLevel === 'high') m += 0.20;
  if (profile.activityLevel === 'low') m -= 0.05;

  const conds = profile.conditions ?? [];
  if (conds.some(c => /heart|cardiac/i.test(c))) m += 0.30;
  if (conds.some(c => /diabetes/i.test(c))) m += 0.25;
  if (conds.some(c => /respiratory|asthma|copd/i.test(c))) m += 0.20;
  if (conds.some(c => /kidney/i.test(c))) m += 0.20;
  if (conds.some(c => /obesity/i.test(c))) m += 0.15;

  if ((profile.medications ?? []).length > 0) m += 0.10;

  return parseFloat(Math.min(Math.max(m, 0.8), 2.2).toFixed(2));
}

// ── Thermal level thresholds ───────────────────────────────────────────────

function effectiveToLevel(effectiveTemp: number): ThermalLevel {
  if (effectiveTemp < 90) return 'safe';
  if (effectiveTemp < 100) return 'caution';
  if (effectiveTemp < 105) return 'highAlert';
  if (effectiveTemp < 110) return 'extreme';
  return 'crisis';
}

const LEVEL_ORDER: ThermalLevel[] = ['safe', 'caution', 'highAlert', 'extreme', 'crisis'];

function maxLevel(levels: ThermalLevel[]): ThermalLevel {
  return levels.reduce((max, l) =>
    LEVEL_ORDER.indexOf(l) > LEVEL_ORDER.indexOf(max) ? l : max,
    'safe' as ThermalLevel,
  );
}

// ── Hour labelling ─────────────────────────────────────────────────────────

export function hourToLabel(hour: number, short = false): string {
  if (short) {
    if (hour === 0) return '12A';
    if (hour < 12) return `${hour}A`;
    if (hour === 12) return '12P';
    return `${hour - 12}P`;
  }
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

// ── Hourly data (real forecast) ─────────────────────────────────────────

/**
 * Builds 5 AM–10 PM hourly rows for one day from real forecast data.
 * The danger metric is the higher of air temp and feels-like temp, so humid
 * days are never under-rated; the profile multiplier then shifts it.
 */
function buildHourly(snapshot: WeatherSnapshot, dateKey: string, riskMultiplier: number): HourlyData[] {
  return getHoursForDate(snapshot, dateKey)
    .filter(h => h.hour >= 5 && h.hour <= 22)
    .map(h => {
      const base = Math.max(h.tempF, h.feelsLikeF);
      const effectiveTemp = Math.round(base + (riskMultiplier - 1.0) * 20);
      return {
        hour: h.hour,
        temp: Math.round(h.tempF),
        effectiveTemp,
        level: effectiveToLevel(effectiveTemp),
      };
    });
}

// ── Window detection ───────────────────────────────────────────────────────

function findDangerWindow(hourly: HourlyData[]): { start: number; end: number } | null {
  const dangerous = hourly.filter(h => h.level === 'extreme' || h.level === 'crisis');
  if (dangerous.length === 0) return null;
  return { start: dangerous[0].hour, end: dangerous[dangerous.length - 1].hour };
}

function findSafeWindow(hourly: HourlyData[]): { start: number; end: number } | null {
  const safe = (h: HourlyData) => h.level === 'safe' || h.level === 'caution';
  // Prefer morning window (lower UV, cooler)
  const morning = hourly.filter(h => h.hour <= 10 && safe(h));
  if (morning.length >= 2) {
    return { start: morning[0].hour, end: morning[morning.length - 1].hour };
  }
  // Fallback: evening window
  const evening = hourly.filter(h => h.hour >= 18 && safe(h));
  if (evening.length >= 2) {
    return { start: evening[0].hour, end: evening[evening.length - 1].hour };
  }
  return null;
}

// ── Directive builder ──────────────────────────────────────────────────────

function buildDirective(
  danger: { start: number; end: number } | null,
  safe: { start: number; end: number } | null,
  peak: ThermalLevel,
): string {
  if (peak === 'crisis') {
    return danger
      ? `Stay indoors ${hourToLabel(danger.start)}–${hourToLabel(danger.end)}`
      : 'Life-threatening heat — stay indoors all day';
  }
  if (peak === 'extreme') {
    return safe
      ? `Outdoors only ${hourToLabel(safe.start)}–${hourToLabel(safe.end)}`
      : 'Severe heat — minimise all outdoor time';
  }
  if (peak === 'highAlert') {
    return safe
      ? `Best outdoor window: ${hourToLabel(safe.start)}–${hourToLabel(safe.end)}`
      : 'High heat risk — stay hydrated';
  }
  if (peak === 'caution') {
    return 'Warm conditions — take regular water breaks';
  }
  return 'Safe conditions — enjoy the outdoors';
}

// ── Personalised tip ───────────────────────────────────────────────────────

function buildPersonalizedTip(peak: ThermalLevel, profile: ProfileInput): string {
  const conds = profile.conditions ?? [];
  const hasCardiac = conds.some(c => /heart|cardiac/i.test(c));
  const hasDiabetes = conds.some(c => /diabetes/i.test(c));
  const age = profile.age ?? 35;

  if (peak === 'crisis' || peak === 'extreme') {
    if (hasCardiac) {
      return 'Your cardiac condition significantly elevates heat risk today. Stay in air conditioning and check in with a trusted person every 2 hours.';
    }
    if (hasDiabetes) {
      return 'Extreme heat can affect blood sugar regulation. Monitor levels more frequently and keep insulin cool.';
    }
    if (age >= 65) {
      return 'Older adults are particularly vulnerable in extreme heat. Drink water before you feel thirsty and never skip air conditioning today.';
    }
    if (age <= 12) {
      return 'Children overheat faster than adults. Limit outdoor play to early morning only and ensure constant hydration.';
    }
    return 'Dangerous heat today. Drink at least 8 oz of water every 30 minutes if outside. Watch for dizziness or nausea — these are early warning signs.';
  }
  if (peak === 'highAlert') {
    return 'Wear light, loose, light-coloured clothing. Avoid direct sun between 10 AM and 4 PM. Plan outdoor activities for the morning window.';
  }
  if (peak === 'caution') {
    return 'Warm conditions but manageable. Stay well-hydrated and take shade breaks every 30–45 minutes of outdoor activity.';
  }
  return 'Comfortable conditions today. Great time for outdoor activities — stay hydrated as always.';
}

// ── Day / date labelling ───────────────────────────────────────────────────

function getDayLabel(index: number, date: Date): string {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function getDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a personalised forecast (up to 5 days) from real weather data.
 * Returns [] when no weather has loaded yet — callers show a loading state.
 *
 * @param riskMultiplier - Profile risk multiplier (1.0 = baseline)
 * @param profile        - HeatProfile or ProfileInput, for tip personalisation
 * @param snapshot       - Weather snapshot; defaults to the shared store
 */
export function generateForecast(
  riskMultiplier: number = 1.0,
  profile: ProfileInput | HeatProfile = {},
  snapshot: WeatherSnapshot | null = getWeatherSnapshot(),
): DayForecast[] {
  if (!snapshot) return [];
  const input = normalizeProfile(profile);

  return getUpcomingDateKeys(snapshot, 5)
    .map((dateKey, i): DayForecast | null => {
      const daily = snapshot.daily.find(d => d.dateKey === dateKey);
      const hourly = buildHourly(snapshot, dateKey, riskMultiplier);
      if (!daily || hourly.length === 0) return null;

      const [y, m, d] = dateKey.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const peakLevel = maxLevel(hourly.map(h => h.level));
      const danger = findDangerWindow(hourly);
      const safe = findSafeWindow(hourly);

      return {
        index: i,
        date,
        dayLabel: getDayLabel(i, date),
        dateLabel: getDateLabel(date),
        highTemp: Math.round(daily.highF),
        lowTemp: Math.round(daily.lowF),
        peakLevel,
        hourly,
        dangerStart: danger?.start ?? null,
        dangerEnd: danger?.end ?? null,
        safeStart: safe?.start ?? null,
        safeEnd: safe?.end ?? null,
        directive: buildDirective(danger, safe, peakLevel),
        personalizedTip: buildPersonalizedTip(peakLevel, input),
      };
    })
    .filter((d): d is DayForecast => d !== null)
    .map((d, i) => ({ ...d, index: i }));
}
