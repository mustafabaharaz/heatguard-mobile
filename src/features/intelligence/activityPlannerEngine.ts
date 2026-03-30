// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Activity Planner Engine
// Scores every 30-minute outdoor window across today and tomorrow for a
// chosen activity type and duration, factoring in the user's risk multiplier.
// Returns windows ranked from safest to most dangerous.
// ─────────────────────────────────────────────────────────────────────────────

import { ThermalLevel } from './forecastEngine';

// ── Activity definitions ───────────────────────────────────────────────────

export type ActivityType =
  | 'walking'
  | 'running'
  | 'cycling'
  | 'gardening'
  | 'outdoor_work';

export interface ActivityDefinition {
  id: ActivityType;
  label: string;
  icon: string;
  /** Multiplies effective temperature — vigorous activity raises heat burden */
  intensityMultiplier: number;
  /** Minimum break interval recommendation in minutes */
  breakInterval: number;
  /** Water oz per hour recommended */
  waterOzPerHour: number;
}

export const ACTIVITIES: ActivityDefinition[] = [
  { id: 'walking',      label: 'Walking',       icon: '🚶',  intensityMultiplier: 1.10, breakInterval: 30, waterOzPerHour: 16 },
  { id: 'running',      label: 'Running',        icon: '🏃',  intensityMultiplier: 1.45, breakInterval: 15, waterOzPerHour: 24 },
  { id: 'cycling',      label: 'Cycling',        icon: '🚴',  intensityMultiplier: 1.35, breakInterval: 20, waterOzPerHour: 20 },
  { id: 'gardening',    label: 'Gardening',      icon: '🌱',  intensityMultiplier: 1.20, breakInterval: 20, waterOzPerHour: 16 },
  { id: 'outdoor_work', label: 'Outdoor Work',   icon: '🔨',  intensityMultiplier: 1.30, breakInterval: 15, waterOzPerHour: 24 },
];

export const DURATIONS_MIN = [30, 60, 90, 120] as const;
export type DurationMin = typeof DURATIONS_MIN[number];

// ── Window types ───────────────────────────────────────────────────────────

export type WindowVerdict = 'recommended' | 'acceptable' | 'caution' | 'avoid';

export interface ActivityWindow {
  dayLabel: 'Today' | 'Tomorrow';
  startHour: number;
  startMin: number;      // 0 or 30
  endHour: number;
  endMin: number;
  peakEffectiveTemp: number;
  avgEffectiveTemp: number;
  thermalLevel: ThermalLevel;
  verdict: WindowVerdict;
  verdictReason: string;
  waterNeeded: number;   // oz for the full duration
  breaksNeeded: number;  // number of shade breaks
}

// ── Temperature model (mirrors forecastEngine sine curve) ─────────────────

/** Base hi/lo per day — same values as forecastEngine.BASE_DAYS */
const BASE_DAYS = [
  { high: 112, low: 88 },  // today
  { high: 109, low: 86 },  // tomorrow
];

/**
 * Base temperature at a fractional hour using a sine curve that
 * peaks at 14:00 (2 PM), matching the forecastEngine model exactly.
 */
function tempAtHour(dayIndex: number, hour: number, minute: number): number {
  const { high, low } = BASE_DAYS[dayIndex];
  const t = hour + minute / 60;
  const progress = Math.max(0, Math.sin(Math.PI * (t - 6) / 16));
  return low + (high - low) * progress;
}

// ── Thermal thresholds (mirrors forecastEngine) ────────────────────────────

function effectiveToLevel(effectiveTemp: number): ThermalLevel {
  if (effectiveTemp < 90)  return 'safe';
  if (effectiveTemp < 100) return 'caution';
  if (effectiveTemp < 105) return 'highAlert';
  if (effectiveTemp < 110) return 'extreme';
  return 'crisis';
}

// ── Verdict scoring ────────────────────────────────────────────────────────

function verdictFromLevel(level: ThermalLevel): WindowVerdict {
  if (level === 'safe')      return 'recommended';
  if (level === 'caution')   return 'acceptable';
  if (level === 'highAlert') return 'caution';
  return 'avoid';
}

function buildReason(
  verdict: WindowVerdict,
  avgTemp: number,
  activity: ActivityDefinition,
  durationMin: DurationMin,
): string {
  if (verdict === 'recommended') {
    return `Good window for ${activity.label.toLowerCase()}. Effective temp stays below 90°F across the ${durationMin}-minute activity.`;
  }
  if (verdict === 'acceptable') {
    return `Manageable but warm (~${Math.round(avgTemp)}°F effective). Take a ${activity.breakInterval}-min shade break halfway through.`;
  }
  if (verdict === 'caution') {
    return `High heat burden (~${Math.round(avgTemp)}°F effective). Only attempt if acclimated — take breaks every ${activity.breakInterval} min.`;
  }
  return `Dangerous conditions (~${Math.round(avgTemp)}°F effective). Heat stroke risk is high — avoid outdoor ${activity.label.toLowerCase()}.`;
}

// ── Window generation ──────────────────────────────────────────────────────

/**
 * Samples temperature at the start, middle, and end of a window to
 * produce a representative peak and average effective temperature.
 */
function scoreWindow(
  dayIndex: number,
  startHour: number,
  startMin: number,
  durationMin: DurationMin,
  riskMultiplier: number,
  activity: ActivityDefinition,
): Pick<ActivityWindow, 'peakEffectiveTemp' | 'avgEffectiveTemp' | 'thermalLevel'> {
  const samples: number[] = [];
  const steps = Math.max(2, durationMin / 15);

  for (let i = 0; i <= steps; i++) {
    const totalMin = startHour * 60 + startMin + (durationMin / steps) * i;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const base = tempAtHour(dayIndex, h, m);
    // Effective temp = base adjusted by profile risk + activity intensity
    const effective = base + (riskMultiplier - 1.0) * 20 + (activity.intensityMultiplier - 1.0) * 12;
    samples.push(effective);
  }

  const peak = Math.max(...samples);
  const avg  = samples.reduce((a, b) => a + b, 0) / samples.length;

  return {
    peakEffectiveTemp: Math.round(peak),
    avgEffectiveTemp:  Math.round(avg),
    thermalLevel:      effectiveToLevel(peak),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate all scoreable 30-minute-slot windows for today and tomorrow,
 * for the given activity type, duration, and profile risk multiplier.
 *
 * Windows run from 5:00 AM to 8:30 PM (last start that fits before 10 PM).
 * Sorted safest-first (recommended → acceptable → caution → avoid).
 */
export function planActivity(
  activityId: ActivityType,
  durationMin: DurationMin,
  riskMultiplier: number,
): ActivityWindow[] {
  const activity  = ACTIVITIES.find(a => a.id === activityId)!;
  const windows: ActivityWindow[] = [];

  for (let dayIndex = 0; dayIndex <= 1; dayIndex++) {
    const dayLabel = dayIndex === 0 ? 'Today' : 'Tomorrow';

    // Slots: every 30 min from 5:00 AM, last start must end by 22:00 (10 PM)
    for (let slot = 0; slot < 34; slot++) {
      const totalStartMin = 5 * 60 + slot * 30;
      const totalEndMin   = totalStartMin + durationMin;
      if (totalEndMin > 22 * 60) break;

      const startHour = Math.floor(totalStartMin / 60);
      const startMin  = totalStartMin % 60;
      const endHour   = Math.floor(totalEndMin / 60);
      const endMin    = totalEndMin % 60;

      const score = scoreWindow(dayIndex, startHour, startMin, durationMin, riskMultiplier, activity);
      const verdict = verdictFromLevel(score.thermalLevel);

      const waterNeeded = Math.round((activity.waterOzPerHour * durationMin) / 60);
      const breaksNeeded = Math.max(0, Math.floor(durationMin / activity.breakInterval) - 1);

      windows.push({
        dayLabel: dayLabel as 'Today' | 'Tomorrow',
        startHour,
        startMin,
        endHour,
        endMin,
        ...score,
        verdict,
        verdictReason: buildReason(verdict, score.avgEffectiveTemp, activity, durationMin),
        waterNeeded,
        breaksNeeded,
      });
    }
  }

  // Sort: recommended first, then acceptable, caution, avoid
  const ORDER: WindowVerdict[] = ['recommended', 'acceptable', 'caution', 'avoid'];
  return windows.sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
}

// ── Formatting helpers ─────────────────────────────────────────────────────

export function formatWindowTime(hour: number, min: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMin = min === 0 ? '' : ':30';
  return `${displayHour}${displayMin} ${period}`;
}

export function formatWindowRange(
  startHour: number, startMin: number,
  endHour: number,   endMin: number,
): string {
  return `${formatWindowTime(startHour, startMin)} – ${formatWindowTime(endHour, endMin)}`;
}

/** Returns the current hour:30-slot index for "now" highlighting */
export function getNowSlot(): { hour: number; min: number } {
  const now = new Date();
  return {
    hour: now.getHours(),
    min:  now.getMinutes() >= 30 ? 30 : 0,
  };
}
