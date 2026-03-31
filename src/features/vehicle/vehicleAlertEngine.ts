// ─── Vehicle Heat Alert Engine ────────────────────────────────────────────────
// Tracks time-in-parked-vehicle and escalates alerts based on elapsed time,
// exterior temperature, and vehicle occupants.

export type VehicleOccupant = 'alone' | 'child' | 'pet' | 'child_and_pet';

export interface VehicleSession {
  id: string;
  startTime: string;     // ISO
  occupant: VehicleOccupant;
  exteriorTempF: number;
  isActive: boolean;
  dismissedAt?: string;
}

export type AlertLevel = 'safe' | 'reminder' | 'warning' | 'critical' | 'emergency';

export interface VehicleAlertState {
  level: AlertLevel;
  title: string;
  message: string;
  color: string;
  minutesElapsed: number;
  interiorEstimateF: number;
  autoCallCountdownSec?: number; // present only at emergency level
}

// ─── Interior Temperature Estimation ─────────────────────────────────────────
// Per NHTSA / Jan Null's research:
// – Interior temp can rise ~19°F in the first 10 minutes on an 80°F day
// – Continues to rise ~3°F every 5 minutes after that
// – Can reach 40–50°F above exterior in under an hour

export function estimateInteriorTempF(
  exteriorF: number,
  minutesParked: number,
): number {
  const initial = Math.min(minutesParked / 10, 1) * 19;
  const continued = Math.max(minutesParked - 10, 0) * (3 / 5);
  return Math.round(exteriorF + initial + continued);
}

// ─── Alert Level Logic ────────────────────────────────────────────────────────

export function getAlertState(
  session: VehicleSession,
  minutesElapsed: number,
): VehicleAlertState {
  const interiorF = estimateInteriorTempF(session.exteriorTempF, minutesElapsed);
  const isVulnerable = session.occupant !== 'alone';
  const occupantLabel = getOccupantShortLabel(session.occupant);

  if (minutesElapsed < 3 && !isVulnerable) {
    return {
      level: 'safe',
      title: 'Timer Active',
      message: `Interior est. ${interiorF}°F — HeatGuard is watching.`,
      color: '#22C55E',
      minutesElapsed,
      interiorEstimateF: interiorF,
    };
  }

  if (minutesElapsed < 5) {
    return {
      level: 'reminder',
      title: isVulnerable ? `Check on ${occupantLabel}` : 'Timer Active',
      message: `${minutesElapsed} min parked. Interior ~${interiorF}°F.${
        isVulnerable ? ` Don't forget who is inside.` : ''
      }`,
      color: '#F59E0B',
      minutesElapsed,
      interiorEstimateF: interiorF,
    };
  }

  if (minutesElapsed < 10) {
    return {
      level: 'warning',
      title: `${minutesElapsed} Min Parked`,
      message: `Interior ~${interiorF}°F.${
        isVulnerable
          ? ` Return to check on ${occupantLabel} now.`
          : ' Consider returning soon.'
      }`,
      color: '#F97316',
      minutesElapsed,
      interiorEstimateF: interiorF,
    };
  }

  if (minutesElapsed < 15 || !isVulnerable) {
    return {
      level: 'critical',
      title: 'Dangerous Heat Level',
      message: isVulnerable
        ? `Interior ~${interiorF}°F. Life-threatening for ${occupantLabel}. Return immediately.`
        : `Interior ~${interiorF}°F. Return to vehicle immediately.`,
      color: '#EF4444',
      minutesElapsed,
      interiorEstimateF: interiorF,
    };
  }

  // Emergency: vulnerable occupant, 15+ minutes
  return {
    level: 'emergency',
    title: 'CALL 911 IMMEDIATELY',
    message: `${minutesElapsed} min parked. Interior ~${interiorF}°F. ${
      occupantLabel
    } is in a life-threatening situation.`,
    color: '#7C3AED',
    minutesElapsed,
    interiorEstimateF: interiorF,
    autoCallCountdownSec: 30,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getOccupantLabel(occupant: VehicleOccupant): string {
  const map: Record<VehicleOccupant, string> = {
    alone: 'Just me',
    child: 'Child inside',
    pet: 'Pet inside',
    child_and_pet: 'Child & pet inside',
  };
  return map[occupant];
}

export function getOccupantShortLabel(occupant: VehicleOccupant): string {
  const map: Record<VehicleOccupant, string> = {
    alone: 'yourself',
    child: 'child',
    pet: 'pet',
    child_and_pet: 'child & pet',
  };
  return map[occupant];
}

export function getOccupantIcon(occupant: VehicleOccupant): string {
  const map: Record<VehicleOccupant, string> = {
    alone: '🚗',
    child: '👶',
    pet: '🐾',
    child_and_pet: '👶',
  };
  return map[occupant];
}

// ─── Session Storage ──────────────────────────────────────────────────────────

const V_KEY = 'heatguard_vehicle_session_v1';

const store = {
  get: (): string | null => {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(V_KEY);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { MMKV } = require('react-native-mmkv');
      return new MMKV().getString(V_KEY) ?? null;
    } catch {
      return null;
    }
  },
  set: (value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(V_KEY, value);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { MMKV } = require('react-native-mmkv');
      new MMKV().set(V_KEY, value);
    } catch {}
  },
};

export function getActiveVehicleSession(): VehicleSession | null {
  const raw = store.get();
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as VehicleSession;
    return s.isActive ? s : null;
  } catch {
    return null;
  }
}

export function startVehicleSession(
  occupant: VehicleOccupant,
  exteriorTempF: number,
): VehicleSession {
  const session: VehicleSession = {
    id: `vs_${Date.now()}`,
    startTime: new Date().toISOString(),
    occupant,
    exteriorTempF,
    isActive: true,
  };
  store.set(JSON.stringify(session));
  return session;
}

export function dismissVehicleSession(): void {
  const raw = store.get();
  if (!raw) return;
  try {
    const s = JSON.parse(raw) as VehicleSession;
    s.isActive = false;
    s.dismissedAt = new Date().toISOString();
    store.set(JSON.stringify(s));
  } catch {}
}
