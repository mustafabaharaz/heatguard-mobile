// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · App preferences (persisted)
//  - Notification switches that the app actually honors
//  - Which version of the safety disclaimer the user has acknowledged
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import { DISCLAIMER_VERSION } from '../../content/disclaimer';

export interface NotificationPrefs {
  heatAlerts: boolean;        // immediate alert when feels-like crosses threshold
  vehicleReminders: boolean;  // 7:30 AM "look before you lock" on hot days
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  heatAlerts: true,
  vehicleReminders: true,
};

const NOTIF_KEY = 'heatguard_notification_prefs';
const DISCLAIMER_KEY = 'heatguard_disclaimer_version';

let storage: any = null;
function getStorage() {
  if (storage) return storage;
  if (Platform.OS !== 'web') {
    const { MMKV } = require('../../lib/mmkvCompat');
    storage = new MMKV({ id: 'settings-storage' });
  } else {
    storage = {
      getString: (k: string) => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) ?? undefined : undefined),
      set: (k: string, v: string) => { if (typeof localStorage !== 'undefined') localStorage.setItem(k, String(v)); },
    };
  }
  return storage;
}

export function getNotificationPrefs(): NotificationPrefs {
  try {
    const raw = getStorage().getString(NOTIF_KEY);
    if (raw) return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_NOTIFICATION_PREFS };
}

export function setNotificationPref<K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]): NotificationPrefs {
  const next = { ...getNotificationPrefs(), [key]: value };
  try { getStorage().set(NOTIF_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function hasAcceptedDisclaimer(): boolean {
  try {
    return Number(getStorage().getString(DISCLAIMER_KEY) ?? 0) >= DISCLAIMER_VERSION;
  } catch {
    return false;
  }
}

export function acceptDisclaimer(): void {
  try { getStorage().set(DISCLAIMER_KEY, String(DISCLAIMER_VERSION)); } catch {}
}
