// ─────────────────────────────────────────────
// HeatGuard Watch Alert Engine
// Smart haptic and alert dispatch strategy for Apple Watch
// ─────────────────────────────────────────────

import { watchBridge } from './watchBridge';
import { pushAlertToWatch } from './watchDataSync';
import type { WatchAlertPayload, ThermalLevel } from './watchTypes';

// ── Alert deduplication ───────────────────────────────────────────────────

const recentAlerts = new Map<string, number>(); // alertKey → last sent timestamp
const COOLDOWN_MS: Record<string, number> = {
  heat_threshold: 10 * 60 * 1000,   // 10 min between heat alerts
  hydration:       5 * 60 * 1000,   // 5 min between hydration nudges
  medication:     60 * 60 * 1000,   // 1 hr between med alerts
  dead_man:        2 * 60 * 1000,   // 2 min for dead man's switch (urgent)
  sos:                          0,  // SOS never throttled
};

function shouldSendAlert(type: WatchAlertPayload['type']): boolean {
  const lastSent = recentAlerts.get(type) ?? 0;
  const cooldown = COOLDOWN_MS[type] ?? 5 * 60 * 1000;
  return Date.now() - lastSent > cooldown;
}

function markAlertSent(type: WatchAlertPayload['type']): void {
  recentAlerts.set(type, Date.now());
}

// ── Alert builders ────────────────────────────────────────────────────────

export function buildThermalAlert(level: ThermalLevel, tempF: number): WatchAlertPayload {
  const messages: Record<ThermalLevel, { title: string; body: string }> = {
    safe:    { title: 'Temperature Normal',  body: `${tempF}°F — conditions are safe.` },
    caution: { title: 'Heat Advisory',       body: `${tempF}°F — stay hydrated and limit exertion.` },
    high:    { title: 'High Heat Alert',     body: `${tempF}°F — move to shade or AC. Drink water now.` },
    extreme: { title: 'Extreme Heat Warning',body: `${tempF}°F — dangerous conditions. Seek cooling immediately.` },
    crisis:  { title: '⚠ HEAT CRISIS',      body: `${tempF}°F — life-threatening. Call 911 if feeling unwell.` },
  };

  const severity: WatchAlertPayload['severity'] =
    level === 'crisis' || level === 'extreme' ? 'critical' :
    level === 'high' ? 'warning' : 'info';

  return {
    id: `heat_${Date.now()}`,
    type: 'heat_threshold',
    severity,
    timestamp: Date.now(),
    ...messages[level],
  };
}

export function buildHydrationAlert(consumed: number, goal: number): WatchAlertPayload {
  const pct = Math.round((consumed / goal) * 100);
  return {
    id: `hydration_${Date.now()}`,
    type: 'hydration',
    severity: 'warning',
    title: 'Hydration Reminder',
    body: `You're at ${pct}% of your water goal. Drink ${Math.ceil((goal - consumed) / 237)} more glasses.`,
    timestamp: Date.now(),
  };
}

export function buildMedicationAlert(medicationName: string): WatchAlertPayload {
  return {
    id: `medication_${Date.now()}`,
    type: 'medication',
    severity: 'warning',
    title: 'Medication Check',
    body: `${medicationName} may reduce heat tolerance. Take extra care in current conditions.`,
    timestamp: Date.now(),
  };
}

export function buildDeadManAlert(): WatchAlertPayload {
  return {
    id: `deadman_${Date.now()}`,
    type: 'dead_man',
    severity: 'critical',
    title: 'Safety Check-In',
    body: 'Tap to confirm you\'re OK. No response = contacting emergency.',
    timestamp: Date.now(),
  };
}

export function buildSOSAlert(): WatchAlertPayload {
  return {
    id: `sos_${Date.now()}`,
    type: 'sos',
    severity: 'critical',
    title: '🆘 SOS Activated',
    body: 'Emergency services being contacted. Stay where you are.',
    timestamp: Date.now(),
  };
}

// ── Dispatch ──────────────────────────────────────────────────────────────

export async function dispatchThermalAlert(
  level: ThermalLevel,
  tempF: number,
): Promise<void> {
  // Only alert at caution and above
  if (level === 'safe') return;
  if (!shouldSendAlert('heat_threshold')) return;

  const alert = buildThermalAlert(level, tempF);
  await pushAlertToWatch(alert);
  markAlertSent('heat_threshold');

  console.log(`[WatchAlerts] Dispatched thermal alert: ${level} @ ${tempF}°F`);
}

export async function dispatchHydrationAlert(
  consumed: number,
  goal: number,
): Promise<void> {
  if (!shouldSendAlert('hydration')) return;

  const alert = buildHydrationAlert(consumed, goal);
  await pushAlertToWatch(alert);
  markAlertSent('hydration');
}

export async function dispatchMedicationAlert(name: string): Promise<void> {
  if (!shouldSendAlert('medication')) return;

  const alert = buildMedicationAlert(name);
  await pushAlertToWatch(alert);
  markAlertSent('medication');
}

export async function dispatchDeadManAlert(): Promise<void> {
  // Dead man's switch — always sends, very short cooldown
  if (!shouldSendAlert('dead_man')) return;

  const alert = buildDeadManAlert();
  await pushAlertToWatch(alert);
  markAlertSent('dead_man');

  // Triple haptic for urgency
  await watchBridge.sendHaptic('critical');
}

export async function dispatchSOSAlert(): Promise<void> {
  // SOS is never throttled
  const alert = buildSOSAlert();
  await pushAlertToWatch(alert);
  markAlertSent('sos');
}

// ── Thermal level change detection ───────────────────────────────────────

let lastThermalLevel: ThermalLevel | null = null;

/**
 * Call this whenever a new temperature reading comes in.
 * Only dispatches alerts when the thermal level escalates (never on de-escalation).
 */
export async function checkAndDispatchThermalEscalation(
  level: ThermalLevel,
  tempF: number,
): Promise<void> {
  const levelOrder: ThermalLevel[] = ['safe', 'caution', 'high', 'extreme', 'crisis'];
  const prevIdx  = lastThermalLevel ? levelOrder.indexOf(lastThermalLevel) : 0;
  const currIdx  = levelOrder.indexOf(level);

  if (currIdx > prevIdx) {
    // Level went up — dispatch alert
    await dispatchThermalAlert(level, tempF);
  }

  lastThermalLevel = level;
}
