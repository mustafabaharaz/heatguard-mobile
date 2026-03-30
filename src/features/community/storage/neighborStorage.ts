// src/features/community/storage/neighborStorage.ts
// Neighbor Wellness Network — Phase 2: Community Network

import { Platform } from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

export type WellnessStatus = 'ok' | 'unknown' | 'concern' | 'urgent';

export interface CheckInRecord {
  timestamp: number;
  status: WellnessStatus;
  note?: string;
  checkedBy?: string;
}

export interface Neighbor {
  id: string;
  name: string;
  address: string;
  age?: number;
  phone?: string;
  conditions?: string[]; // e.g. ['heart disease', 'no AC']
  notes?: string;
  lastChecked?: number;
  checkInStatus: WellnessStatus;
  checkInHistory: CheckInRecord[];
  createdAt: number;
}

// ─── Storage Adapter ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'heatguard:neighbors';

function storageGet(key: string): string | null {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  try {
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV();
    return storage.getString(key) ?? null;
  } catch { return null; }
}

function storageSet(key: string, value: string): void {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(key, value); } catch {}
    return;
  }
  try {
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV();
    storage.set(key, value);
  } catch {}
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_NEIGHBORS: Neighbor[] = [
  {
    id: 'n_1',
    name: 'Eleanor Voss',
    address: '412 W Maple St, Apt 3B',
    age: 79,
    phone: '(480) 555-0192',
    conditions: ['Heart condition', 'Lives alone'],
    notes: 'Prefers check-ins before noon. Friendly — will offer you lemonade.',
    lastChecked: Date.now() - 26 * 60 * 60 * 1000,
    checkInStatus: 'unknown',
    checkInHistory: [
      { timestamp: Date.now() - 26 * 60 * 60 * 1000, status: 'ok', note: 'Doing well, AC working fine.' },
    ],
    createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'n_2',
    name: 'Robert Okafor',
    address: '88 S Rural Rd',
    age: 82,
    phone: '(480) 555-0347',
    conditions: ['Diabetes', 'No car'],
    notes: 'Needs medication reminders. Son lives in Phoenix.',
    lastChecked: Date.now() - 4 * 60 * 60 * 1000,
    checkInStatus: 'ok',
    checkInHistory: [
      { timestamp: Date.now() - 4 * 60 * 60 * 1000, status: 'ok', note: 'Feeling good, staying hydrated.' },
      { timestamp: Date.now() - 28 * 60 * 60 * 1000, status: 'ok' },
    ],
    createdAt: Date.now() - 21 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'n_3',
    name: 'Gloria Mendez',
    address: '701 E University Dr, Unit 12',
    age: 71,
    phone: '(480) 555-0819',
    conditions: ['COPD', 'Window AC only'],
    lastChecked: Date.now() - 52 * 60 * 60 * 1000,
    checkInStatus: 'concern',
    checkInHistory: [
      { timestamp: Date.now() - 52 * 60 * 60 * 1000, status: 'concern', note: 'Felt short of breath. Monitor closely.' },
    ],
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'n_4',
    name: 'William Park',
    address: '1150 N Ash Ave',
    age: 88,
    conditions: ['Alzheimer\'s', 'Lives alone', 'AC unreliable'],
    lastChecked: Date.now() - 1.5 * 60 * 60 * 1000,
    checkInStatus: 'ok',
    checkInHistory: [
      { timestamp: Date.now() - 1.5 * 60 * 60 * 1000, status: 'ok', note: 'Neighbor installed a fan. Seems comfortable.' },
    ],
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
];

// ─── API ─────────────────────────────────────────────────────────────────────

export function loadNeighbors(): Neighbor[] {
  const raw = storageGet(STORAGE_KEY);
  if (!raw) {
    storageSet(STORAGE_KEY, JSON.stringify(SEED_NEIGHBORS));
    return SEED_NEIGHBORS;
  }
  try {
    return JSON.parse(raw) as Neighbor[];
  } catch {
    return SEED_NEIGHBORS;
  }
}

export function saveNeighbors(neighbors: Neighbor[]): void {
  storageSet(STORAGE_KEY, JSON.stringify(neighbors));
}

export function addNeighbor(
  data: Omit<Neighbor, 'id' | 'checkInHistory' | 'createdAt' | 'checkInStatus'>
): Neighbor {
  const neighbors = loadNeighbors();
  const newNeighbor: Neighbor = {
    ...data,
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    checkInStatus: 'unknown',
    checkInHistory: [],
    createdAt: Date.now(),
  };
  saveNeighbors([...neighbors, newNeighbor]);
  return newNeighbor;
}

export function checkInNeighbor(
  neighborId: string,
  status: WellnessStatus,
  note?: string,
  checkedBy?: string
): Neighbor[] {
  const neighbors = loadNeighbors().map((n) => {
    if (n.id !== neighborId) return n;
    const record: CheckInRecord = { timestamp: Date.now(), status, note, checkedBy };
    return {
      ...n,
      checkInStatus: status,
      lastChecked: Date.now(),
      checkInHistory: [record, ...n.checkInHistory].slice(0, 20), // keep last 20
    };
  });
  saveNeighbors(neighbors);
  return neighbors;
}

export function removeNeighbor(neighborId: string): Neighbor[] {
  const neighbors = loadNeighbors().filter((n) => n.id !== neighborId);
  saveNeighbors(neighbors);
  return neighbors;
}

export function getNeighborStats(neighbors: Neighbor[]) {
  const total = neighbors.length;
  const needsCheckIn = neighbors.filter((n) => {
    if (n.checkInStatus === 'concern' || n.checkInStatus === 'urgent') return true;
    if (!n.lastChecked) return true;
    const hoursAgo = (Date.now() - n.lastChecked) / (1000 * 60 * 60);
    return hoursAgo >= 12;
  }).length;
  const ok = neighbors.filter((n) => n.checkInStatus === 'ok').length;
  const concern = neighbors.filter(
    (n) => n.checkInStatus === 'concern' || n.checkInStatus === 'urgent'
  ).length;
  return { total, needsCheckIn, ok, concern };
}

export function formatLastChecked(timestamp?: number): string {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
