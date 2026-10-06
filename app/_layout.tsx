import { Stack } from 'expo-router';
import { SettingsProvider } from '../src/context/SettingsContext';
import { useOfflineSync } from '../src/utils/useOfflineSync';
import { OfflineBanner } from '../src/components/ui/OfflineBanner';
import { useNotificationRouting } from '../src/services/notifications/useNotificationRouting';

export default function RootLayout() {
  useOfflineSync();
  useNotificationRouting();
  return (
    <SettingsProvider>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="emergency/contacts" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="profile/medications" />
        <Stack.Screen name="cooldown/timer" />
        <Stack.Screen name="preparedness/index" />
        <Stack.Screen name="offline/emergency-card" />
      </Stack>
    </SettingsProvider>
  );
}
