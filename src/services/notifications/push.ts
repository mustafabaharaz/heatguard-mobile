// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/services/notifications/push.ts
// HeatGuard · Local notifications
// Heat alerts, daily check, and hot-day "look before you lock" reminders
// (now using the names of the people and pets who ride along).
// ─────────────────────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getNotificationPrefs } from '../../features/settings/appPrefs';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    return finalStatus;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

export async function scheduleHeatAlert(temperature: number, riskLevel: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Heat alert',
      body: getAlertMessage(temperature, riskLevel),
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { temperature, riskLevel },
    },
    trigger: null, // Immediate
  });
}

export async function scheduleDailyCheck(hour: number = 14) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'HeatGuard daily check',
      body: 'Time to check the temperature and stay safe!',
      sound: true,
    },
    trigger: {
      type: 'calendar' as any,
      hour,
      minute: 0,
      repeats: true,
    },
  });
}

function getAlertMessage(temp: number, riskLevel: string): string {
  if (temp >= 40) {
    return `CRITICAL: ${temp}°C - Extreme heat danger! Seek immediate shelter and hydration.`;
  }
  if (temp >= 35) {
    return `HIGH RISK: ${temp}°C - Heat exhaustion likely. Stay indoors and drink water.`;
  }
  if (temp >= 30) {
    return `CAUTION: ${temp}°C - Take breaks and stay hydrated in the heat.`;
  }
  return `Temperature: ${temp}°C - Stay aware of changing conditions.`;
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Hot-day vehicle reminder ("Look before you lock") ───────────────────────
// Scheduled locally from the real forecast: one morning reminder on each
// upcoming day whose high reaches the threshold. Re-planned on every weather
// refresh, so it always matches the latest forecast. Tapping it opens the
// Vehicle Heat Alert screen (see useNotificationRouting).

const VEHICLE_REMINDER_PREFIX = 'vehicle-reminder-';
export const VEHICLE_REMINDER_THRESHOLD_F = 95;
const VEHICLE_REMINDER_HOUR = 7;
const VEHICLE_REMINDER_MINUTE = 30;

export async function cancelVehicleReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(n => n.identifier.startsWith(VEHICLE_REMINDER_PREFIX))
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {}
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * @param days   upcoming days with their forecast highs
 * @param riders names of kids/pets/family who ride along (optional)
 */
export async function scheduleHotDayVehicleReminders(
  days: { dateKey: string; highF: number }[],
  riders: string[] = [],
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    // Clear previously planned reminders, then re-plan from this forecast
    await cancelVehicleReminders();
    if (!getNotificationPrefs().vehicleReminders) return; // user turned them off

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return; // never prompt from a background refresh

    const who = joinNames(riders);
    const now = Date.now();
    for (const day of days) {
      if (day.highF < VEHICLE_REMINDER_THRESHOLD_F) continue;
      const [y, m, d] = day.dateKey.split('-').map(Number);
      const when = new Date(y, m - 1, d, VEHICLE_REMINDER_HOUR, VEHICLE_REMINDER_MINUTE);
      if (when.getTime() <= now + 60_000) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: `${VEHICLE_REMINDER_PREFIX}${day.dateKey}`,
        content: {
          title: who ? `Hot day: check for ${who}` : 'Hot day: look before you lock',
          body: `Today reaches ${Math.round(day.highF)}°F. A parked car heats up fast.${
            who ? ` Always check the back seat for ${who}.` : ''
          } Tap to start a vehicle timer when you park.`,
          sound: true,
          data: { route: '/vehicle/alert' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
      });
    }
  } catch (error) {
    console.warn('Could not schedule vehicle reminders:', error);
  }
}
