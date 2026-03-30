// src/features/community/storage/resourceStorage.ts
// Community Resource Exchange — Phase 2: Community Network

import { Platform } from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ResourceType = 'water' | 'cooling' | 'transport' | 'supplies' | 'shelter';

export interface Resource {
  id: string;
  type: ResourceType;
  title: string;
  description: string;
  location: string;
  postedBy: string;
  timestamp: number;
  availableUntil?: number; // epoch ms, undefined = open-ended
  quantity?: number;       // undefined = unlimited / unspecified
  claimed: boolean;
  claimedCount: number;    // how many have claimed
  urgent: boolean;
}

// ─── Storage Adapter ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'heatguard:resources';

function storageGet(key: string): string | null {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  try {
    const { MMKV } = require('react-native-mmkv');
    const s = new MMKV();
    return s.getString(key) ?? null;
  } catch { return null; }
}

function storageSet(key: string, value: string): void {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(key, value); } catch {}
    return;
  }
  try {
    const { MMKV } = require('react-native-mmkv');
    const s = new MMKV();
    s.set(key, value);
  } catch {}
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_RESOURCES: Resource[] = [
  {
    id: 'r_1',
    type: 'water',
    title: 'Case of water bottles (24)',
    description: 'Full case of 16.9oz bottles. Porch pickup anytime — just grab what you need.',
    location: '512 S Maple Ave — front porch',
    postedBy: 'Diane M.',
    timestamp: Date.now() - 35 * 60 * 1000,
    quantity: 24,
    claimed: false,
    claimedCount: 6,
    urgent: false,
  },
  {
    id: 'r_2',
    type: 'cooling',
    title: 'AC guest room — available today',
    description: 'Have a spare room with strong AC. Can host 1-2 people for the afternoon. Prefer elderly or families with young children.',
    location: 'South Tempe — DM for address',
    postedBy: 'Kevin R.',
    timestamp: Date.now() - 1.2 * 60 * 60 * 1000,
    availableUntil: new Date().setHours(21, 0, 0, 0),
    claimed: false,
    claimedCount: 0,
    urgent: false,
  },
  {
    id: 'r_3',
    type: 'transport',
    title: 'Rides to Tempe Cooling Center',
    description: 'Running rides to the Rio Salado cooling center. Have room for 3 passengers. Text me to coordinate pickup.',
    location: 'Pick up anywhere in Tempe',
    postedBy: 'Angela T.',
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    availableUntil: new Date().setHours(18, 0, 0, 0),
    quantity: 3,
    claimed: false,
    claimedCount: 2,
    urgent: false,
  },
  {
    id: 'r_4',
    type: 'supplies',
    title: 'Box fans (3 available)',
    description: 'Cleaning out storage. Three working 20" box fans. Free to anyone who needs them. Will deliver within 2 miles.',
    location: 'Tempe — near Rural & Southern',
    postedBy: 'Marcus W.',
    timestamp: Date.now() - 3.5 * 60 * 60 * 1000,
    quantity: 3,
    claimed: false,
    claimedCount: 1,
    urgent: false,
  },
  {
    id: 'r_5',
    type: 'shelter',
    title: 'URGENT: Emergency AC shelter — families only',
    description: 'Local AC outage in Riverside District. We are accepting families with children and elderly residents. Clean space, water, snacks provided.',
    location: 'First Baptist Church, 900 W Southern Ave',
    postedBy: 'Pastor Williams',
    timestamp: Date.now() - 45 * 60 * 1000,
    availableUntil: Date.now() + 8 * 60 * 60 * 1000,
    claimed: false,
    claimedCount: 14,
    urgent: true,
  },
  {
    id: 'r_6',
    type: 'water',
    title: 'Water + Gatorade — free at Mesa Park',
    description: 'Setting up a table at Mesa Verde Park near the playground. Water, Gatorade, and cold packs. No sign-up.',
    location: 'Mesa Verde Park, W Brown Rd entrance',
    postedBy: 'City Volunteer',
    timestamp: Date.now() - 5 * 60 * 60 * 1000,
    claimed: false,
    claimedCount: 38,
    urgent: false,
  },
];

// ─── API ─────────────────────────────────────────────────────────────────────

export function loadResources(): Resource[] {
  const raw = storageGet(STORAGE_KEY);
  if (!raw) {
    storageSet(STORAGE_KEY, JSON.stringify(SEED_RESOURCES));
    return SEED_RESOURCES;
  }
  try {
    return JSON.parse(raw) as Resource[];
  } catch {
    return SEED_RESOURCES;
  }
}

export function saveResources(resources: Resource[]): void {
  storageSet(STORAGE_KEY, JSON.stringify(resources));
}

export function postResource(
  data: Omit<Resource, 'id' | 'timestamp' | 'claimed' | 'claimedCount'>
): Resource {
  const resources = loadResources();
  const newResource: Resource = {
    ...data,
    id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    claimed: false,
    claimedCount: 0,
  };
  saveResources([newResource, ...resources]);
  return newResource;
}

export function claimResource(resourceId: string): Resource[] {
  const resources = loadResources().map((r) => {
    if (r.id !== resourceId) return r;
    const newCount = r.claimedCount + 1;
    const fullyTaken = r.quantity !== undefined && newCount >= r.quantity;
    return { ...r, claimedCount: newCount, claimed: fullyTaken };
  });
  saveResources(resources);
  return resources;
}

export function removeResource(resourceId: string): Resource[] {
  const resources = loadResources().filter((r) => r.id !== resourceId);
  saveResources(resources);
  return resources;
}

export function filterResources(
  resources: Resource[],
  type: ResourceType | 'all'
): Resource[] {
  if (type === 'all') return resources;
  return resources.filter((r) => r.type === type);
}

export function isExpired(resource: Resource): boolean {
  if (!resource.availableUntil) return false;
  return Date.now() > resource.availableUntil;
}

export function formatAvailability(resource: Resource): string {
  if (isExpired(resource)) return 'Expired';
  if (resource.availableUntil) {
    const hoursLeft = Math.ceil((resource.availableUntil - Date.now()) / 3600000);
    if (hoursLeft < 1) {
      const minsLeft = Math.ceil((resource.availableUntil - Date.now()) / 60000);
      return `${minsLeft}m left`;
    }
    return `${hoursLeft}h left`;
  }
  return 'Open-ended';
}

export function formatResourceTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const RESOURCE_META: Record<
  ResourceType,
  { label: string; color: string; icon: string }
> = {
  water:     { label: 'Water',     color: '#3B82F6', icon: 'droplet' },
  cooling:   { label: 'Cooling',   color: '#06B6D4', icon: 'wind' },
  transport: { label: 'Transport', color: '#8B5CF6', icon: 'navigation' },
  supplies:  { label: 'Supplies',  color: '#F59E0B', icon: 'package' },
  shelter:   { label: 'Shelter',   color: '#10B981', icon: 'home' },
};
