// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/intelligence/forecastEngine.ts
// HeatGuard · Forecast engine (v2: shared risk engine)
// Hour-by-hour and 5-day forecast from the real Open-Meteo data, with every
// level coming from features/risk/riskEngine — the same NWS categories and
// one-step personal adjustment that Home, Plan and "Your heat risk" use.
// Used by app/intelligence/forecast.tsx and app/preparedness/index.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import type { HeatProfile } from '../profile/storage/profileStorage';
import {
  getWeatherSnapshot,
  getHoursForDate,
  getUpcomingDateKeys,
  type WeatherSnapshot,
} from '../../services/weather/weatherStore';
import {
  assessRisk,
  hourLevel,
  levelRank,
  type NwsCategory,
  type RiskLevel,
} from '../risk/riskEngine';

export interface HourRisk {
  hour: number;     // 0–23
  tempF: number;
  feelsF: number;
  level: RiskLevel;
}

export interface DayForecast {
  index: number;
  dateKey: string;
  dayLabel: string;    // "Today", "Tomorrow", "Wed"
  dateLabel: string;   // "Jun 15"
  highF: number;
  lowF: number;
  peakFeelsF: number;
  level: RiskLevel;    // same rule as Home: peak feels-like + personal step
  nws: NwsCategory;
  stepped: boolean;
  hourly: HourRisk[];  // 5 AM – 10 PM
  avoidStart: number | null;  // first Very high hour
  avoidEnd: number | null;    // last Very high hour
  bestStart: number | null;   // coolest stretch, morning preferred
  bestEnd: number | null;
  bestIsSafer: boolean;       // true if that stretch is Low or Moderate
  directive: string;
  tip: string;
}

// ── Hour labels ─────────────────────────────────────────────────────────────

export function hourToLabel(hour: number, short = false): string {
  const h = ((hour % 24) + 24) % 24;
  const display = h % 12 === 0 ? 12 : h % 12;
  if (short) return `${display}${h < 12 ? 'a' : 'p'}`;
  return `${display} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "7 AM – 10 AM" (the end shown is the hour after the last hour in the run). */
export function windowLabel(start: number, end: number): string {
  return `${hourToLabel(start)} – ${hourToLabel(end + 1)}`;
}

// ── Windows ─────────────────────────────────────────────────────────────────

function avoidWindow(hourly: HourRisk[]): { start: number; end: number } | null {
  const vh = hourly.filter(h => h.level === 'veryHigh');
  if (!vh.length) return null;
  return { start: vh[0].hour, end: vh[vh.length - 1].hour };
}

/** Longest run of consecutive hours at the day's lowest level; morning first. */
function bestWindow(hourly: HourRisk[]): { start: number; end: number; safer: boolean } | null {
  if (!hourly.length) return null;
  const minRank = Math.min(...hourly.map(h => levelRank(h.level)));
  const runs: { start: number; end: number }[] = [];
  for (const h of hourly) {
    if (levelRank(h.level) !== minRank) continue;
    const last = runs[runs.length - 1];
    if (last && h.hour === last.end + 1) last.end = h.hour;
    else runs.push({ start: h.hour, end: h.hour });
  }
  if (!runs.length) return null;
  const morning = runs.find(r => r.start <= 10);
  const pick = morning ?? runs.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
  return { ...pick, safer: minRank <= levelRank('moderate') };
}

// ── Words ───────────────────────────────────────────────────────────────────

function buildDirective(
  level: RiskLevel,
  avoid: { start: number; end: number } | null,
  best: { start: number; end: number; safer: boolean } | null,
): string {
  switch (level) {
    case 'veryHigh':
      return avoid
        ? `Stay somewhere cool ${windowLabel(avoid.start, avoid.end)}.`
        : 'Dangerous heat for you. Stay somewhere cool this afternoon.';
    case 'high':
      return best && best.safer
        ? `Limit time outside. Best hours: ${windowLabel(best.start, best.end)}.`
        : 'Limit time outside, especially midday. Keep water close.';
    case 'moderate':
      return 'Warm. Plan time outside for the morning or evening.';
    default:
      return 'Comfortable. Normal care, and stay aware as it warms up.';
  }
}

/** Calm, practical tip. Doesn't list the user's conditions (by design). */
function buildTip(level: RiskLevel, stepped: boolean): string {
  const personal = stepped
    ? 'Heat affects you more than most, so this day is one step above the weather alone. '
    : '';
  switch (level) {
    case 'veryHigh':
      return `${personal}Drink water before you feel thirsty, keep your home cool, and check on anyone who depends on you. Never leave a child or pet in a car.`;
    case 'high':
      return `${personal}Wear light, loose clothing, take shade breaks, and save errands for the morning.`;
    case 'moderate':
      return `${personal}Take breaks in the shade and keep water with you when you go out.`;
    default:
      return `${personal}A good day to be outside. Bring water anyway.`;
  }
}

function dateFromKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getDayLabel(index: number, date: Date): string {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function getDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Up to 5 days from today. Returns [] until the forecast has loaded. */
export function generateForecast(
  profile: HeatProfile,
  snapshot: WeatherSnapshot | null = getWeatherSnapshot(),
): DayForecast[] {
  if (!snapshot) return [];

  return getUpcomingDateKeys(snapshot, 5)
    .map((dateKey): DayForecast | null => {
      const daily = snapshot.daily.find(d => d.dateKey === dateKey);
      if (!daily) return null;

      const hourly: HourRisk[] = getHoursForDate(snapshot, dateKey)
        .filter(h => h.hour >= 5 && h.hour <= 22)
        .map(h => ({
          hour: h.hour,
          tempF: Math.round(h.tempF),
          feelsF: Math.round(h.feelsLikeF),
          level: hourLevel(h.tempF, h.feelsLikeF, profile),
        }));
      if (!hourly.length) return null;

      const peakFeelsF = Math.round(Math.max(daily.feelsLikeMaxF, daily.highF));
      const risk = assessRisk(peakFeelsF, profile);
      const avoid = avoidWindow(hourly);
      const best = bestWindow(hourly);

      return {
        index: 0,
        dateKey,
        dayLabel: '',
        dateLabel: getDateLabel(dateFromKey(dateKey)),
        highF: Math.round(daily.highF),
        lowF: Math.round(daily.lowF),
        peakFeelsF,
        level: risk.level,
        nws: risk.nws,
        stepped: risk.stepped,
        hourly,
        avoidStart: avoid?.start ?? null,
        avoidEnd: avoid?.end ?? null,
        bestStart: best?.start ?? null,
        bestEnd: best?.end ?? null,
        bestIsSafer: best?.safer ?? false,
        directive: buildDirective(risk.level, avoid, best),
        tip: buildTip(risk.level, risk.stepped),
      };
    })
    .filter((d): d is DayForecast => d !== null)
    .map((d, i) => ({ ...d, index: i, dayLabel: getDayLabel(i, dateFromKey(d.dateKey)) }));
}
