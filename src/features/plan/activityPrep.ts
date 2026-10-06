// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/plan/activityPrep.ts   (NEW FILE + NEW FOLDER)
// HeatGuard · Activity prep
//  - Activities and their checklists
//  - Safer hours for a day, from the real hourly "feels like" forecast
//  - "Be back by" time for an activity starting at a given hour
// ─────────────────────────────────────────────────────────────────────────────

import type { WeatherSnapshot, HourlyPoint } from '../../services/weather/weatherStore';
import { getHoursForDate } from '../../services/weather/weatherStore';

export type ActivityId =
  | 'hiking' | 'dog' | 'fishing' | 'sports' | 'yard' | 'work' | 'other';

export interface ChecklistItem {
  label: string;
  hint: string;
}

export interface ActivityDef {
  id: ActivityId;
  label: string;
  /** Hard physical effort lowers the "feels like" limit. */
  strenuous: boolean;
  items: ChecklistItem[];
}

// Feels-like limits (°F) used to judge each hour
const LIMIT_EASY_F = 95;       // below "High Alert" for light activity
const LIMIT_STRENUOUS_F = 90;  // lower limit when working hard
const COMFORT_F = 86;          // below "Caution"

const BASE_ITEMS: ChecklistItem[] = [
  { label: 'Water, and more than you think', hint: 'Drink before you feel thirsty' },
  { label: 'Hat, light loose clothing, sunscreen', hint: 'Light colors reflect heat' },
  { label: 'Phone charged', hint: 'Heat drains batteries fast' },
  { label: 'Tell someone your plan', hint: 'Where you are going and when you will be back' },
  { label: 'Know the warning signs', hint: 'Dizziness, headache, nausea, confusion. Stop and cool down.' },
];

export const ACTIVITIES: ActivityDef[] = [
  {
    id: 'hiking',
    label: 'Hiking',
    strenuous: true,
    items: [
      ...BASE_ITEMS,
      { label: 'Salty snacks or electrolytes', hint: 'Replace what you sweat out' },
      { label: 'Go with someone', hint: 'Avoid hiking alone in the heat' },
      { label: 'Check the trail is open', hint: 'Some trails close on extreme heat days' },
    ],
  },
  {
    id: 'dog',
    label: 'Walking the dog',
    strenuous: false,
    items: [
      { label: 'Test the pavement', hint: 'Back of your hand on the ground. Too hot to hold means too hot for paws.' },
      { label: 'Water for both of you', hint: 'Bring a bowl or bottle for your dog' },
      { label: 'Keep it short, stay in shade', hint: 'Grass and shade are cooler than pavement' },
      { label: 'Watch your dog', hint: 'Heavy panting, drooling or stumbling means stop and cool down' },
      { label: 'Phone charged', hint: 'Heat drains batteries fast' },
    ],
  },
  {
    id: 'fishing',
    label: 'Fishing',
    strenuous: false,
    items: [
      ...BASE_ITEMS,
      { label: 'Shade or an umbrella', hint: 'Water reflects sun, so you get more of it' },
      { label: 'Reapply sunscreen', hint: 'Every couple of hours, more if wet' },
    ],
  },
  {
    id: 'sports',
    label: 'Sports',
    strenuous: true,
    items: [
      ...BASE_ITEMS,
      { label: 'Plan water breaks', hint: 'Regular breaks, even if you feel fine' },
      { label: 'Cooling towel or ice', hint: 'Cool your neck and wrists during breaks' },
      { label: 'Agree on a stop signal', hint: 'Anyone dizzy or confused stops right away' },
    ],
  },
  {
    id: 'yard',
    label: 'Yard work',
    strenuous: true,
    items: [
      ...BASE_ITEMS,
      { label: 'Work early', hint: 'Finish the heavy jobs before it heats up' },
      { label: 'Rest in the shade', hint: 'Take breaks before you need them' },
    ],
  },
  {
    id: 'work',
    label: 'Outdoor job',
    strenuous: true,
    items: [
      { label: 'Water. Rest. Shade.', hint: 'Drink often, take breaks, get out of the sun' },
      { label: 'Know your workplace heat plan', hint: 'Who to tell if you feel sick' },
      { label: 'Work with a buddy', hint: 'Watch each other for warning signs' },
      { label: 'New or back from time off?', hint: 'Your body needs time to adjust to heat' },
      { label: 'Know the warning signs', hint: 'Dizziness, headache, nausea, confusion. Stop and cool down.' },
    ],
  },
  {
    id: 'other',
    label: 'Something else',
    strenuous: false,
    items: BASE_ITEMS,
  },
];

export function getActivity(id: string | undefined): ActivityDef {
  return ACTIVITIES.find(a => a.id === id) ?? ACTIVITIES[ACTIVITIES.length - 1];
}

export function limitFor(activity: ActivityDef): number {
  return activity.strenuous ? LIMIT_STRENUOUS_F : LIMIT_EASY_F;
}

// ── Hour helpers ────────────────────────────────────────────────────────────

export function formatHour(h: number): string {
  const hour = ((h % 24) + 24) % 24;
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

export type HourBand = 'good' | 'caution' | 'danger';

export function bandFor(feelsF: number, limitF: number): HourBand {
  if (feelsF < Math.min(COMFORT_F, limitF)) return 'good';
  if (feelsF < limitF) return 'caution';
  return 'danger';
}

/** Daytime hours (5 AM – 9 PM) for a date, with a band each. */
export function dayBands(
  snapshot: WeatherSnapshot,
  dateKey: string,
  limitF: number,
): { hour: number; feelsF: number; band: HourBand }[] {
  return getHoursForDate(snapshot, dateKey)
    .filter((h: HourlyPoint) => h.hour >= 5 && h.hour <= 21)
    .map(h => ({ hour: h.hour, feelsF: h.feelsLikeF, band: bandFor(h.feelsLikeF, limitF) }));
}

/** Short sentence describing the safer windows for a day. */
export function saferWindowText(bands: { hour: number; band: HourBand }[]): string {
  if (bands.length === 0) return 'No hourly forecast for this day yet.';
  const ok = bands.filter(b => b.band !== 'danger');
  if (ok.length === bands.length) return 'Within safer limits all day. Still take breaks and drink water.';
  if (ok.length === 0) return 'Too hot all day. Go before 5 AM or stay inside.';

  // Group consecutive OK hours into windows
  const windows: { start: number; end: number }[] = [];
  for (const b of ok) {
    const last = windows[windows.length - 1];
    if (last && b.hour === last.end + 1) last.end = b.hour;
    else windows.push({ start: b.hour, end: b.hour });
  }
  const parts = windows.map(w => {
    if (w.start === bands[0].hour) return `before ${formatHour(w.end + 1)}`;
    if (w.end === bands[bands.length - 1].hour) return `after ${formatHour(w.start)}`;
    return `${formatHour(w.start)} – ${formatHour(w.end + 1)}`;
  });
  const text = parts.join(' or ');
  return `Best outside: ${text}`;
}

/**
 * Latest time to be back for an activity starting at `startHour`:
 * the first hour at or after the start that reaches the limit.
 * Returns null if the whole rest of the day is under the limit,
 * or 'tooHot' if it's already over the limit at the start.
 */
export function backByHour(
  bands: { hour: number; band: HourBand }[],
  startHour: number,
): number | null | 'tooHot' {
  const from = bands.filter(b => b.hour >= startHour);
  if (from.length === 0) return null;
  if (from[0].band === 'danger') return 'tooHot';
  const firstDanger = from.find(b => b.band === 'danger');
  return firstDanger ? firstDanger.hour : null;
}
