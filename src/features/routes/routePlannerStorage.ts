// ─────────────────────────────────────────────
// Route Planner Storage
// Persists recent comparisons and saved routes
// ─────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteComparison, Waypoint } from './routePlannerEngine';

const KEYS = {
  RECENT:  'heatguard:routes:recent',
  SAVED:   'heatguard:routes:saved',
  LAST_FROM: 'heatguard:routes:last_from',
  LAST_TO:   'heatguard:routes:last_to',
} as const;

interface SavedRoute {
  comparisonId: string;
  fromId: string;
  toId: string;
  recommendedRouteId: string;
  savedAt: number;
  label: string;
}

// ─── Recent Comparisons ───────────────────────────────────────────────────────

export async function saveRecentComparison(
  comparison: RouteComparison,
  from: Waypoint,
  to: Waypoint,
): Promise<void> {
  try {
    const recent = await loadRecentComparisons();
    const entry = { ...comparison, fromId: from.id, toId: to.id };
    const updated = [entry, ...recent].slice(0, 5); // keep last 5
    await AsyncStorage.setItem(KEYS.RECENT, JSON.stringify(updated));
  } catch {
    // silent
  }
}

export async function loadRecentComparisons(): Promise<(RouteComparison & { fromId: string; toId: string })[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.RECENT);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Last Selected Waypoints ─────────────────────────────────────────────────

export async function saveLastWaypoints(fromId: string, toId: string): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [KEYS.LAST_FROM, fromId],
      [KEYS.LAST_TO, toId],
    ]);
  } catch {
    // silent
  }
}

export async function loadLastWaypoints(): Promise<{ fromId: string | null; toId: string | null }> {
  try {
    const results = await AsyncStorage.multiGet([KEYS.LAST_FROM, KEYS.LAST_TO]);
    return {
      fromId: results[0][1],
      toId:   results[1][1],
    };
  } catch {
    return { fromId: null, toId: null };
  }
}

// ─── Saved Routes ─────────────────────────────────────────────────────────────

export async function saveRoute(saved: SavedRoute): Promise<void> {
  try {
    const existing = await loadSavedRoutes();
    await AsyncStorage.setItem(KEYS.SAVED, JSON.stringify([saved, ...existing].slice(0, 10)));
  } catch {
    // silent
  }
}

export async function loadSavedRoutes(): Promise<SavedRoute[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SAVED);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearRouteData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEYS.RECENT, KEYS.SAVED, KEYS.LAST_FROM, KEYS.LAST_TO]);
  } catch {
    // silent
  }
}
