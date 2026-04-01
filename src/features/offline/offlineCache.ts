// ─────────────────────────────────────────────
// Offline Cache Manager
// Unified TTL cache with 3 priority tiers.
// All safety-critical data survives offline.
// ─────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Priority Tiers ───────────────────────────────────────────────────────────

export type CachePriority = 'critical' | 'important' | 'fresh';

const TTL_MS: Record<CachePriority, number> = {
  critical:  Infinity,          // Never expires — emergency contacts, symptoms
  important: 24 * 60 * 60_000, // 24 hours — shelters, profile, medications
  fresh:     30 * 60_000,       // 30 minutes — temperature, neighborhood
};

// ─── Cache Entry ──────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  key: string;
  data: T;
  priority: CachePriority;
  cachedAt: number;
  expiresAt: number;
  version: number;
}

export interface CacheReadResult<T> {
  data: T;
  isStale: boolean;
  cachedAt: number;
  ageMs: number;
  ageLabel: string;
}

// ─── Key Registry ─────────────────────────────────────────────────────────────
// Centralised so nothing is ever misspelled

export const CACHE_KEYS = {
  // Critical — never expire
  EMERGENCY_CONTACTS:  'cache:critical:emergency_contacts',
  HEAT_SYMPTOMS:       'cache:critical:heat_symptoms',
  SOS_INSTRUCTIONS:    'cache:critical:sos_instructions',
  HEAT_PROFILE:        'cache:critical:heat_profile',

  // Important — 24 h
  SHELTER_LIST:        'cache:important:shelter_list',
  MEDICATIONS:         'cache:important:medications',
  ACCLIMATION_PLAN:    'cache:important:acclimation_plan',
  COMMUNITY_RESOURCES: 'cache:important:community_resources',

  // Fresh — 30 min
  TEMPERATURE_NOW:     'cache:fresh:temperature_now',
  NEIGHBORHOOD_SNAP:   'cache:fresh:neighborhood_snap',
  NETWORK_SNAP:        'cache:fresh:network_snap',
  DAILY_BRIEF:         'cache:fresh:daily_brief',
  FORECAST:            'cache:fresh:forecast',
} as const;

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];

// ─── Priority lookup ──────────────────────────────────────────────────────────

function getPriority(key: CacheKey): CachePriority {
  if (key.startsWith('cache:critical:'))  return 'critical';
  if (key.startsWith('cache:important:')) return 'important';
  return 'fresh';
}

// ─── Age Label ────────────────────────────────────────────────────────────────

function buildAgeLabel(ageMs: number): string {
  const mins = Math.floor(ageMs / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Core API ─────────────────────────────────────────────────────────────────

export async function cacheSet<T>(key: CacheKey, data: T): Promise<void> {
  try {
    const priority = getPriority(key);
    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      data,
      priority,
      cachedAt: now,
      expiresAt: TTL_MS[priority] === Infinity ? Infinity : now + TTL_MS[priority],
      version: 1,
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable — silent
  }
}

export async function cacheGet<T>(key: CacheKey): Promise<CacheReadResult<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    const ageMs = Date.now() - entry.cachedAt;
    const isStale =
      entry.expiresAt !== Infinity && Date.now() > entry.expiresAt;

    return {
      data: entry.data,
      isStale,
      cachedAt: entry.cachedAt,
      ageMs,
      ageLabel: buildAgeLabel(ageMs),
    };
  } catch {
    return null;
  }
}

/**
 * Get cached data regardless of staleness.
 * Returns null only if the key has never been cached.
 */
export async function cacheGetStale<T>(key: CacheKey): Promise<CacheReadResult<T> | null> {
  return cacheGet<T>(key);
}

/**
 * Get cached data only if fresh (not expired).
 * Returns null if missing or expired.
 */
export async function cacheGetFresh<T>(key: CacheKey): Promise<T | null> {
  const result = await cacheGet<T>(key);
  if (!result || result.isStale) return null;
  return result.data;
}

export async function cacheDelete(key: CacheKey): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // silent
  }
}

export async function cacheClearTier(priority: CachePriority): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const prefix = `cache:${priority}:`;
    const matching = allKeys.filter((k) => k.startsWith(prefix));
    if (matching.length) await AsyncStorage.multiRemove(matching);
  } catch {
    // silent
  }
}

export async function cacheClearAll(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith('cache:'));
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  } catch {
    // silent
  }
}

// ─── Cache Inventory ──────────────────────────────────────────────────────────

export interface CacheInventoryItem {
  key: string;
  priority: CachePriority;
  cachedAt: number | null;
  isStale: boolean;
  ageLabel: string;
  hasData: boolean;
}

export async function getCacheInventory(): Promise<CacheInventoryItem[]> {
  const items: CacheInventoryItem[] = [];

  for (const key of Object.values(CACHE_KEYS) as CacheKey[]) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) {
        items.push({
          key,
          priority: getPriority(key),
          cachedAt: null,
          isStale: true,
          ageLabel: 'never',
          hasData: false,
        });
        continue;
      }
      const entry = JSON.parse(raw) as CacheEntry<unknown>;
      const ageMs = Date.now() - entry.cachedAt;
      items.push({
        key,
        priority: entry.priority,
        cachedAt: entry.cachedAt,
        isStale: entry.expiresAt !== Infinity && Date.now() > entry.expiresAt,
        ageLabel: buildAgeLabel(ageMs),
        hasData: true,
      });
    } catch {
      items.push({
        key,
        priority: getPriority(key),
        cachedAt: null,
        isStale: true,
        ageLabel: 'error',
        hasData: false,
      });
    }
  }

  return items;
}

// ─── Last Full Sync ───────────────────────────────────────────────────────────

const LAST_SYNC_KEY = 'cache:meta:last_full_sync';

export async function setLastFullSync(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  } catch {
    // silent
  }
}

export async function getLastFullSync(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}
