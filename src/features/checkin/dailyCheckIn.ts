// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/checkin/dailyCheckIn.ts   (NEW FILE + NEW FOLDER)
// HeatGuard · Daily check-in ("Are you OK today?")
//  - User picks a time. Each day at that time: "Are you OK today?"
//  - No answer after 30 min: a follow-up, and Home offers "Text my contacts".
//  - Notifications are planned 14 days ahead and re-planned every time the
//    app opens; confirming cancels that day's follow-up.
// Honest limit: iOS apps can't text contacts on their own. Automatic alerts
// to contacts need a server (planned for a later version).
// ─────────────────────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface DailyCheckInSettings {
  enabled: boolean;
  hour: number;      // 0–23
  minute: number;    // 0–59
}

export type CheckInStatus = 'off' | 'upcoming' | 'due' | 'done';

const SETTINGS_KEY = 'heatguard_daily_checkin_v1';
const CONFIRMED_KEY = 'heatguard_daily_checkin_confirmed_v1';
const SUGGEST_KEY = 'heatguard_daily_checkin_suggest_dismissed_v1';
const PREFIX = 'daily-checkin-';
const FOLLOW_UP_MIN = 30;
const PLAN_DAYS = 14;

const DEFAULT_SETTINGS: DailyCheckInSettings = { enabled: false, hour: 9, minute: 0 };

// ── Storage ─────────────────────────────────────────────────────────────────

let storage: any = null;
function getStorage() {
  if (storage) return storage;
  if (Platform.OS !== 'web') {
    try {
      const { MMKV } = require('../../lib/mmkvCompat');
      storage = new MMKV({ id: 'checkin-storage' });
    } catch {
      storage = null;
    }
  }
  return storage;
}

function get(key: string): string | null {
  try {
    const s = getStorage();
    if (s) return s.getString(key) ?? null;
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function set(key: string, value: string) {
  try {
    const s = getStorage();
    if (s) s.set(key, value);
    else if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {}
}

function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Settings ────────────────────────────────────────────────────────────────

export function getDailyCheckIn(): DailyCheckInSettings {
  const raw = get(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function setDailyCheckIn(next: DailyCheckInSettings): Promise<void> {
  set(SETTINGS_KEY, JSON.stringify(next));
  await planDailyCheckIns();
}

export function isSuggestionDismissed(): boolean {
  return get(SUGGEST_KEY) === '1';
}

export function dismissSuggestion() {
  set(SUGGEST_KEY, '1');
}

// ── Status ──────────────────────────────────────────────────────────────────

function todayAt(hour: number, minute: number, base = new Date()): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function getCheckInStatus(now = new Date()): CheckInStatus {
  const s = getDailyCheckIn();
  if (!s.enabled) return 'off';
  if (get(CONFIRMED_KEY) === dateKey(now)) return 'done';
  return now >= todayAt(s.hour, s.minute, now) ? 'due' : 'upcoming';
}

export function formatCheckInTime(s: DailyCheckInSettings = getDailyCheckIn()): string {
  return todayAt(s.hour, s.minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** User says they're OK today. Cancels today's remaining reminders. */
export async function confirmToday(): Promise<void> {
  set(CONFIRMED_KEY, dateKey());
  if (Platform.OS === 'web') return;
  try {
    const today = dateKey();
    await Notifications.cancelScheduledNotificationAsync(`${PREFIX}${today}-check`);
    await Notifications.cancelScheduledNotificationAsync(`${PREFIX}${today}-followup`);
  } catch {}
}

// ── Notifications ───────────────────────────────────────────────────────────

async function cancelAll() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(n => n.identifier.startsWith(PREFIX))
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {}
}

/** (Re)plan the next 14 days of check-ins. Safe to call often. */
export async function planDailyCheckIns(): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelAll();
  const s = getDailyCheckIn();
  if (!s.enabled) return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const now = new Date();
    const confirmedToday = get(CONFIRMED_KEY) === dateKey(now);

    for (let i = 0; i < PLAN_DAYS; i++) {
      const day = new Date(now);
      day.setDate(now.getDate() + i);
      const key = dateKey(day);
      if (i === 0 && confirmedToday) continue;

      const checkAt = todayAt(s.hour, s.minute, day);
      const followAt = new Date(checkAt.getTime() + FOLLOW_UP_MIN * 60_000);

      if (checkAt.getTime() > now.getTime() + 30_000) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}${key}-check`,
          content: {
            title: 'Are you OK today?',
            body: 'Tap to check in with HeatGuard.',
            sound: true,
            data: { route: '/' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: checkAt },
        });
      }
      if (followAt.getTime() > now.getTime() + 30_000) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}${key}-followup`,
          content: {
            title: 'You haven\'t checked in today',
            body: 'Open HeatGuard to say you are OK, or text your emergency contacts if you need help.',
            sound: true,
            data: { route: '/' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: followAt },
        });
      }
    }
  } catch (e) {
    console.warn('Could not plan daily check-ins:', e);
  }
}
