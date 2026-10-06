// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/plan/tripCheckIn.ts   (NEW FILE)
// HeatGuard · Trip check-in
// When the user heads out, we save the trip and schedule two local
// notifications: "Are you OK?" at the check-in time, and a follow-up 15 min
// later. Home shows the check-in card until the user ends the trip.
// Honest limit: iOS apps can't text contacts on their own. The follow-up
// makes texting contacts one tap (see emergencyMessaging.textContacts).
// ─────────────────────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ActivityId } from './activityPrep';

export interface Trip {
  id: string;
  activityId: ActivityId;
  activityLabel: string;
  startedAt: number;   // epoch ms
  checkAt: number;     // epoch ms
}

const KEY = 'heatguard_trip_checkin_v1';
const NOTIF_PREFIX = 'trip-checkin-';
const FOLLOW_UP_MS = 15 * 60 * 1000;

let storage: any = null;
function getStorage() {
  if (storage) return storage;
  if (Platform.OS !== 'web') {
    try {
      const { MMKV } = require('../../lib/mmkvCompat');
      storage = new MMKV({ id: 'trip-storage' });
    } catch {
      storage = null;
    }
  }
  return storage;
}

function read(): string | null {
  try {
    const s = getStorage();
    if (s) return s.getString(KEY) ?? null;
    return typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  } catch {
    return null;
  }
}

function write(value: string | null) {
  try {
    const s = getStorage();
    if (s) {
      if (value === null) s.delete(KEY);
      else s.set(KEY, value);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      if (value === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    }
  } catch {}
}

export function getActiveTrip(): Trip | null {
  const raw = read();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Trip;
  } catch {
    return null;
  }
}

/** True once the check-in time has passed. */
export function isTripOverdue(trip: Trip, now = Date.now()): boolean {
  return now >= trip.checkAt;
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

async function cancelTripNotifications() {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(n => n.identifier.startsWith(NOTIF_PREFIX))
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {}
}

export async function startTrip(activityId: ActivityId, activityLabel: string, checkAt: number): Promise<Trip> {
  await cancelTripNotifications();
  const trip: Trip = {
    id: `trip_${Date.now()}`,
    activityId,
    activityLabel,
    startedAt: Date.now(),
    checkAt,
  };
  write(JSON.stringify(trip));

  if (Platform.OS !== 'web') {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIF_PREFIX}check`,
          content: {
            title: 'HeatGuard check-in: are you OK?',
            body: `You planned to be back from ${activityLabel.toLowerCase()} by now. Tap to let HeatGuard know.`,
            sound: true,
            data: { route: '/' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(checkAt) },
        });
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIF_PREFIX}followup`,
          content: {
            title: 'Still no check-in',
            body: 'If you need help, open HeatGuard to text your emergency contacts your location, or call 911.',
            sound: true,
            data: { route: '/' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(checkAt + FOLLOW_UP_MS) },
        });
      }
    } catch (e) {
      console.warn('Could not schedule trip check-in:', e);
    }
  }
  return trip;
}

export async function endTrip(): Promise<void> {
  write(null);
  await cancelTripNotifications();
}
