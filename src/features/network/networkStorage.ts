// ─────────────────────────────────────────────
// Emergency Network Hub Storage
// ─────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NetworkSnapshot, DispatchRequest } from './networkEngine';

const KEYS = {
  SNAPSHOT: 'heatguard:network:snapshot',
  MY_REQUESTS: 'heatguard:network:my_requests',
  FAVORITED_SHELTERS: 'heatguard:network:favorited_shelters',
} as const;

// ─── Snapshot ────────────────────────────────────────────────────────────────

export async function saveNetworkSnapshot(snapshot: NetworkSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.SNAPSHOT, JSON.stringify(snapshot));
  } catch {
    // silent
  }
}

export async function loadNetworkSnapshot(): Promise<NetworkSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SNAPSHOT);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as NetworkSnapshot;
    // Expire after 10 minutes — network status changes quickly
    const ageMs = Date.now() - snapshot.generatedAt;
    if (ageMs > 10 * 60 * 1000) return null;
    return snapshot;
  } catch {
    return null;
  }
}

// ─── User Dispatch Requests ──────────────────────────────────────────────────

export async function saveMyRequest(request: DispatchRequest): Promise<void> {
  try {
    const existing = await loadMyRequests();
    await AsyncStorage.setItem(
      KEYS.MY_REQUESTS,
      JSON.stringify([request, ...existing]),
    );
  } catch {
    // silent
  }
}

export async function loadMyRequests(): Promise<DispatchRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MY_REQUESTS);
    return raw ? (JSON.parse(raw) as DispatchRequest[]) : [];
  } catch {
    return [];
  }
}

// ─── Favorited Shelters ──────────────────────────────────────────────────────

export async function toggleFavoriteShelter(shelterId: string): Promise<boolean> {
  try {
    const favs = await loadFavoriteShelters();
    const isFav = favs.includes(shelterId);
    const updated = isFav ? favs.filter((id) => id !== shelterId) : [...favs, shelterId];
    await AsyncStorage.setItem(KEYS.FAVORITED_SHELTERS, JSON.stringify(updated));
    return !isFav;
  } catch {
    return false;
  }
}

export async function loadFavoriteShelters(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.FAVORITED_SHELTERS);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function clearNetworkData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      KEYS.SNAPSHOT,
      KEYS.MY_REQUESTS,
      KEYS.FAVORITED_SHELTERS,
    ]);
  } catch {
    // silent
  }
}
