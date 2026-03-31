// ─── Acclimation Storage ──────────────────────────────────────────────────────

export interface AcclimationState {
  startDate: string | null;       // ISO date string
  completedDays: number[];        // which day numbers are done
  currentDay: number;             // next day to complete (1-14)
  isActive: boolean;
  programStartedAt: string | null;
}

const STORAGE_KEY = 'heatguard_acclimation_v1';

const store = {
  get: (): string | null => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(STORAGE_KEY);
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { MMKV } = require('react-native-mmkv');
      return new MMKV().getString(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  },
  set: (value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, value);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { MMKV } = require('react-native-mmkv');
      new MMKV().set(STORAGE_KEY, value);
    } catch {
      // storage unavailable — fail silently
    }
  },
};

const DEFAULT_STATE: AcclimationState = {
  startDate: null,
  completedDays: [],
  currentDay: 1,
  isActive: false,
  programStartedAt: null,
};

export function getAcclimationState(): AcclimationState {
  const raw = store.get();
  if (!raw) return { ...DEFAULT_STATE };
  try {
    return JSON.parse(raw) as AcclimationState;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveAcclimationState(state: AcclimationState): void {
  store.set(JSON.stringify(state));
}

export function startAcclimationProgram(): AcclimationState {
  const state: AcclimationState = {
    startDate: new Date().toISOString(),
    completedDays: [],
    currentDay: 1,
    isActive: true,
    programStartedAt: new Date().toISOString(),
  };
  saveAcclimationState(state);
  return state;
}

export function completeAcclimationDay(day: number): AcclimationState {
  const state = getAcclimationState();
  if (!state.completedDays.includes(day)) {
    state.completedDays = [...state.completedDays, day].sort((a, b) => a - b);
  }
  state.currentDay = Math.min(day + 1, 15); // 15 = program complete
  if (day >= 14) state.isActive = false;
  saveAcclimationState(state);
  return state;
}

export function resetAcclimationProgram(): void {
  saveAcclimationState({ ...DEFAULT_STATE });
}

export function getStreak(state: AcclimationState): number {
  if (state.completedDays.length === 0) return 0;
  const sorted = [...state.completedDays].sort((a, b) => b - a);
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] === 1) streak++;
    else break;
  }
  return streak;
}
