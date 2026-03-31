// ─────────────────────────────────────────────
// Neighborhood Storage
// Persists snapshots and alert dismissals
// ─────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NeighborhoodSnapshot, NeighborhoodAlert } from './neighborhoodEngine';

const KEYS = {
  SNAPSHOT: 'heatguard:neighborhood:snapshot',
  DISMISSED: 'heatguard:neighborhood:dismissed',
  CUSTOM_THRESHOLDS: 'heatguard:neighborhood:thresholds',
} as const;

// ─── Snapshot ────────────────────────────────────────────────────────────────

export async function saveSnapshot(snapshot: NeighborhoodSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.SNAPSHOT, JSON.stringify(snapshot));
  } catch {
    // silent — non-critical
  }
}

export async function loadSnapshot(): Promise<NeighborhoodSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SNAPSHOT);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as NeighborhoodSnapshot;
    // Expire after 30 minutes — force fresh computation
    const ageMs = Date.now() - snapshot.generatedAt;
    if (ageMs > 30 * 60 * 1000) return null;
    return snapshot;
  } catch {
    return null;
  }
}

// ─── Alert Dismissals ────────────────────────────────────────────────────────

export async function dismissAlert(alertId: string): Promise<void> {
  try {
    const dismissed = await getDismissedAlertIds();
    if (!dismissed.includes(alertId)) {
      await AsyncStorage.setItem(
        KEYS.DISMISSED,
        JSON.stringify([...dismissed, alertId]),
      );
    }
  } catch {
    // silent
  }
}

export async function getDismissedAlertIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DISMISSED);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function filterActiveAlerts(
  alerts: NeighborhoodAlert[],
): Promise<NeighborhoodAlert[]> {
  const dismissed = await getDismissedAlertIds();
  return alerts.filter((a) => !dismissed.includes(a.id));
}

// ─── Custom Thresholds (per block alert level) ────────────────────────────────

export interface BlockThreshold {
  blockId: string;
  alertAtHeatIndex: number;
}

export async function saveThresholds(thresholds: BlockThreshold[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.CUSTOM_THRESHOLDS, JSON.stringify(thresholds));
  } catch {
    // silent
  }
}

export async function loadThresholds(): Promise<BlockThreshold[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CUSTOM_THRESHOLDS);
    return raw ? (JSON.parse(raw) as BlockThreshold[]) : [];
  } catch {
    return [];
  }
}

export async function clearNeighborhoodData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      KEYS.SNAPSHOT,
      KEYS.DISMISSED,
      KEYS.CUSTOM_THRESHOLDS,
    ]);
  } catch {
    // silent
  }
}
