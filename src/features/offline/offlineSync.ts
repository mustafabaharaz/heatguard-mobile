// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/offline/offlineSync.ts
// HeatGuard · Offline sync
// Keeps the life-critical reference data (heat illness signs, emergency steps)
// and the heat profile in the offline cache. All of it is bundled with the app
// or stored on the phone, so nothing here depends on a server.
// Emergency contacts and saved Cool Spots have their own on-device stores.
// ─────────────────────────────────────────────────────────────────────────────

import {
  cacheSet,
  setLastFullSync,
  getLastFullSync,
  CACHE_KEYS,
  type CacheInventoryItem,
  getCacheInventory,
} from './offlineCache';
import { getHeatProfile } from '../profile/storage/profileStorage';

// ─── Critical static data (bundled, works with no network ever) ──────────────
// Wording follows CDC "Heat-related illnesses" guidance.

export const HEAT_SYMPTOMS_DATA = [
  {
    id: 'stroke',
    name: 'Heat stroke',
    severity: 'crisis',
    symptoms: [
      'Body temperature 103°F or higher',
      'Hot, red, dry or damp skin',
      'Fast, strong pulse',
      'Headache, dizziness, nausea',
      'Confusion',
      'Passing out',
    ],
    action: 'Call 911 right away. Move the person somewhere cooler. Cool them with cool cloths or a cool bath. Do not give them anything to drink.',
    callEmergency: true,
  },
  {
    id: 'exhaustion',
    name: 'Heat exhaustion',
    severity: 'high',
    symptoms: [
      'Heavy sweating',
      'Cold, pale, clammy skin',
      'Fast, weak pulse',
      'Nausea or vomiting',
      'Muscle cramps',
      'Tiredness or weakness',
      'Dizziness or headache',
      'Fainting',
    ],
    action: 'Move somewhere cool. Loosen clothes. Put cool, wet cloths on the body or take a cool bath. Sip water. Get medical help right away if they throw up, symptoms get worse, or last more than 1 hour.',
    callEmergency: false,
  },
  {
    id: 'cramps',
    name: 'Heat cramps',
    severity: 'moderate',
    symptoms: ['Heavy sweating during hard activity', 'Muscle pain or spasms'],
    action: 'Stop the activity and move somewhere cool. Drink water or a sports drink. Wait for cramps to go away before starting again. Get medical help if cramps last more than 1 hour.',
    callEmergency: false,
  },
];

export const SOS_INSTRUCTIONS_DATA = {
  steps: [
    { step: 1, action: 'Call 911 if someone is confused, passes out, or has hot skin and a very high temperature' },
    { step: 2, action: 'Move to shade or a cool indoor space' },
    { step: 3, action: 'Loosen or remove extra clothing' },
    { step: 4, action: 'Cool the body with cool, wet cloths, a cool bath, or ice packs on the neck and armpits' },
    { step: 5, action: 'If they are awake and not throwing up, give sips of water (not for heat stroke)' },
    { step: 6, action: 'Stay with them until help arrives' },
  ],
  emergencyNumber: '911',
  heatlineNumber: '2-1-1',
  note: 'Heat stroke is a medical emergency. When in doubt, call 911.',
};

// ─── Sync ─────────────────────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  syncedAt: number;
  itemsSynced: number;
  itemsFailed: number;
  errors: string[];
}

async function syncCriticalStatic(): Promise<void> {
  await cacheSet(CACHE_KEYS.HEAT_SYMPTOMS, HEAT_SYMPTOMS_DATA);
  await cacheSet(CACHE_KEYS.SOS_INSTRUCTIONS, SOS_INSTRUCTIONS_DATA);
}

async function syncHeatProfile(): Promise<void> {
  const profile = getHeatProfile();
  if (profile) await cacheSet(CACHE_KEYS.HEAT_PROFILE, profile);
}

export async function runFullSync(): Promise<SyncResult> {
  const errors: string[] = [];
  let itemsSynced = 0;
  let itemsFailed = 0;

  const tasks: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: 'Critical safety info', fn: syncCriticalStatic },
    { name: 'Heat profile', fn: syncHeatProfile },
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

  if (itemsFailed === 0) await setLastFullSync();
  return { success: itemsFailed === 0, syncedAt: Date.now(), itemsSynced, itemsFailed, errors };
}

/** Called when the app comes to the foreground. Cheap: no network. */
export async function runSmartSync(): Promise<void> {
  await syncCriticalStatic();
  const lastSync = await getLastFullSync();
  const ageMs = lastSync ? Date.now() - lastSync : Infinity;
  if (ageMs > 60 * 60_000) {
    await syncHeatProfile().catch(() => {});
    await setLastFullSync();
  }
}

// ─── Status ───────────────────────────────────────────────────────────────────

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
  const inventory = await getCacheInventory();
  const critical = inventory.filter(i => i.priority === 'critical');
  return {
    lastSyncAt: lastSync,
    lastSyncAgeLabel: ageLabel(lastSync ? Date.now() - lastSync : null),
    isFullyCached: inventory.every(i => i.hasData),
    criticalCached: critical.every(i => i.hasData),
    inventory,
  };
}
