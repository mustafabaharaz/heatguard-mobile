// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/preparedness/preparednessEngine.ts
// HeatGuard · Be prepared engine (v2: shared risk engine)
// Turns the 5-day forecast (features/intelligence/forecastEngine, whose levels
// come from features/risk/riskEngine) and the heat profile into:
//   - how serious the coming days are for this user
//   - a prioritized checklist
//   - a short plan per day
//   - a supply list (US units; water per FEMA: 1 gallon per person per day)
// ─────────────────────────────────────────────────────────────────────────────

import type { DayForecast } from '../intelligence/forecastEngine';
import { windowLabel } from '../intelligence/forecastEngine';
import type { HeatProfile } from '../profile/storage/profileStorage';
import type { RiskLevel } from '../risk/riskEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HeatwaveSeverity = 'none' | 'mild' | 'moderate' | 'severe' | 'extreme';

export type PrepCategory = 'water' | 'home' | 'health' | 'supplies' | 'people' | 'planning';

export interface PrepAction {
  id: string;
  category: PrepCategory;
  priority: 'critical' | 'high' | 'medium';
  title: string;
  detail: string;
}

export interface DayPlan {
  dateKey: string;
  dayLabel: string;
  dateLabel: string;
  level: RiskLevel;
  highF: number;
  bestWindow: string;
  focusAction: string;
}

export interface SupplyItem {
  name: string;
  quantity: string;
  critical: boolean;
}

export interface PreparednessPlan {
  severity: HeatwaveSeverity;
  headline: string;
  summary: string;
  veryHighDays: number;
  actions: PrepAction[];
  dayPlans: DayPlan[];
  supplies: SupplyItem[];
}

// ── Severity ──────────────────────────────────────────────────────────────────
// Counts this user's Very high and High days (same levels as Home and Plan).

function assessSeverity(days: DayForecast[]): HeatwaveSeverity {
  const veryHigh = days.filter(d => d.level === 'veryHigh').length;
  const highPlus = days.filter(d => d.level === 'high' || d.level === 'veryHigh').length;
  const extremeDanger = days.some(d => d.nws === 'extremeDanger');
  if (extremeDanger || veryHigh >= 4) return 'extreme';
  if (veryHigh >= 2) return 'severe';
  if (veryHigh >= 1 || highPlus >= 3) return 'moderate';
  if (highPlus >= 1) return 'mild';
  return 'none';
}

function firstVeryHighIndex(days: DayForecast[]): number {
  const i = days.findIndex(d => d.level === 'veryHigh' || d.level === 'high');
  return i < 0 ? 0 : i;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function generatePreparednessPlan(days: DayForecast[], profile: HeatProfile): PreparednessPlan {
  const severity = assessSeverity(days);
  const startsIn = firstVeryHighIndex(days);
  return {
    severity,
    headline: getHeadline(severity, startsIn),
    summary: getSummary(severity, days),
    veryHighDays: days.filter(d => d.level === 'veryHigh').length,
    actions: generateActions(severity, profile),
    dayPlans: days.slice(0, 5).map(toDayPlan),
    supplies: generateSupplies(severity, profile),
  };
}

// ── Actions ───────────────────────────────────────────────────────────────────

function generateActions(severity: HeatwaveSeverity, p: HeatProfile): PrepAction[] {
  const severe = severity === 'severe' || severity === 'extreme';
  const moderate = severity === 'moderate' || severe;
  const a: PrepAction[] = [];

  a.push({
    id: 'water_stock', category: 'water', priority: 'critical',
    title: 'Keep drinking water on hand',
    detail: 'Plan on at least 1 gallon per person per day. Keep some cold in the fridge so it’s easy to drink.',
  });
  a.push({
    id: 'water_electrolytes', category: 'water', priority: moderate ? 'high' : 'medium',
    title: 'Get sports drinks or electrolyte packets',
    detail: 'Useful if you sweat a lot working or exercising. Ask your doctor first if you are on a fluid or salt limit.',
  });

  a.push({
    id: 'home_ac', category: 'home', priority: 'critical',
    title: 'Check that your AC works',
    detail: 'Test it now, before the hottest days. Change the filter if it’s dirty. Know where you would go if it fails.',
  });
  a.push({
    id: 'home_backup', category: 'home', priority: severe ? 'critical' : 'high',
    title: 'Pick a backup cool place',
    detail: 'A cooling center, library, or friend’s home with AC. Cool Spots lists nearby ones in Maricopa County.',
  });
  a.push({
    id: 'home_blinds', category: 'home', priority: 'medium',
    title: 'Block the afternoon sun',
    detail: 'Close blinds and curtains on sunny windows during the day to keep rooms cooler.',
  });

  if (p.takesMedications) {
    a.push({
      id: 'health_meds', category: 'health', priority: 'critical',
      title: 'Ask your pharmacist about your medicines in heat',
      detail: 'Some medicines change how your body handles heat or need to be stored cool. Don’t stop or change a medicine on your own.',
    });
  }
  if (p.hasDiabetes || p.hasHeartDisease || p.hasRespiratoryIssues || p.healthConcern) {
    a.push({
      id: 'health_plan', category: 'health', priority: 'critical',
      title: 'Talk with your doctor about a heat plan',
      detail: 'Ask what warning signs to watch for and when to call them.',
    });
  }
  a.push({
    id: 'health_signs', category: 'health', priority: moderate ? 'high' : 'medium',
    title: 'Learn the signs of heat illness',
    detail: 'Heat exhaustion and heat stroke look different. The Emergency info card in HeatGuard shows both, even offline.',
  });

  a.push({
    id: 'supplies_cooling', category: 'supplies', priority: 'high',
    title: 'Gather cooling supplies',
    detail: 'Spray bottle, cooling towels, ice packs, a battery fan. Keep them in the coolest room.',
  });
  a.push({
    id: 'supplies_power', category: 'supplies', priority: severe ? 'high' : 'medium',
    title: 'Charge a power bank',
    detail: 'So your phone works if the power goes out.',
  });

  a.push({
    id: 'people_contacts', category: 'people', priority: 'critical',
    title: 'Add emergency contacts',
    detail: 'So SOS texts reach someone. Tell them your plans on the hottest days.',
  });
  if (p.isElderly || p.livesAlone || p.hasHeartDisease || p.hasDiabetes) {
    a.push({
      id: 'people_checkin', category: 'people', priority: 'critical',
      title: 'Turn on daily check-in',
      detail: 'HeatGuard asks “Are you OK?” and your heat buddy can check on you.',
    });
  }
  a.push({
    id: 'people_neighbors', category: 'people', priority: 'medium',
    title: 'Check on neighbors',
    detail: 'Older adults and people living alone are at the highest risk.',
  });

  a.push({
    id: 'plan_schedule', category: 'planning', priority: 'high',
    title: 'Move outdoor plans to cooler hours',
    detail: 'Early morning or evening. The Plan tab shows your safer hours each day.',
  });
  if (p.drivesWithKids || p.drivesWithPets || severe) {
    a.push({
      id: 'plan_car', category: 'planning', priority: 'critical',
      title: 'Never leave a child or pet in a car',
      detail: 'Not even for a minute. A car heats up fast, even with windows cracked.',
    });
  }

  const rank = (x: PrepAction['priority']) => (x === 'critical' ? 3 : x === 'high' ? 2 : 1);
  return a.sort((x, y) => rank(y.priority) - rank(x.priority));
}

// ── Day plans ─────────────────────────────────────────────────────────────────

function toDayPlan(d: DayForecast): DayPlan {
  const best =
    d.bestStart !== null && d.bestEnd !== null
      ? `${d.bestIsSafer ? 'Best outside' : 'Coolest hours'}: ${windowLabel(d.bestStart, d.bestEnd)}`
      : 'No hourly forecast yet';
  return {
    dateKey: d.dateKey,
    dayLabel: d.dayLabel,
    dateLabel: d.dateLabel,
    level: d.level,
    highF: d.highF,
    bestWindow: best,
    focusAction: FOCUS[d.level],
  };
}

const FOCUS: Record<RiskLevel, string> = {
  veryHigh: 'Stay somewhere cool in the afternoon. Check in with someone.',
  high: 'Limit time outside. Drink water often.',
  moderate: 'Outdoor plans in the morning or evening.',
  low: 'Normal care.',
};

// ── Supplies ──────────────────────────────────────────────────────────────────

function generateSupplies(severity: HeatwaveSeverity, p: HeatProfile): SupplyItem[] {
  const severe = severity === 'severe' || severity === 'extreme';
  const days = severe ? 5 : 3;
  const items: SupplyItem[] = [
    { name: 'Drinking water', quantity: `${days} gallons per person`, critical: true },
    { name: 'Sports drinks or electrolyte packets', quantity: 'A few days’ worth', critical: false },
    { name: 'Ice packs', quantity: '2–4', critical: severe },
    { name: 'Cooling towels or spray bottle', quantity: '1–2', critical: false },
    { name: 'Battery fan', quantity: '1', critical: severe },
    { name: 'Thermometer', quantity: '1', critical: false },
    { name: 'Power bank', quantity: 'Charged', critical: severe },
  ];
  if (p.takesMedications) {
    items.push({ name: 'Extra supply of your medicines', quantity: 'A few days’ worth', critical: true });
  }
  return items;
}

// ── Words ─────────────────────────────────────────────────────────────────────

function getHeadline(s: HeatwaveSeverity, startsIn: number): string {
  if (s === 'none') return 'No dangerous heat in the next 5 days';
  const when = startsIn === 0 ? 'starting today' : startsIn === 1 ? 'starting tomorrow' : `in ${startsIn} days`;
  switch (s) {
    case 'extreme': return `Extreme heat for you ${when}`;
    case 'severe': return `Dangerous heat for you ${when}`;
    case 'moderate': return `Very hot days ${when}`;
    default: return `Some hot days ${when}`;
  }
}

function getSummary(s: HeatwaveSeverity, days: DayForecast[]): string {
  if (s === 'none' || !days.length) return 'Conditions look manageable. A good time to check your supplies.';
  const vh = days.filter(d => d.level === 'veryHigh').length;
  const part = vh ? `${vh} of the next ${days.length} days are Very high for you.` : 'Your heat risk reaches High this week.';
  return `${part} Start at the top of the list.`;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export function categoryLabel(cat: PrepCategory): string {
  switch (cat) {
    case 'water': return 'Water';
    case 'home': return 'Home';
    case 'health': return 'Health';
    case 'supplies': return 'Supplies';
    case 'people': return 'People';
    case 'planning': return 'Planning';
  }
}

export const CATEGORY_ORDER: PrepCategory[] = ['water', 'home', 'health', 'people', 'planning', 'supplies'];
