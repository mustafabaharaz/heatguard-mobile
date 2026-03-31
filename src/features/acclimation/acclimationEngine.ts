// ─── Acclimation Engine ───────────────────────────────────────────────────────
// Science-based 14-day heat acclimation protocol.
// Based on sports medicine literature: plasma volume expansion, sweat rate
// adaptation, cardiovascular efficiency, and electrolyte regulation.

export type AcclimationPhase = 'introduction' | 'adaptation' | 'progressive' | 'consolidation';

export interface DailyAcclimationTask {
  day: number;
  phase: AcclimationPhase;
  durationMinutes: number;
  bestTimeOfDay: string;
  intensity: 'light' | 'moderate' | 'moderate-high';
  physiologicalGoal: string;
  tips: string[];
  adaptationUnlocked?: string;
}

export interface AcclimationProgram {
  totalDays: number;
  tasks: DailyAcclimationTask[];
}

// HeatProfile subset needed for personalization
interface ProfileInput {
  age: number;
  activityLevel: string;
  // boolean flags (real HeatProfile shape)
  isElderly?: boolean;
  hasDiabetes?: boolean;
  hasHeartDisease?: boolean;
  hasRespiratoryIssues?: boolean;
  hasKidneyDisease?: boolean;
  // optional array fallback
  conditions?: string[];
}

type BaseTask = Omit<DailyAcclimationTask, 'day'>;

const BASE_PROTOCOL: BaseTask[] = [
  // ── Phase 1: Introduction (Days 1–3) ─────────────────────────────────────
  {
    phase: 'introduction',
    durationMinutes: 20,
    bestTimeOfDay: 'Before 9 AM or after 7 PM',
    intensity: 'light',
    physiologicalGoal: 'Trigger initial plasma volume expansion',
    tips: [
      'Stay in shade as much as possible',
      'Drink 500ml of water before starting',
      'Stop immediately if you feel dizzy or nauseous',
    ],
  },
  {
    phase: 'introduction',
    durationMinutes: 25,
    bestTimeOfDay: 'Before 9 AM or after 7 PM',
    intensity: 'light',
    physiologicalGoal: 'Begin sweat rate adaptation',
    tips: [
      'Notice your sweating response — it should start earlier than usual',
      'Wear light, breathable, light-colored clothing',
      'Rest in shade between intervals',
    ],
  },
  {
    phase: 'introduction',
    durationMinutes: 30,
    bestTimeOfDay: 'Before 10 AM or after 6 PM',
    intensity: 'light',
    physiologicalGoal: 'Establish cardiovascular baseline',
    tips: [
      'Your resting heart rate in heat should be lower today than Day 1',
      'If not, take an extra rest day — never skip recovery',
      'Electrolyte drink recommended after session',
    ],
    adaptationUnlocked: 'Increased Sweat Rate',
  },

  // ── Phase 2: Adaptation (Days 4–7) ───────────────────────────────────────
  {
    phase: 'adaptation',
    durationMinutes: 35,
    bestTimeOfDay: 'Before 10 AM or after 6 PM',
    intensity: 'moderate',
    physiologicalGoal: 'Expand blood plasma volume',
    tips: [
      'Add electrolytes to your water today',
      'Core temperature should feel more manageable than Week 1',
      'Your body is producing ~10% more plasma now',
    ],
  },
  {
    phase: 'adaptation',
    durationMinutes: 40,
    bestTimeOfDay: 'Before 11 AM or after 5 PM',
    intensity: 'moderate',
    physiologicalGoal: 'Lower core temperature set-point',
    tips: [
      'Your sweat may taste less salty — a sign of aldosterone adaptation',
      'Hydrate every 15 minutes during the session',
      'Mild discomfort is normal; sharp pain or confusion — stop immediately',
    ],
  },
  {
    phase: 'adaptation',
    durationMinutes: 45,
    bestTimeOfDay: 'Before 11 AM or after 5 PM',
    intensity: 'moderate',
    physiologicalGoal: 'Improve skin blood flow efficiency',
    tips: [
      'Notice earlier, heavier sweating compared to Day 1 — that is progress',
      'Your skin should feel more comfortable in the heat',
      'Cooling vest or wet towel during recovery is excellent',
    ],
  },
  {
    phase: 'adaptation',
    durationMinutes: 45,
    bestTimeOfDay: 'Before 11 AM or after 5 PM',
    intensity: 'moderate',
    physiologicalGoal: 'Consolidate plasma volume gains',
    tips: [
      'You are now 50% acclimated — most people feel the shift today',
      'Your heart rate in the same heat will be noticeably lower',
      'Track your resting morning heart rate to see the adaptation',
    ],
    adaptationUnlocked: 'Plasma Volume Expansion',
  },

  // ── Phase 3: Progressive (Days 8–11) ─────────────────────────────────────
  {
    phase: 'progressive',
    durationMinutes: 50,
    bestTimeOfDay: 'Before noon or after 4 PM',
    intensity: 'moderate-high',
    physiologicalGoal: 'Train cardiovascular response to peak heat',
    tips: [
      'Midday light exposure now appropriate',
      'Keep cold water accessible at all times',
      'Your sweat onset should now happen within 5 minutes of heat exposure',
    ],
  },
  {
    phase: 'progressive',
    durationMinutes: 55,
    bestTimeOfDay: 'Before noon or after 4 PM',
    intensity: 'moderate-high',
    physiologicalGoal: 'Optimize sweating efficiency',
    tips: [
      'Your core temperature recovery should be faster now',
      'Push through brief discomfort — not pain or confusion',
      'Splash cool water on wrists and neck during breaks',
    ],
  },
  {
    phase: 'progressive',
    durationMinutes: 60,
    bestTimeOfDay: '9 AM–12 PM or 4–6 PM',
    intensity: 'moderate-high',
    physiologicalGoal: 'Build tolerance to sustained heat exposure',
    tips: [
      'You have earned midday tolerance',
      'Check in with your body every 10 minutes',
      'Fuel with carbohydrates before — heat increases energy demand',
    ],
    adaptationUnlocked: 'Cardiovascular Efficiency',
  },
  {
    phase: 'progressive',
    durationMinutes: 60,
    bestTimeOfDay: '9 AM–12 PM or 4–6 PM',
    intensity: 'moderate-high',
    physiologicalGoal: 'Reinforce hormonal heat response',
    tips: [
      'Aldosterone adaptation now protecting your electrolyte balance',
      'Your sweating is now 30–40% more efficient than Day 1',
      'Maintain consistent sleep — heat adaptation requires quality rest',
    ],
    adaptationUnlocked: 'Electrolyte Regulation',
  },

  // ── Phase 4: Consolidation (Days 12–14) ──────────────────────────────────
  {
    phase: 'consolidation',
    durationMinutes: 70,
    bestTimeOfDay: 'Any time — you are ready',
    intensity: 'moderate-high',
    physiologicalGoal: 'Achieve full thermal regulation mastery',
    tips: [
      'You can now tolerate full-day heat exposure safely',
      'Maintain hydration as always — acclimation does not eliminate the need',
      'Your body now sweats earlier, more, and more efficiently',
    ],
  },
  {
    phase: 'consolidation',
    durationMinutes: 75,
    bestTimeOfDay: 'Any time',
    intensity: 'moderate-high',
    physiologicalGoal: 'Consolidate all physiological gains',
    tips: [
      'Your sweat now contains less salt — kidneys are protecting electrolytes',
      'Acclimation lasts approximately 2 weeks after the program ends',
      'Re-acclimate after 2+ weeks away from heat exposure',
    ],
  },
  {
    phase: 'consolidation',
    durationMinutes: 80,
    bestTimeOfDay: 'Any time',
    intensity: 'moderate-high',
    physiologicalGoal: 'Full heat acclimation achieved',
    tips: [
      'You have completed the HeatGuard 14-Day Acclimation Protocol',
      'Your heat tolerance is now in the top 20% of the general population',
      'Stay vigilant — even fully acclimated individuals need hydration and rest',
    ],
    adaptationUnlocked: 'Full Heat Acclimation',
  },
];

// ─── Program Generator ────────────────────────────────────────────────────────

function getPersonalizationFactor(profile: ProfileInput): number {
  let factor = 1.0;

  // Age-based reduction
  if (profile.age > 65) factor *= 0.7;
  else if (profile.age > 55) factor *= 0.82;
  else if (profile.age > 45) factor *= 0.92;

  // Condition-based reduction — support both boolean fields and array
  const cond = profile.conditions ?? [];
  if (profile.hasHeartDisease || cond.includes('heart_disease') || cond.includes('cardiac')) factor *= 0.65;
  if (profile.hasDiabetes    || cond.includes('diabetes'))      factor *= 0.82;
  if (profile.hasKidneyDisease || cond.includes('kidney_disease')) factor *= 0.80;

  // Activity-based adjustment
  const activityFactors: Record<string, number> = {
    sedentary: 0.75, none: 0.75,
    light: 0.88, low: 0.88,
    moderate: 1.0,
    active: 1.08, high: 1.08,
    athlete: 1.15,
  };
  factor *= activityFactors[profile.activityLevel] ?? 1.0;

  return Math.min(Math.max(factor, 0.45), 1.15);
}

export function generateAcclimationProgram(profile: ProfileInput): AcclimationProgram {
  const factor = getPersonalizationFactor(profile);

  const tasks: DailyAcclimationTask[] = BASE_PROTOCOL.map((task, i) => ({
    ...task,
    day: i + 1,
    durationMinutes: Math.max(10, Math.round(task.durationMinutes * factor)),
  }));

  return { totalDays: 14, tasks };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getAcclimationScore(completedDays: number): number {
  return Math.min(Math.round((completedDays / 14) * 100), 100);
}

export function getPhaseLabel(phase: AcclimationPhase): string {
  const labels: Record<AcclimationPhase, string> = {
    introduction: 'Introduction',
    adaptation: 'Adaptation',
    progressive: 'Progressive',
    consolidation: 'Consolidation',
  };
  return labels[phase];
}

export function getPhaseColor(phase: AcclimationPhase): string {
  const colors: Record<AcclimationPhase, string> = {
    introduction: '#22C55E',
    adaptation: '#F59E0B',
    progressive: '#F97316',
    consolidation: '#3B82F6',
  };
  return colors[phase];
}

export function getIntensityLabel(intensity: DailyAcclimationTask['intensity']): string {
  const labels = {
    light: 'Light',
    moderate: 'Moderate',
    'moderate-high': 'Moderate–High',
  };
  return labels[intensity];
}
