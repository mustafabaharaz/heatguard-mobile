// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/coolspots/coolSpotsService.ts   (NEW FILE + NEW FOLDER)
// HeatGuard · Cool Spots data
// Real locations from the Maricopa Association of Governments (MAG) Heat Relief
// Network public map service: cooling centers, respite centers, hydration
// stations. Last good result is cached so the list works offline.
// Coverage: Maricopa County, AZ. Season: roughly May 1 – September 30.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

export type SpotType = 'cooling' | 'respite' | 'hydration';

export interface CoolSpot {
  id: string;
  type: SpotType;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  phone?: string;
  open24: boolean;
  hoursText?: string;           // free-text hours from the data, if any
  weekHours: Record<string, { open?: string; close?: string }>; // by weekday name
  petsAllowed: boolean;
  wheelchair: boolean;
  seasonEnded: boolean;         // End_Date has passed
  closureNote?: string;         // known_closures
}

export interface CoolSpotsResult {
  spots: CoolSpot[];
  fetchedAt: number;            // epoch ms of the data we're showing
  fromCache: boolean;
}

const BASE = 'https://geo.azmag.gov/arcgis/rest/services/maps/Heat_Relief_Network/MapServer';
const LAYERS: { id: number; type: SpotType }[] = [
  { id: 0, type: 'cooling' },
  { id: 1, type: 'respite' },
  { id: 2, type: 'hydration' },
];
const CACHE_KEY = 'heatguard_coolspots_v1';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Helpers ─────────────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const yes = (v: unknown): boolean => str(v).toLowerCase() === 'yes';

/** "8_00_AM" or "8:00 AM" → "8:00 AM" */
function cleanTime(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  const m = s.match(/^(\d{1,2})[_:](\d{2})[_\s]?(AM|PM)$/i);
  if (m) return `${parseInt(m[1], 10)}:${m[2]} ${m[3].toUpperCase()}`;
  return s.replace(/_/g, ' ');
}

function queryUrl(layerId: number): string {
  const params = [
    'where=1%3D1',
    'outFields=*',
    'returnGeometry=true',
    'outSR=4326',
    'f=json',
  ].join('&');
  return `${BASE}/${layerId}/query?${params}`;
}

async function fetchJson(url: string, timeoutMs = 15000): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function normalize(feature: any, type: SpotType, layerId: number): CoolSpot | null {
  const a = feature?.attributes ?? {};
  const g = feature?.geometry ?? {};
  const lon = typeof g.x === 'number' ? g.x : NaN;
  const lat = typeof g.y === 'number' ? g.y : NaN;
  if (!isFinite(lat) || !isFinite(lon)) return null;

  const name =
    str(a.Location) || str(a.Organization) || str(a.LUT_Location) || str(a.LUT_Organization) || 'Heat relief site';

  const weekHours: CoolSpot['weekHours'] = {};
  for (const d of DAYS) {
    weekHours[d] = { open: cleanTime(a[`${d}Open`]), close: cleanTime(a[`${d}Close`]) };
  }

  const end = typeof a.End_Date === 'number' ? a.End_Date : null;

  return {
    id: `${layerId}-${a.objectid ?? a.OBJECTID ?? `${lat},${lon}`}`,
    type,
    name,
    address: str(a.Address),
    city: str(a.City),
    latitude: lat,
    longitude: lon,
    phone: str(a.PrimaryPhone) || undefined,
    open24: yes(a.Open24seven),
    hoursText: str(a.Hours) || undefined,
    weekHours,
    petsAllowed: yes(a.Pets),
    wheelchair: yes(a.Wheelchair_access) || yes(a.ADA_accessible),
    seasonEnded: end !== null && end < Date.now(),
    closureNote: str(a.known_closures) || undefined,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function getCachedCoolSpots(): Promise<CoolSpotsResult | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { spots: CoolSpot[]; fetchedAt: number };
    return { ...parsed, fromCache: true };
  } catch {
    return null;
  }
}

/** Fetch fresh data; falls back to the cache. Returns null only if neither exists. */
export async function loadCoolSpots(): Promise<CoolSpotsResult | null> {
  try {
    const results = await Promise.allSettled(
      LAYERS.map(async l => {
        const json = await fetchJson(queryUrl(l.id));
        const feats: any[] = Array.isArray(json?.features) ? json.features : [];
        return feats.map(f => normalize(f, l.type, l.id)).filter((s): s is CoolSpot => !!s);
      }),
    );
    const spots = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
    if (spots.length === 0) throw new Error('No sites returned');

    const fresh = { spots, fetchedAt: Date.now() };
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
    return { ...fresh, fromCache: false };
  } catch {
    return getCachedCoolSpots();
  }
}

/** Miles between two points. */
export function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Today's hours as a short label, e.g. "Open 24/7", "Today 8:00 AM – 5:00 PM". */
export function todayHoursLabel(spot: CoolSpot, now = new Date()): string {
  if (spot.open24) return 'Open 24/7';
  const day = DAYS[now.getDay()];
  const h = spot.weekHours[day];
  if (h?.open && h?.close) return `Today ${h.open} – ${h.close}`;
  if (spot.hoursText) return spot.hoursText;
  return 'Hours not listed. Call ahead.';
}

export const SPOT_LABEL: Record<SpotType, string> = {
  cooling: 'Cooling center',
  respite: 'Respite center',
  hydration: 'Water station',
};

/** Is "today" inside the usual Heat Relief Network season (May–September)? */
export function inHeatReliefSeason(now = new Date()): boolean {
  const m = now.getMonth(); // 0 = Jan
  return m >= 4 && m <= 8;
}
