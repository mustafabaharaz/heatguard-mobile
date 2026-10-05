// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Notification tap routing
// When a notification carries `data.route` (e.g. '/vehicle/alert'), tapping it
// opens that screen — whether the app was running or launched by the tap.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

const handled = new Set<string>();

function openRoute(response: Notifications.NotificationResponse | null) {
  if (!response) return;
  const id = response.notification.request.identifier;
  if (handled.has(id)) return;
  handled.add(id);

  const route = response.notification.request.content.data?.route;
  if (typeof route === 'string' && route.startsWith('/')) {
    // Defer so the root navigator is mounted before we navigate
    setTimeout(() => router.push(route as any), 0);
  }
}

export function useNotificationRouting() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;

    Notifications.getLastNotificationResponseAsync()
      .then(r => { if (active) openRoute(r); })
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener(openRoute);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
}
