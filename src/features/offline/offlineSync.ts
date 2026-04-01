// ─────────────────────────────────────────────
// Offline Sync Orchestrator
// Pre-fetches all critical data when online,
// tracks sync state, triggers background refresh
// ─────────────────────────────────────────────

import {
  cacheSet,
  cacheGet,
  setLastFullSync,
  getLastFullSync,
  CACHE_KEYS,
  type CacheInventoryItem,
  getCacheInventory,
} from './offlineCache';
import { getHeatProfile } from '../profile/storage/profileStorage';
import { computeNeighborhoodSnapshot } from '../neighborhood/neighborhoodEngine';
import { computeNetworkSnapshot } from '../network/networkEngine';

// ─── Critical Static Data ─────────────────────────────────────────────────────
// This data is hardcoded for offline safety — no network needed ever

export const HEAT_SYMPTOMS_DATA = [
  {
    id: 'exhaustion',
    name: 'Heat Exhaustion',
    severity: 'high',
    symptoms: ['Heavy sweating', 'Cold, pale, clammy skin', 'Weak pulse', 'Nausea or vomiting', 'Muscle cramps', 'Tiredness or weakness', 'Dizziness', 'Headache', 'Fainting'],
    action: 'Move to cool place. Loosen clothing. Apply cool wet cloths. Sip water. Call doctor if vomiting begins.',
    callEmergency: false,
  },
  {
    id: 'stroke',
    name: 'Heat Stroke',
    severity: 'crisis',
    symptoms: ['Body temp above 103°F', 'Hot, red, dry or damp skin', 'Rapid strong pulse', 'Confusion or altered mental state', 'Loss of consciousness', 'No sweating despite heat'],
    action: 'CALL 911 IMMEDIATELY. Move to cool place. Cool person rapidly — ice packs to neck, armpits, groin. Do NOT give fluids.',
    callEmergency: true,
  },
  {
    id: 'cramps',
    name: 'Heat Cramps',
    severity: 'moderate',
    symptoms: ['Muscle cramps or spasms', 'Heavy sweating during exercise', 'Pain in abdomen, arms, or legs'],
    action: 'Stop activity. Move to cool place. Drink water or sports drink. Wait for cramps to subside before resuming.',
    callEmergency: false,
  },
  {
    id: 'syncope',
    name: 'Heat Syncope',
    severity: 'moderate',
    symptoms: ['Fainting or near-fainting', 'Dizziness when standing', 'Light-headedness'],
    action: 'Sit or lie down in cool place. Drink water. Raise legs if lying down. Seek medical attention if it persists.',
    callEmergency: false,
  },
];

export const SOS_INSTRUCTIONS_DATA = {
  steps: [
    { step: 1, action: 'Move to shade or cool indoor space immediately' },
    { step: 2, action: 'Call 911 if confusion, loss of consciousness, or no sweating' },
    { step: 3, action: 'Remove excess clothing — loosen anything tight' },
    { step: 4, action: 'Apply cool water or ice to neck, armpits, and groin' },
    { step: 5, action: 'Sip water — do not drink fast if nauseated' },
    { step: 6, action: 'Notify an emergency contact of your location' },
    { step: 7, action: 'Do not leave the person alone until help arrives' },
  ],
  emergencyNumber: '911',
  heatlineNumber: '2-1-1',
  note: 'Heat stroke is a medical emergency. When in doubt, call 911.',
};

// ─── Sync Result ──────────────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  syncedAt: number;
  itemsSynced: number;
  itemsFailed: number;
  errors: string[];
}

// ─── Sync Functions ───────────────────────────────────────────────────────────

async function syncCriticalStatic(): Promise<void> {
  // Always re-cache critical static data — it's fast and ensures freshness
  await cacheSet(CACHE_KEYS.HEAT_SYMPTOMS, HEAT_SYMPTOMS_DATA);
  await cacheSet(CACHE_KEYS.SOS_INSTRUCTIONS, SOS_INSTRUCTIONS_DATA);
}

async function syncHeatProfile(): Promise<void> {
  try {
    const profile = await getHeatProfile();
    if (profile) {
      await cacheSet(CACHE_KEYS.HEAT_PROFILE, profile);
    }
  } catch {
    // Profile might not exist yet
  }
}

async function syncShelterList(): Promise<void> {
  const { SHELTERS } = require('../network/networkEngine');
  await cacheSet(CACHE_KEYS.SHELTER_LIST, SHELTERS);
}

async function syncNeighborhoodSnapshot(): Promise<void> {
  const snapshot = computeNeighborhoodSnapshot(108, 20, 9);
  await cacheSet(CACHE_KEYS.NEIGHBORHOOD_SNAP, snapshot);
}

async function syncNetworkSnapshot(): Promise<void> {
  const snapshot = computeNetworkSnapshot();
  await cacheSet(CACHE_KEYS.NETWORK_SNAP, snapshot);
}

// ─── Full Sync ────────────────────────────────────────────────────────────────

export async function runFullSync(): Promise<SyncResult> {
  const errors: string[] = [];
  let itemsSynced = 0;
  let itemsFailed = 0;

  const tasks: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: 'Critical symptoms',    fn: syncCriticalStatic },
    { name: 'Heat profile',         fn: syncHeatProfile },
    { name: 'Shelter list',         fn: syncShelterList },
    { name: 'Neighborhood data',    fn: syncNeighborhoodSnapshot },
    { name: 'Network snapshot',     fn: syncNetworkSnapshot },
  ];

  for (const task of tasks) {
    try {
      await task.fn();
      itemsSynced++;
    } catch (err) {
      itemsFailed++;
      errors.push(`${task.name}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  const syncedAt = Date.now();
  if (itemsFailed === 0) {
    await setLastFullSync();
  }

  return {
    success: itemsFailed === 0,
    syncedAt,
    itemsSynced,
    itemsFailed,
    errors,
  };
}

// ─── Smart Sync ───────────────────────────────────────────────────────────────
// Only re-syncs if data is stale — call on app foreground

export async function runSmartSync(): Promise<void> {
  // Always sync critical static — near-zero cost
  await syncCriticalStatic();

  // Check last full sync age
  const lastSync = await getLastFullSync();
  const ageMs = lastSync ? Date.now() - lastSync : Infinity;

  // Re-sync important data if > 1 hour old
  if (ageMs > 60 * 60_000) {
    await syncHeatProfile();
    await syncShelterList();
  }

  // Re-sync fresh data if > 15 minutes old
  if (ageMs > 15 * 60_000) {
    await syncNeighborhoodSnapshot();
    await syncNetworkSnapshot();
  }
}

// ─── Sync Status ──────────────────────────────────────────────────────────────

export interface SyncStatus {
  lastSyncAt: number | null;
  lastSyncAgeLabel: string;
  isFullyCached: boolean;
  criticalCached: boolean;
  inventory: CacheInventoryItem[];
}

function ageLabel(ms: number | null): string {
  if (ms === null) return 'never';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const lastSync = await getLastFullSync();
  const ageMs = lastSync ? Date.now() - lastSync : null;
  const inventory = await getCacheInventory();

  const criticalItems = inventory.filter((i) => i.priority === 'critical');
  const criticalCached = criticalItems.every((i) => i.hasData);
  const isFullyCached = inventory.every((i) => i.hasData);

  return {
    lastSyncAt: lastSync,
    lastSyncAgeLabel: ageLabel(ageMs),
    isFullyCached,
    criticalCached,
    inventory,
  };
}
