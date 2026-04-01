import "../global.css";
import { Stack } from 'expo-router';
import { SettingsProvider } from '../src/context/SettingsContext';
import { useOfflineSync } from '../src/utils/useOfflineSync';
import { OfflineBanner } from '../src/components/ui/OfflineBanner';


export default function RootLayout() {
  useOfflineSync();
  return (
    <SettingsProvider>
    <OfflineBanner />
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding/index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="emergency/contacts" />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="exposure/tracker" options={{ headerShown: false }} />
      <Stack.Screen name="profile/medications" options={{ headerShown: false }} />
      <Stack.Screen name="cooldown/timer" options={{ headerShown: false }} />
      <Stack.Screen name="preparedness/index" options={{ headerShown: false }} />
      <Stack.Screen name="offline/emergency-card" options={{ headerShown: false }} />
      <Stack.Screen name="neighborhood/index" options={{ headerShown: false }} />
      <Stack.Screen name="network/index" options={{ headerShown: false }} />
      <Stack.Screen name="routes/planner" options={{ headerShown: false }} />
    </Stack>    </SettingsProvider>
    
  );
}
