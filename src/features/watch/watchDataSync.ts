// ─────────────────────────────────────────────
// HeatGuard Watch Data Sync
// Assembles full app state and pushes it to the Watch
// ─────────────────────────────────────────────

import { watchBridge } from './watchBridge';
import {
  getThermalLevelFromTemp,
  getRiskScoreFromLevel,
  type WatchApplicationContext,
  type WatchThermalPayload,
  type WatchAlertPayload,
  type ThermalLevel,
} from './watchTypes';
import { getHeatProfile } from '../profile/storage/profileStorage';
import { getHydrationLog } from '../hydration/hydrationStorage';
import { getExposureSessions } from '../intelligence/exposureStorage';

// ── Sync interval ─────────────────────────────────────────────────────────

let syncTimer: ReturnType<typeof setInterval> | null = null;
const SYNC_INTERVAL_MS = 60_000; // 1 minute background sync

// ── Thermal data assembly ─────────────────────────────────────────────────

interface RawWeatherData {
  temperatureF: number;
  feelsLikeF: number;
  humidity: number;
  heatIndexF: number;
}

export function buildThermalPayload(weather: RawWeatherData): WatchThermalPayload {
  const level: ThermalLevel = getThermalLevelFromTemp(weather.heatIndexF);
  const riskScore = getRiskScoreFromLevel(level);

  const riskLabel =
    riskScore < 25 ? 'LOW' :
    riskScore < 50 ? 'MODERATE' :
    riskScore < 75 ? 'HIGH' : 'EXTREME';

  return {
    temperature: Math.round(weather.temperatureF),
    temperatureC: Math.round((weather.temperatureF - 32) * 5 / 9),
    thermalLevel: level,
    feelsLike: Math.round(weather.feelsLikeF),
    humidity: Math.round(weather.humidity),
    heatIndex: Math.round(weather.heatIndexF),
    riskScore,
    riskLabel,
    updatedAt: Date.now(),
  };
}

// ── Context assembly ──────────────────────────────────────────────────────

export async function buildWatchContext(
  weather: RawWeatherData,
  activeAlerts: WatchAlertPayload[] = [],
): Promise<WatchApplicationContext> {
  const profile = await getHeatProfile();
  const hydration = await getHydrationLog();
  const exposureSessions = await getExposureSessions();

  // Sum today's exposure minutes
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const exposureMinutes = exposureSessions
    .filter(s => s.startTime >= todayStart.getTime())
    .reduce((acc, s) => acc + Math.round((s.endTime - s.startTime) / 60_000), 0);

  const thermal = buildThermalPayload(weather);
  const isInCrisisMode = thermal.thermalLevel === 'crisis' || thermal.riskScore >= 90;

  // Hydration summary
  const todayLog = hydration?.todayLog ?? [];
  const consumed = todayLog.reduce((a: number, b: any) => a + (b.amount ?? 0), 0);
  const goal = hydration?.dailyGoal ?? 3000;
  const lastEntry = todayLog[todayLog.length - 1];
  const lastDrinkAt = lastEntry?.timestamp ?? 0;
  const nextReminderIn = Math.max(0, (lastDrinkAt + 90 * 60 * 1000) - Date.now()) / 1000;

  return {
    thermal,
    hydration: {
      consumed,
      goal,
      lastDrinkAt,
      nextReminderIn,
      percentage: Math.min(100, Math.round((consumed / goal) * 100)),
    },
    user: {
      name: profile?.name ?? 'User',
      age: typeof profile?.age === 'string' ? parseInt(profile.age) : (profile?.age ?? 30),
      hasConditions: !!(profile?.conditions && profile.conditions.length > 0),
      medicationCount: profile?.medications?.length ?? 0,
      emergencyContactName: profile?.emergencyContacts?.[0]?.name ?? 'Emergency Contact',
      threshold: profile?.alertThreshold ?? 100,
    },
    activeAlerts: activeAlerts.slice(0, 5), // Watch shows max 5 alerts
    exposureMinutes,
    isInCrisisMode,
    lastSyncAt: Date.now(),
  };
}

// ── Push to Watch ─────────────────────────────────────────────────────────

/**
 * Primary sync — updates Watch application context with full app state.
 * Context is persisted on Watch and available even when phone is out of range.
 */
export async function syncToWatch(
  weather: RawWeatherData,
  activeAlerts: WatchAlertPayload[] = [],
): Promise<boolean> {
  const status = watchBridge.status;
  if (!status.isSupported || !status.isPaired) return false;

  try {
    const context = await buildWatchContext(weather, activeAlerts);
    const success = await watchBridge.updateContext(context);

    if (success) {
      console.log('[WatchSync] Context pushed to Watch:', {
        temp: context.thermal.temperature,
        level: context.thermal.thermalLevel,
        hydration: context.hydration.percentage + '%',
      });
    }

    return success;
  } catch (err) {
    console.error('[WatchSync] Sync failed:', err);
    return false;
  }
}

/**
 * Push a critical alert to Watch immediately via real-time message.
 * Falls back to context update if Watch is not reachable.
 */
export async function pushAlertToWatch(alert: WatchAlertPayload): Promise<void> {
  // Try real-time message first
  const sent = await watchBridge.sendMessage({ type: 'ALERT', payload: alert });

  // Also fire haptic for critical alerts
  if (alert.severity === 'critical') {
    await watchBridge.sendHaptic('critical');
  } else if (alert.severity === 'warning') {
    await watchBridge.sendHaptic('warning');
  }

  if (!sent) {
    // Watch not reachable — queue via transferUserInfo for delivery when in range
    console.log('[WatchSync] Watch not reachable, queuing alert via transferUserInfo');
    await watchBridge.transferUserInfo({ activeAlerts: [alert] });
  }
}

// ── Background sync ───────────────────────────────────────────────────────

export function startBackgroundSync(getWeather: () => RawWeatherData | null): void {
  if (syncTimer) return; // Already running

  syncTimer = setInterval(async () => {
    const weather = getWeather();
    if (weather) {
      await syncToWatch(weather);
    }
  }, SYNC_INTERVAL_MS);

  console.log('[WatchSync] Background sync started (every 60s)');
}

export function stopBackgroundSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('[WatchSync] Background sync stopped');
  }
}

// ── Handle incoming Watch messages ────────────────────────────────────────

import type { WatchToPhoneMessage } from './watchTypes';
import { triggerSOS } from '../emergency/sosEngine';
import { logHydration } from '../hydration/hydrationEngine';

export function handleWatchMessage(
  message: WatchToPhoneMessage,
  callbacks: {
    onSOS?: () => void;
    onHydrationLogged?: (amount: number) => void;
    onHeartRateUpdate?: (bpm: number) => void;
    onCheckin?: () => void;
  } = {},
): void {
  console.log('[WatchSync] Received from Watch:', message.type);

  switch (message.type) {
    case 'SOS_TRIGGERED':
      callbacks.onSOS?.();
      watchBridge.sendMessage({ type: 'SOS_ACKNOWLEDGED', timestamp: Date.now() });
      break;

    case 'HYDRATION_LOGGED':
      logHydration(message.amount).catch(console.error);
      callbacks.onHydrationLogged?.(message.amount);
      watchBridge.sendHaptic('success');
      break;

    case 'HEART_RATE_UPDATE':
      callbacks.onHeartRateUpdate?.(message.bpm);
      break;

    case 'CHECKIN_CONFIRMED':
      callbacks.onCheckin?.();
      watchBridge.sendHaptic('success');
      break;

    case 'REQUEST_SYNC':
      // Watch requested a fresh sync — fire immediately
      // Caller should pass current weather to syncToWatch
      break;
  }
}
