// ─────────────────────────────────────────────
// HeatGuard Watch Types
// Shared message contracts between iOS app and watchOS app
// ─────────────────────────────────────────────

export type ThermalLevel = 'safe' | 'caution' | 'high' | 'extreme' | 'crisis';

export interface WatchThermalPayload {
  temperature: number;          // Fahrenheit
  temperatureC: number;         // Celsius
  thermalLevel: ThermalLevel;
  feelsLike: number;
  humidity: number;
  heatIndex: number;
  riskScore: number;            // 0–100
  riskLabel: string;            // "LOW" | "MODERATE" | "HIGH" | "EXTREME"
  updatedAt: number;            // Unix timestamp
}

export interface WatchHydrationPayload {
  consumed: number;             // ml
  goal: number;                 // ml
  lastDrinkAt: number;          // Unix timestamp
  nextReminderIn: number;       // seconds
  percentage: number;           // 0–100
}

export interface WatchAlertPayload {
  id: string;
  type: 'heat_threshold' | 'hydration' | 'medication' | 'dead_man' | 'sos';
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
}

export interface WatchUserPayload {
  name: string;
  age: number;
  hasConditions: boolean;
  medicationCount: number;
  emergencyContactName: string;
  threshold: number;            // personal alert threshold °F
}

// Full application context sent to Watch
export interface WatchApplicationContext {
  thermal: WatchThermalPayload;
  hydration: WatchHydrationPayload;
  user: WatchUserPayload;
  activeAlerts: WatchAlertPayload[];
  exposureMinutes: number;
  isInCrisisMode: boolean;
  lastSyncAt: number;
}

// Messages the Watch can send TO the phone
export type WatchToPhoneMessage =
  | { type: 'SOS_TRIGGERED'; timestamp: number }
  | { type: 'HYDRATION_LOGGED'; amount: number; timestamp: number }
  | { type: 'CHECKIN_CONFIRMED'; timestamp: number }
  | { type: 'REQUEST_SYNC'; timestamp: number }
  | { type: 'HEART_RATE_UPDATE'; bpm: number; timestamp: number };

// Messages the phone can send TO the Watch
export type PhoneToWatchMessage =
  | { type: 'ALERT'; payload: WatchAlertPayload }
  | { type: 'THERMAL_UPDATE'; payload: WatchThermalPayload }
  | { type: 'HAPTIC'; pattern: 'warning' | 'critical' | 'success' | 'reminder' }
  | { type: 'SOS_ACKNOWLEDGED'; timestamp: number };

export const THERMAL_COLORS: Record<ThermalLevel, string> = {
  safe:    '#22C55E',
  caution: '#EAB308',
  high:    '#F97316',
  extreme: '#EF4444',
  crisis:  '#7C3AED',
};

export const THERMAL_LABELS: Record<ThermalLevel, string> = {
  safe:    'SAFE',
  caution: 'CAUTION',
  high:    'HIGH ALERT',
  extreme: 'EXTREME',
  crisis:  'CRISIS',
};

export function getThermalLevelFromTemp(tempF: number): ThermalLevel {
  if (tempF < 80)  return 'safe';
  if (tempF < 90)  return 'caution';
  if (tempF < 103) return 'high';
  if (tempF < 115) return 'extreme';
  return 'crisis';
}

export function getRiskScoreFromLevel(level: ThermalLevel): number {
  const map: Record<ThermalLevel, number> = {
    safe: 10, caution: 30, high: 55, extreme: 78, crisis: 95,
  };
  return map[level];
}
