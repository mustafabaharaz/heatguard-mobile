// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Heatwave Preparedness Engine
//
// Takes the 5-day forecast and the user's heat profile and produces:
//   - A heatwave severity assessment (is one coming? how bad?)
//   - A prioritised checklist of preparation actions
//   - A day-by-day plan (best window, avoid window, focus action)
//   - Supply recommendations tailored to profile risk factors
// ─────────────────────────────────────────────────────────────────────────────

import type { DayForecast, ThermalLevel } from '../intelligence/forecastEngine';
import type { HeatProfile } from '../profile/storage/profileStorage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HeatwaveSeverity = 'none' | 'mild' | 'moderate' | 'severe' | 'extreme';

export interface PrepAction {
  id: string;
  category: 'water' | 'shelter' | 'medical' | 'supplies' | 'social' | 'planning';
  priority: 'critical' | 'high' | 'medium';
  title: string;
  detail: string;
  completed: boolean;
}

export interface DayPlan {
  dayLabel: string;
  dateLabel: string;
  peakLevel: ThermalLevel;
  peakTemp: number;
  bestWindow: string;
  avoidWindow: string;
  focusAction: string;
  directive: string;
}

export interface PreparednessPlan {
  severity: HeatwaveSeverity;
  severityLabel: string;
  severityColor: string;
  headline: string;
  summary: string;
  daysUntilPeak: number;        // 0 = today is the peak
  peakTemp: number;
  actions: PrepAction[];
  dayPlans: DayPlan[];
  supplies: SupplyItem[];
}

export interface SupplyItem {
  name: string;
  quantity: string;
  critical: boolean;
}

// ── Main engine function ───────────────────────────────────────────────────────

export function generatePreparednessPlan(
  forecast: DayForecast[],
  profile: HeatProfile
): PreparednessPlan {
  const severity     = assessSeverity(forecast);
  const peakDay      = getPeakDay(forecast);
  const daysUntilPeak = peakDay?.index ?? 0;
  const peakTemp     = peakDay?.highTemp ?? 0;

  return {
    severity,
    severityLabel: getSeverityLabel(severity),
    severityColor: getSeverityColor(severity),
    headline:      getHeadline(severity, daysUntilPeak),
    summary:       getSummary(severity, daysUntilPeak, peakTemp, profile),
    daysUntilPeak,
    peakTemp,
    actions:       generateActions(severity, profile, forecast),
    dayPlans:      generateDayPlans(forecast),
    supplies:      generateSupplies(severity, profile),
  };
}

// ── Severity assessment ────────────────────────────────────────────────────────

function assessSeverity(forecast: DayForecast[]): HeatwaveSeverity {
  const levels = forecast.map(d => d.peakLevel);
  const crisisDays   = levels.filter(l => l === 'crisis').length;
  const extremeDays  = levels.filter(l => l === 'extreme' || l === 'crisis').length;
  const highDays     = levels.filter(l => l === 'highAlert' || l === 'extreme' || l === 'crisis').length;

  if (crisisDays >= 2)   return 'extreme';
  if (crisisDays >= 1)   return 'severe';
  if (extremeDays >= 3)  return 'severe';
  if (extremeDays >= 1)  return 'moderate';
  if (highDays >= 3)     return 'moderate';
  if (highDays >= 1)     return 'mild';
  return 'none';
}

function getPeakDay(forecast: DayForecast[]): DayForecast | null {
  if (!forecast.length) return null;
  return forecast.reduce((peak, day) =>
    day.highTemp > peak.highTemp ? day : peak
  );
}

// ── Action generation ──────────────────────────────────────────────────────────

function generateActions(
  severity: HeatwaveSeverity,
  profile: HeatProfile,
  forecast: DayForecast[]
): PrepAction[] {
  const actions: PrepAction[] = [];
  const isSevere = severity === 'severe' || severity === 'extreme';
  const isModerate = severity === 'moderate' || isSevere;

  // ── Water ──────────────────────────────────────────────────────────────────

  actions.push({
    id: 'water_stock',
    category: 'water',
    priority: 'critical',
    title: 'Stock water supply',
    detail: isSevere
      ? 'Store at least 4L per person per day for the heatwave duration. Fill bathtub as emergency reserve.'
      : 'Store at least 2L per person per day. Keep refrigerated water accessible.',
    completed: false,
  });

  actions.push({
    id: 'water_electrolytes',
    category: 'water',
    priority: isModerate ? 'high' : 'medium',
    title: 'Get electrolyte supplies',
    detail: 'Sports drinks, oral rehydration salts, or coconut water. Pure water alone is insufficient during heavy sweating.',
    completed: false,
  });

  // ── Shelter ────────────────────────────────────────────────────────────────

  actions.push({
    id: 'shelter_ac',
    category: 'shelter',
    priority: 'critical',
    title: 'Confirm AC is working',
    detail: 'Test your air conditioning now. Locate the nearest public cooling centre in case of power failure.',
    completed: false,
  });

  if (isSevere) {
    actions.push({
      id: 'shelter_backup',
      category: 'shelter',
      priority: 'high',
      title: 'Identify backup cooling location',
      detail: 'Know your nearest library, mall, or community centre with AC. Write the address down — don\'t rely on your phone working.',
      completed: false,
    });
  }

  actions.push({
    id: 'shelter_block',
    category: 'shelter',
    priority: 'high',
    title: 'Block heat from windows',
    detail: 'Close blinds and curtains on sun-facing windows before 10am. Reflective window film reduces indoor temp by up to 8°C.',
    completed: false,
  });

  // ── Medical ────────────────────────────────────────────────────────────────

  if (profile.takesMedications) {
    actions.push({
      id: 'med_review',
      category: 'medical',
      priority: 'critical',
      title: 'Review medications with pharmacist',
      detail: 'Some medications require dose adjustment or extra monitoring during heatwaves. Contact your pharmacist before the heat arrives.',
      completed: false,
    });
  }

  if (profile.hasDiabetes) {
    actions.push({
      id: 'med_diabetes',
      category: 'medical',
      priority: 'critical',
      title: 'Prepare diabetes heat plan',
      detail: 'Heat affects blood glucose and insulin storage. Keep insulin refrigerated. Check glucose more frequently. Have fast-acting sugar accessible.',
      completed: false,
    });
  }

  if (profile.hasHeartDisease) {
    actions.push({
      id: 'med_heart',
      category: 'medical',
      priority: 'critical',
      title: 'Notify your cardiologist',
      detail: 'Heatwaves significantly increase cardiac event risk. Confirm your action plan, know warning signs, and keep emergency contacts accessible.',
      completed: false,
    });
  }

  actions.push({
    id: 'med_first_aid',
    category: 'medical',
    priority: isModerate ? 'high' : 'medium',
    title: 'Prepare heat illness first aid kit',
    detail: 'Cool packs, thermometer, oral rehydration sachets, spray bottle. Know the difference between heat exhaustion and heat stroke.',
    completed: false,
  });

  // ── Supplies ───────────────────────────────────────────────────────────────

  actions.push({
    id: 'supplies_cooling',
    category: 'supplies',
    priority: 'high',
    title: 'Gather cooling supplies',
    detail: 'Spray bottle with water, damp towels, portable fan, cooling towels. Keep them in the coolest room.',
    completed: false,
  });

  if (isSevere) {
    actions.push({
      id: 'supplies_power',
      category: 'supplies',
      priority: 'high',
      title: 'Charge backup power banks',
      detail: 'HeatGuard and your emergency contacts depend on your phone working. Charge all power banks now.',
      completed: false,
    });
  }

  // ── Social ─────────────────────────────────────────────────────────────────

  actions.push({
    id: 'social_contacts',
    category: 'social',
    priority: 'critical',
    title: 'Alert your emergency contacts',
    detail: 'Tell someone your plans for each high-heat day. Check in on elderly or vulnerable neighbours.',
    completed: false,
  });

  if (profile.isElderly || profile.hasDiabetes || profile.hasHeartDisease) {
    actions.push({
      id: 'social_checkin',
      category: 'social',
      priority: 'critical',
      title: 'Set up daily check-in schedule',
      detail: 'Arrange for someone to call or visit you daily during the heatwave. Share your address with a trusted contact.',
      completed: false,
    });
  }

  // ── Planning ───────────────────────────────────────────────────────────────

  actions.push({
    id: 'plan_schedule',
    category: 'planning',
    priority: 'high',
    title: 'Reschedule outdoor activities',
    detail: 'Move all outdoor tasks to before 9am or after 7pm. Cancel non-essential outdoor commitments on extreme days.',
    completed: false,
  });

  if (isSevere) {
    actions.push({
      id: 'plan_pets',
      category: 'planning',
      priority: 'high',
      title: 'Plan for pets and vehicle safety',
      detail: 'Never leave pets or children in vehicles. Keep pets indoors. Check outdoor animals have shade and water every 2 hours.',
      completed: false,
    });
  }

  // Sort: critical first, then high, then medium
  return actions.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
}

// ── Day plans ──────────────────────────────────────────────────────────────────

function generateDayPlans(forecast: DayForecast[]): DayPlan[] {
  return forecast.slice(0, 5).map(day => ({
    dayLabel:    day.dayLabel,
    dateLabel:   day.dateLabel,
    peakLevel:   day.peakLevel,
    peakTemp:    day.highTemp,
    bestWindow:  day.safeStart !== null
      ? `${formatHour(day.safeStart)} – ${formatHour((day.safeEnd ?? day.safeStart) + 2)}`
      : 'Avoid outdoors',
    avoidWindow: day.dangerStart !== null
      ? `${formatHour(day.dangerStart)} – ${formatHour(day.dangerEnd ?? 20)}`
      : 'All day safe',
    focusAction: getDayFocusAction(day.peakLevel),
    directive:   day.directive,
  }));
}

function getDayFocusAction(level: ThermalLevel): string {
  switch (level) {
    case 'crisis':    return 'Stay indoors all day. No exceptions.';
    case 'extreme':   return 'Indoors by 10am. Emergency contacts on alert.';
    case 'highAlert': return 'Limit outdoor exposure. Hydrate every 20 min.';
    case 'caution':   return 'Morning activities only. Take regular breaks.';
    default:          return 'Normal precautions. Stay aware.';
  }
}

// ── Supply list ────────────────────────────────────────────────────────────────

function generateSupplies(severity: HeatwaveSeverity, profile: HeatProfile): SupplyItem[] {
  const isSevere = severity === 'severe' || severity === 'extreme';
  const days     = isSevere ? 5 : 3;

  const items: SupplyItem[] = [
    { name: 'Drinking water',         quantity: `${days * 3}L per person`,  critical: true  },
    { name: 'Electrolyte drinks',     quantity: `${days * 2} bottles`,      critical: true  },
    { name: 'Spray bottle',           quantity: '1–2',                      critical: false },
    { name: 'Cooling towels',         quantity: '2–4',                      critical: false },
    { name: 'Thermometer',            quantity: '1',                        critical: false },
    { name: 'Oral rehydration salts', quantity: '6–10 sachets',             critical: isSevere },
    { name: 'Cold packs / ice',       quantity: 'As many as fit in freezer', critical: isSevere },
    { name: 'Battery-powered fan',    quantity: '1',                        critical: isSevere },
  ];

  if (profile.hasDiabetes) {
    items.push({ name: 'Fast-acting glucose (juice, glucose tablets)', quantity: 'Several servings', critical: true });
    items.push({ name: 'Insulin cold storage pack',                    quantity: '1',               critical: true });
  }

  if (profile.takesMedications) {
    items.push({ name: 'Extra medication supply',  quantity: `${days + 2} days`,  critical: true });
    items.push({ name: 'Medication storage at safe temp', quantity: 'Refrigerated', critical: true });
  }

  return items;
}

// ── Label / colour helpers ─────────────────────────────────────────────────────

function getSeverityLabel(s: HeatwaveSeverity): string {
  switch (s) {
    case 'extreme':  return 'Extreme heatwave';
    case 'severe':   return 'Severe heatwave';
    case 'moderate': return 'Moderate heatwave';
    case 'mild':     return 'Mild heat event';
    default:         return 'No heatwave forecast';
  }
}

export function getSeverityColor(s: HeatwaveSeverity): string {
  switch (s) {
    case 'extreme':  return '#7C2D12';
    case 'severe':   return '#DC2626';
    case 'moderate': return '#EA580C';
    case 'mild':     return '#D97706';
    default:         return '#2D9B6F';
  }
}

function getHeadline(s: HeatwaveSeverity, daysUntil: number): string {
  if (s === 'none') return 'No heatwave in the forecast';
  const timing = daysUntil === 0 ? 'is here' : daysUntil === 1 ? 'arrives tomorrow' : `arrives in ${daysUntil} days`;
  switch (s) {
    case 'extreme':  return `Extreme heatwave ${timing}`;
    case 'severe':   return `Severe heatwave ${timing}`;
    case 'moderate': return `Moderate heatwave ${timing}`;
    default:         return `Heat event ${timing}`;
  }
}

function getSummary(s: HeatwaveSeverity, daysUntil: number, peak: number, profile: HeatProfile): string {
  if (s === 'none') return 'Conditions look manageable for the next 5 days. Keep your supplies topped up.';
  const urgency = daysUntil === 0 ? 'The heatwave is already here.' : `You have ${daysUntil} day${daysUntil > 1 ? 's' : ''} to prepare.`;
  const riskNote = (profile.isElderly || profile.hasDiabetes || profile.hasHeartDisease)
    ? ' Your health profile puts you at elevated risk — complete all critical actions today.'
    : '';
  return `${urgency} Peak temperatures of ${Math.round(peak)}°F expected.${riskNote}`;
}

function priorityRank(p: string): number {
  return p === 'critical' ? 3 : p === 'high' ? 2 : 1;
}

function formatHour(h: number): string {
  if (h <= 0 || h > 23) return '--';
  const period = h < 12 ? 'AM' : 'PM';
  const display = h <= 12 ? h : h - 12;
  return `${display}${period}`;
}

// ── Category helpers (used by UI) ──────────────────────────────────────────────

export function categoryLabel(cat: PrepAction['category']): string {
  switch (cat) {
    case 'water':    return 'Water';
    case 'shelter':  return 'Shelter';
    case 'medical':  return 'Medical';
    case 'supplies': return 'Supplies';
    case 'social':   return 'Social';
    case 'planning': return 'Planning';
  }
}

export function categoryIcon(cat: PrepAction['category']): string {
  switch (cat) {
    case 'water':    return 'water-outline';
    case 'shelter':  return 'home-outline';
    case 'medical':  return 'medkit-outline';
    case 'supplies': return 'bag-outline';
    case 'social':   return 'people-outline';
    case 'planning': return 'calendar-outline';
  }
}

export function thermalLevelColor(level: ThermalLevel): string {
  switch (level) {
    case 'crisis':    return '#7C2D12';
    case 'extreme':   return '#DC2626';
    case 'highAlert': return '#EA580C';
    case 'caution':   return '#D97706';
    default:          return '#2D9B6F';
  }
}
