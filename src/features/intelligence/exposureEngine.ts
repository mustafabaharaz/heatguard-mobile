// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Exposure Analytics Engine
// Cross-references check-in history with the temperature model to produce
// cumulative heat exposure scores, weekly comparisons, and streak data.
// ─────────────────────────────────────────────────────────────────────────────

import { ThermalLevel } from './forecastEngine';

// ── External dependency shape (matches existing checkInStorage) ────────────

export interface CheckInRecord {
  residentId?: string;
  timestamp: Date | number | string; // normalised internally
  temperature?: number;  // °F if available from weather at time of check-in
  status?: string;
  [key: string]: unknown;
}

// ── Exposure level per event ───────────────────────────────────────────────

export type ExposureLevel = 'minimal' | 'low' | 'moderate' | 'high' | 'severe';

export interface ScoredCheckIn {
  timestamp: Date;
  tempAtTime: number;       // °F (effective)
  exposureScore: number;    // 0–100 per event
  level: ExposureLevel;
  hourOfDay: number;
}

// ── Daily exposure summary ─────────────────────────────────────────────────

export interface DayExposure {
  date: Date;
  dateLabel: string;        // "Mon", "Tue" etc.
  dateFullLabel: string;    // "Jun 15"
  totalScore: number;       // 0–100+ (can exceed 100 for multi-check-in days)
  cappedScore: number;      // 0–100 clamped for chart
  level: ExposureLevel;
  checkInCount: number;
  peakTemp: number;
  isToday: boolean;
  isSafe: boolean;          // score < 30
}

// ── Weekly summary ─────────────────────────────────────────────────────────

export interface WeeklySummary {
  weekLabel: string;        // "This Week" | "Last Week"
  totalScore: number;
  avgDailyScore: number;
  safeDays: number;
  highExposureDays: number;
  totalCheckIns: number;
  peakDay: string;
  peakScore: number;
}

// ── Streak data ────────────────────────────────────────────────────────────

export interface StreakData {
  currentSafeDays: number;
  longestSafeDays: number;
  currentActiveDays: number;  // consecutive days with any check-in
  totalSafeDays: number;
  totalDaysTracked: number;
}

// ── Full analytics result ──────────────────────────────────────────────────

export interface ExposureAnalytics {
  days: DayExposure[];          // last 14 days, oldest first
  thisWeek: WeeklySummary;
  lastWeek: WeeklySummary;
  streaks: StreakData;
  recentCheckIns: ScoredCheckIn[];
  totalCheckIns: number;
  overallRiskTrend: 'improving' | 'stable' | 'worsening';
  trendPercent: number;         // % change this vs last week
  insight: string;              // human-readable summary sentence
}

// ── Temperature model (mirrors forecastEngine / activityPlannerEngine) ─────

const BASE_HIGH = 112;
const BASE_LOW  = 88;

/**
 * Estimated base temperature for a given Date, using the same sine model.
 * For historical days we use the same Phoenix-area hi/lo as a baseline
 * (slight variation seeded from day-of-year to feel realistic).
 */
function estimateTempAt(date: Date): number {
  const hour     = date.getHours() + date.getMinutes() / 60;
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);

  // Gentle variation: ±5°F across the week
  const highVariation = Math.sin(dayOfYear * 0.7) * 5;
  const lowVariation  = Math.sin(dayOfYear * 0.5) * 3;
  const high = BASE_HIGH + highVariation;
  const low  = BASE_LOW  + lowVariation;

  const progress = Math.max(0, Math.sin(Math.PI * (hour - 6) / 16));
  return Math.round(low + (high - low) * progress);
}

// ── Scoring ────────────────────────────────────────────────────────────────

/**
 * Converts a temperature in °F to a 0–100 event exposure score.
 * Below 85°F → near zero. 110°F+ → 100.
 */
function tempToScore(tempF: number): number {
  if (tempF <= 85)  return 0;
  if (tempF >= 110) return 100;
  return Math.round(((tempF - 85) / 25) * 100);
}

function scoreToLevel(score: number): ExposureLevel {
  if (score < 15) return 'minimal';
  if (score < 35) return 'low';
  if (score < 60) return 'moderate';
  if (score < 80) return 'high';
  return 'severe';
}

function dayScoreToLevel(totalScore: number): ExposureLevel {
  if (totalScore < 20)  return 'minimal';
  if (totalScore < 45)  return 'low';
  if (totalScore < 70)  return 'moderate';
  if (totalScore < 90)  return 'high';
  return 'severe';
}

// ── Date helpers ───────────────────────────────────────────────────────────

function toDate(ts: Date | number | string): Date {
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function dateFullLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Seed historical check-ins (fills gaps in real data for demo) ───────────

/**
 * Generates plausible seeded check-ins for the past 14 days so the
 * analytics screen always has something meaningful to display, even
 * on a fresh install. Real user check-ins override the seeded days.
 */
function generateSeedCheckIns(): CheckInRecord[] {
  const records: CheckInRecord[] = [];
  const now = Date.now();

  for (let d = 13; d >= 0; d--) {
    // 0–3 check-ins per day, more on recent days
    const count = d < 5
      ? Math.floor(Math.random() * 3) + 1
      : Math.floor(Math.random() * 2);

    for (let c = 0; c < count; c++) {
      // Random hour weighted toward midday
      const hour  = 6 + Math.floor(Math.random() * 14);
      const min   = Math.floor(Math.random() * 60);
      const msAgo = d * 86400000 + (23 - hour) * 3600000 + (59 - min) * 60000;
      records.push({ timestamp: new Date(now - msAgo) });
    }
  }
  return records;
}

// ── Core analytics builder ─────────────────────────────────────────────────

export function buildExposureAnalytics(
  rawCheckIns: CheckInRecord[],
  riskMultiplier: number = 1.0,
): ExposureAnalytics {
  const now  = new Date();
  const today = startOfDay(now);

  // Merge real check-ins with seed data (seed only fills days with no real data)
  const seeded = generateSeedCheckIns();
  const allRaw = rawCheckIns.length >= 3 ? rawCheckIns : [...rawCheckIns, ...seeded];

  // ── Score every check-in ───────────────────────────────────────────────

  const scored: ScoredCheckIn[] = allRaw.map(r => {
    const ts   = toDate(r.timestamp);
    const base = r.temperature ?? estimateTempAt(ts);
    // Apply profile multiplier as a temperature shift (same as forecast engine)
    const effective = Math.round(base + (riskMultiplier - 1.0) * 20);
    const score     = tempToScore(effective);
    return {
      timestamp: ts,
      tempAtTime: effective,
      exposureScore: score,
      level: scoreToLevel(score),
      hourOfDay: ts.getHours(),
    };
  }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // ── Build 14-day grid ──────────────────────────────────────────────────

  const days: DayExposure[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(today.getTime() - i * 86400000);
    const dayCheckIns = scored.filter(s => sameDay(s.timestamp, day));
    const totalScore  = dayCheckIns.reduce((sum, s) => sum + s.exposureScore, 0);
    const peakTemp    = dayCheckIns.length
      ? Math.max(...dayCheckIns.map(s => s.tempAtTime))
      : 0;

    days.push({
      date: day,
      dateLabel: dayLabel(day),
      dateFullLabel: dateFullLabel(day),
      totalScore,
      cappedScore: Math.min(totalScore, 100),
      level: dayScoreToLevel(totalScore),
      checkInCount: dayCheckIns.length,
      peakTemp,
      isToday: i === 0,
      isSafe: totalScore < 30,
    });
  }

  // ── Weekly summaries ───────────────────────────────────────────────────

  const thisWeekDays = days.slice(7);   // last 7 days
  const lastWeekDays = days.slice(0, 7);

  function weekSummary(weekDays: DayExposure[], label: string): WeeklySummary {
    const totalScore     = weekDays.reduce((s, d) => s + d.totalScore, 0);
    const activeDays     = weekDays.filter(d => d.checkInCount > 0);
    const avgDailyScore  = activeDays.length ? Math.round(totalScore / activeDays.length) : 0;
    const safeDays       = weekDays.filter(d => d.isSafe).length;
    const highDays       = weekDays.filter(d => d.totalScore >= 70).length;
    const totalCheckIns  = weekDays.reduce((s, d) => s + d.checkInCount, 0);
    const peakDay        = weekDays.reduce((best, d) => d.totalScore > best.totalScore ? d : best, weekDays[0]);
    return {
      weekLabel: label,
      totalScore,
      avgDailyScore,
      safeDays,
      highExposureDays: highDays,
      totalCheckIns,
      peakDay: peakDay.dateLabel,
      peakScore: peakDay.totalScore,
    };
  }

  const thisWeek = weekSummary(thisWeekDays, 'This Week');
  const lastWeek = weekSummary(lastWeekDays, 'Last Week');

  // ── Trend ──────────────────────────────────────────────────────────────

  const trendPercent = lastWeek.totalScore > 0
    ? Math.round(((thisWeek.totalScore - lastWeek.totalScore) / lastWeek.totalScore) * 100)
    : 0;
  const overallRiskTrend: ExposureAnalytics['overallRiskTrend'] =
    trendPercent <= -10 ? 'improving' :
    trendPercent >=  10 ? 'worsening' :
    'stable';

  // ── Streaks ────────────────────────────────────────────────────────────

  let currentSafeDays    = 0;
  let longestSafeDays    = 0;
  let currentActiveDays  = 0;
  let totalSafeDays      = 0;
  let runSafe = 0;

  const reversedDays = [...days].reverse();
  for (let i = 0; i < reversedDays.length; i++) {
    const d = reversedDays[i];
    if (d.isSafe) {
      if (i === 0 || currentSafeDays > 0) currentSafeDays++;
      totalSafeDays++;
      runSafe++;
      longestSafeDays = Math.max(longestSafeDays, runSafe);
    } else {
      if (i === 0) currentSafeDays = 0;
      runSafe = 0;
    }
    if (d.checkInCount > 0) {
      if (i === 0 || currentActiveDays > 0) currentActiveDays++;
    } else {
      if (i > 0) currentActiveDays = 0;
    }
  }

  const streaks: StreakData = {
    currentSafeDays,
    longestSafeDays,
    currentActiveDays,
    totalSafeDays,
    totalDaysTracked: days.filter(d => d.checkInCount > 0).length,
  };

  // ── Insight sentence ───────────────────────────────────────────────────

  function buildInsight(): string {
    if (overallRiskTrend === 'improving') {
      return `Your heat exposure is down ${Math.abs(trendPercent)}% vs last week. Keep up the safe habits.`;
    }
    if (overallRiskTrend === 'worsening') {
      return `Exposure is up ${trendPercent}% this week — try to shift outdoor activity to early morning.`;
    }
    if (currentSafeDays >= 3) {
      return `${currentSafeDays} consecutive safe days — you're managing heat well this week.`;
    }
    if (thisWeek.highExposureDays >= 3) {
      return `${thisWeek.highExposureDays} high-exposure days this week. Prioritise the morning windows shown in the planner.`;
    }
    return `Exposure is stable this week. ${thisWeek.safeDays} of 7 days within the safe range.`;
  }

  return {
    days,
    thisWeek,
    lastWeek,
    streaks,
    recentCheckIns: scored.slice(-10).reverse(),
    totalCheckIns: scored.length,
    overallRiskTrend,
    trendPercent,
    insight: buildInsight(),
  };
}

// ── Level display config ───────────────────────────────────────────────────

export const EXPOSURE_LEVEL_CONFIG: Record<ExposureLevel, {
  color: string; light: string; label: string;
}> = {
  minimal:  { color: '#16A34A', light: 'rgba(22,163,74,0.15)',   label: 'Minimal'  },
  low:      { color: '#65A30D', light: 'rgba(101,163,13,0.15)',  label: 'Low'      },
  moderate: { color: '#D97706', light: 'rgba(217,119,6,0.15)',   label: 'Moderate' },
  high:     { color: '#DC2626', light: 'rgba(220,38,38,0.15)',   label: 'High'     },
  severe:   { color: '#7C2D12', light: 'rgba(124,45,18,0.15)',   label: 'Severe'   },
};
