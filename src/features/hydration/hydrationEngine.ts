// ─── Hydration Engine ─────────────────────────────────────────────────────────
// Calculates personalized daily fluid targets using WHO/NAM guidelines
// adjusted for ambient temperature, activity level, age, and body weight.

// HeatProfile subset
interface ProfileInput {
  age: number | string;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
  conditions?: string[];
  weight?: number; // kg — optional, defaults to 70
}

export interface HydrationTarget {
  dailyTargetMl: number;
  dailyTargetOz: number;
  hourlyReminderMl: number;
  breakdown: {
    baseMl: number;
    heatBonusMl: number;
    activityBonusMl: number;
    ageAdjustmentMl: number;
  };
}

export interface HydrationLog {
  id: string;
  timestamp: string; // ISO
  amountMl: number;
  note?: string;
}

export interface HydrationSummary {
  target: HydrationTarget;
  consumedMl: number;
  consumedOz: number;
  remainingMl: number;
  percentComplete: number;
  status: 'complete' | 'on_track' | 'behind' | 'critical';
  minutesSinceLastDrink: number;
  hourlyPaceNeeded: number; // ml/hour needed to hit target by bedtime
}

// ─── Target Calculation ───────────────────────────────────────────────────────

export function calculateHydrationTarget(
  profile: ProfileInput,
  currentTempF: number,
): HydrationTarget {
  const weightKg = profile.weight ?? 70;

  // Base: 35ml per kg body weight (National Academy of Medicine baseline)
  const baseMl = Math.round(weightKg * 35);

  // Heat bonus: +400ml per 5°F above 95°F threshold
  const heatBonusMl =
    currentTempF > 95
      ? Math.round(Math.min(((currentTempF - 95) / 5) * 400, 2000))
      : 0;

  // Activity bonus
  const activityBonusMap: Record<string, number> = {
    sedentary: 0,
    light: 350,
    moderate: 700,
    active: 1000,
    athlete: 1400,
  };
  const activityBonusMl = activityBonusMap[profile.activityLevel] ?? 350;

  // Age adjustment: older adults have reduced thirst perception
  // and are at higher risk for dehydration
  const ageAdjustmentMl =
    Number(profile.age) > 70 ? 450 : Number(profile.age) > 65 ? 300 : Number(profile.age) > 55 ? 150 : 0;

  const dailyTargetMl = Math.round(
    baseMl + heatBonusMl + activityBonusMl + ageAdjustmentMl,
  );

  // Spread across 16 waking hours
  const hourlyReminderMl = Math.round(dailyTargetMl / 16);

  return {
    dailyTargetMl,
    dailyTargetOz: Math.round(dailyTargetMl / 29.574),
    hourlyReminderMl,
    breakdown: {
      baseMl,
      heatBonusMl,
      activityBonusMl,
      ageAdjustmentMl,
    },
  };
}

// ─── Summary Calculation ──────────────────────────────────────────────────────

export function computeHydrationSummary(
  target: HydrationTarget,
  logs: HydrationLog[],
): HydrationSummary {
  const today = new Date().toDateString();
  const todayLogs = logs.filter(
    (l) => new Date(l.timestamp).toDateString() === today,
  );

  const consumedMl = todayLogs.reduce((sum, l) => sum + l.amountMl, 0);
  const consumedOz = Math.round(consumedMl / 29.574);
  const remainingMl = Math.max(target.dailyTargetMl - consumedMl, 0);
  const percentComplete = Math.min(
    Math.round((consumedMl / target.dailyTargetMl) * 100),
    100,
  );

  const lastLog = todayLogs[todayLogs.length - 1];
  const minutesSinceLastDrink = lastLog
    ? Math.round((Date.now() - new Date(lastLog.timestamp).getTime()) / 60_000)
    : 999;

  // Calculate hourly pace needed to hit target by 10 PM
  const hourOfDay = new Date().getHours();
  const wakeHoursRemaining = Math.max(22 - hourOfDay, 1);
  const hourlyPaceNeeded = Math.round(remainingMl / wakeHoursRemaining);

  let status: HydrationSummary['status'];
  if (percentComplete >= 100) {
    status = 'complete';
  } else if (hourlyPaceNeeded > target.hourlyReminderMl * 2.5) {
    status = 'critical';
  } else if (minutesSinceLastDrink > 100 || hourlyPaceNeeded > target.hourlyReminderMl * 1.5) {
    status = 'behind';
  } else {
    status = 'on_track';
  }

  return {
    target,
    consumedMl,
    consumedOz,
    remainingMl,
    percentComplete,
    status,
    minutesSinceLastDrink,
    hourlyPaceNeeded,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getStatusColor(status: HydrationSummary['status']): string {
  const map: Record<HydrationSummary['status'], string> = {
    complete: '#22C55E',
    on_track: '#3B82F6',
    behind: '#F59E0B',
    critical: '#EF4444',
  };
  return map[status];
}

export function getStatusLabel(status: HydrationSummary['status']): string {
  const map: Record<HydrationSummary['status'], string> = {
    complete: 'Target Reached',
    on_track: 'On Track',
    behind: 'Falling Behind',
    critical: 'Dangerously Low',
  };
  return map[status];
}

export function getStatusMessage(status: HydrationSummary['status'], remainingOz: number): string {
  switch (status) {
    case 'complete':
      return 'You have hit your hydration target. Excellent.';
    case 'on_track':
      return `${remainingOz} oz remaining today. You are keeping pace.`;
    case 'behind':
      return `${remainingOz} oz remaining. Drink more frequently.`;
    case 'critical':
      return `${remainingOz} oz remaining. Dehydration risk is HIGH — drink now.`;
  }
}

export function mlToOz(ml: number): number {
  return Math.round(ml / 29.574);
}

export function formatMl(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)}L`;
  return `${ml}ml`;
}

// Quick-add preset amounts
export const QUICK_ADD_OPTIONS = [
  { label: 'Sip', amountMl: 120, emoji: '💧' },
  { label: 'Cup', amountMl: 240, emoji: '🥤' },
  { label: 'Bottle', amountMl: 500, emoji: '🍶' },
  { label: '1L', amountMl: 1000, emoji: '⬛' },
] as const;
