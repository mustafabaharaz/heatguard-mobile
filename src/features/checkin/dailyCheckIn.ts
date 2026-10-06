// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/checkin/dailyCheckIn.ts
// HeatGuard · Daily check-in ("Are you OK?")
//  - 1–3 check-ins a day at times the user picks.
//  - Each one: a notification, then a follow-up 30 min later if unanswered.
//    Tapping either opens the check-in screen (/checkin).
//  - Checking in covers every check-in that is due now or within the next
//    hour, and cancels their reminders.
//  - Optional safety check (water, medicine, home cool, phone charged).
//    On by default for people the profile flags (see needsSafetyCheck).
//  - Today's result is kept so it can be shared with a heat buddy.
// iOS allows 64 scheduled notifications per app, so we plan only as many
// days ahead as fit a ~36-notification budget, re-planned each app open.
// Honest limit: iOS apps can't text contacts on their own. Automatic buddy
// alerts need a server (planned for v1.1).
// ─────────────────────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getHeatProfile, needsSafetyCheck } from '../profile/storage/profileStorage';
import type { SafetyKey, SafetyAnswer } from '../../content/homeSafety';

export interface CheckInTime {
  hour: number;   // 0–23
  minute: number; // 0–59
}

export interface DailyCheckInSettings {
  enabled: boolean;
  times: CheckInTime[];        // 1–3, sorted
  /** undefined = automatic (on for flagged users) */
  safetyCheck?: boolean;
}

export type CheckInStatus = 'off' | 'upcoming' | 'due' | 'done';

export interface CheckInResult {
  at: string;                                     // ISO time
  ok: boolean;                                    // false = "I don't feel well"
  safety?: Partial<Record<SafetyKey, SafetyAnswer>>;
}

interface DayRecord {
  date: string;        // yyyy-mm-dd
  slots: number[];     // indexes into settings.times that are covered
  last?: CheckInResult;
}

export const MAX_TIMES = 3;
export const TIME_CHOICES = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

const SETTINGS_KEY = 'heatguard_daily_checkin_v1';
const DAY_KEY = 'heatguard_daily_checkin_day_v2';
const SUGGEST_KEY = 'heatguard_daily_checkin_suggest_dismissed_v1';
const PREFIX = 'daily-checkin-';
const FOLLOW_UP_MIN = 30;
const EARLY_WINDOW_MIN = 60;
const NOTIFICATION_BUDGET = 36;
const MAX_PLAN_DAYS = 14;

const DEFAULT_SETTINGS: DailyCheckInSettings = {
  enabled: false,
  times: [{ hour: 9, minute: 0 }],
};

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

function sortTimes(times: CheckInTime[]): CheckInTime[] {
  const seen = new Set<string>();
  return times
    .filter(t => {
      const k = `${t.hour}:${t.minute}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
    .slice(0, MAX_TIMES);
}

// ── Settings ────────────────────────────────────────────────────────────────

export function getDailyCheckIn(): DailyCheckInSettings {
  const raw = get(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS, times: [...DEFAULT_SETTINGS.times] };
  try {
    const parsed = JSON.parse(raw);
    // v1 stored a single { hour, minute }
    const times: CheckInTime[] = Array.isArray(parsed.times) && parsed.times.length
      ? parsed.times
      : typeof parsed.hour === 'number'
        ? [{ hour: parsed.hour, minute: parsed.minute ?? 0 }]
        : DEFAULT_SETTINGS.times;
    return {
      enabled: !!parsed.enabled,
      times: sortTimes(times),
      safetyCheck: typeof parsed.safetyCheck === 'boolean' ? parsed.safetyCheck : undefined,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, times: [...DEFAULT_SETTINGS.times] };
  }
}

export async function setDailyCheckIn(next: DailyCheckInSettings): Promise<void> {
  const times = sortTimes(next.times.length ? next.times : DEFAULT_SETTINGS.times);
  const prev = getDailyCheckIn();
  // Times changed: today's coverage no longer lines up with the slot indexes
  if (JSON.stringify(prev.times) !== JSON.stringify(times)) {
    const day = getDay();
    if (day.date === dateKey()) saveDay({ ...day, slots: [] });
  }
  set(SETTINGS_KEY, JSON.stringify({ ...next, times }));
  await planDailyCheckIns();
}

/** Whether today's check-in includes the safety check. */
export function isSafetyCheckOn(s: DailyCheckInSettings = getDailyCheckIn()): boolean {
  return s.safetyCheck ?? needsSafetyCheck(getHeatProfile());
}

export function isSuggestionDismissed(): boolean {
  return get(SUGGEST_KEY) === '1';
}

export function dismissSuggestion() {
  set(SUGGEST_KEY, '1');
}

// ── Day record ──────────────────────────────────────────────────────────────

function getDay(): DayRecord {
  const raw = get(DAY_KEY);
  const today = dateKey();
  if (!raw) return { date: today, slots: [] };
  try {
    const d: DayRecord = JSON.parse(raw);
    return d.date === today ? d : { date: today, slots: [] };
  } catch {
    return { date: today, slots: [] };
  }
}

function saveDay(d: DayRecord) {
  set(DAY_KEY, JSON.stringify(d));
}

/** Today's latest check-in result, if any. */
export function getTodayResult(): CheckInResult | null {
  return getDay().last ?? null;
}

// ── Time helpers ────────────────────────────────────────────────────────────

function at(t: CheckInTime, base = new Date()): Date {
  const d = new Date(base);
  d.setHours(t.hour, t.minute, 0, 0);
  return d;
}

export function formatTime(t: CheckInTime): string {
  return at(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatHour(hour: number): string {
  return `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** "9 AM, 3 PM" */
export function formatCheckInTimes(s: DailyCheckInSettings = getDailyCheckIn()): string {
  return s.times.map(t => (t.minute ? formatTime(t) : formatHour(t.hour))).join(', ');
}

/** @deprecated kept for older screens; same as formatCheckInTimes */
export const formatCheckInTime = formatCheckInTimes;

// ── Status ──────────────────────────────────────────────────────────────────

export function getCheckInStatus(now = new Date()): CheckInStatus {
  const s = getDailyCheckIn();
  if (!s.enabled) return 'off';
  const covered = new Set(getDay().slots);
  const passed = s.times.map((t, i) => ({ i, d: at(t, now) })).filter(x => x.d <= now);
  if (passed.some(x => !covered.has(x.i))) return 'due';
  return covered.size >= s.times.length ? 'done' : 'upcoming';
}

/** The missed or due check-in time, for the Home card ("your 9 AM check-in"). */
export function getDueTimeLabel(now = new Date()): string | null {
  const s = getDailyCheckIn();
  const covered = new Set(getDay().slots);
  const due = s.times.map((t, i) => ({ t, i })).filter(x => at(x.t, now) <= now && !covered.has(x.i));
  return due.length ? formatTime(due[due.length - 1].t) : null;
}

/** Next check-in time after now (today or tomorrow), or null if off. */
export function getNextCheckIn(now = new Date()): Date | null {
  const s = getDailyCheckIn();
  if (!s.enabled || !s.times.length) return null;
  const covered = new Set(getDay().slots);
  const later = s.times
    .map((t, i) => ({ i, d: at(t, now) }))
    .find(x => x.d > now && !covered.has(x.i));
  if (later) return later.d;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return at(s.times[0], tomorrow);
}

export function formatNextCheckIn(now = new Date()): string | null {
  const next = getNextCheckIn(now);
  if (!next) return null;
  const time = next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return next.getDate() === now.getDate() ? time : `tomorrow ${time}`;
}

// ── Check in ────────────────────────────────────────────────────────────────

/**
 * Record a check-in. Covers every check-in due now or within the next hour
 * and cancels their reminders. Works even when scheduled check-ins are off.
 */
export async function recordCheckIn(result: Omit<CheckInResult, 'at'>): Promise<CheckInResult> {
  const now = new Date();
  const s = getDailyCheckIn();
  const day = getDay();
  const covered = new Set(day.slots);
  const horizon = now.getTime() + EARLY_WINDOW_MIN * 60_000;
  s.times.forEach((t, i) => {
    if (at(t, now).getTime() <= horizon) covered.add(i);
  });

  const full: CheckInResult = { ...result, at: now.toISOString() };
  saveDay({ date: dateKey(now), slots: [...covered], last: full });

  if (Platform.OS !== 'web') {
    const today = dateKey(now);
    await Promise.all(
      [...covered].flatMap(i => [
        Notifications.cancelScheduledNotificationAsync(`${PREFIX}${today}-${i}-check`).catch(() => {}),
        Notifications.cancelScheduledNotificationAsync(`${PREFIX}${today}-${i}-followup`).catch(() => {}),
      ]),
    );
  }
  return full;
}

/** Quick "I'm OK" without the safety check. */
export async function confirmToday(): Promise<void> {
  await recordCheckIn({ ok: true });
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

/** (Re)plan upcoming check-ins. Safe to call often. */
export async function planDailyCheckIns(): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelAll();
  const s = getDailyCheckIn();
  if (!s.enabled || !s.times.length) return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const now = new Date();
    const covered = new Set(getDay().slots);
    const days = Math.min(MAX_PLAN_DAYS, Math.max(3, Math.floor(NOTIFICATION_BUDGET / (s.times.length * 2))));
    const many = s.times.length > 1;

    for (let d = 0; d < days; d++) {
      const day = new Date(now);
      day.setDate(now.getDate() + d);
      const key = dateKey(day);

      for (let i = 0; i < s.times.length; i++) {
        if (d === 0 && covered.has(i)) continue;
        const checkAt = at(s.times[i], day);
        const followAt = new Date(checkAt.getTime() + FOLLOW_UP_MIN * 60_000);

        if (checkAt.getTime() > now.getTime() + 30_000) {
          await Notifications.scheduleNotificationAsync({
            identifier: `${PREFIX}${key}-${i}-check`,
            content: {
              title: 'Are you OK?',
              body: many ? `Time for your ${formatTime(s.times[i])} check-in. Tap to check in.` : 'Tap to check in with HeatGuard.',
              sound: true,
              data: { route: '/checkin' },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: checkAt },
          });
        }
        if (followAt.getTime() > now.getTime() + 30_000) {
          await Notifications.scheduleNotificationAsync({
            identifier: `${PREFIX}${key}-${i}-followup`,
            content: {
              title: 'You haven\'t checked in',
              body: 'Open HeatGuard to say you are OK, or text your emergency contacts if you need help.',
              sound: true,
              data: { route: '/checkin' },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: followAt },
          });
        }
      }
    }
  } catch (e) {
    console.warn('Could not plan daily check-ins:', e);
  }
}
