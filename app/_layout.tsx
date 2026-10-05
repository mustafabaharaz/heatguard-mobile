import "../global.css";
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { SettingsProvider } from '../src/context/SettingsContext';
import { useOfflineSync } from '../src/utils/useOfflineSync';
import { OfflineBanner } from '../src/components/ui/OfflineBanner';
import { watchBridge } from '../src/features/watch/watchBridge';
import { initHeartRateEngine } from '../src/features/watch/heartRateEngine';
import { startBackgroundSync, handleWatchMessage } from '../src/features/watch/watchDataSync';

export default function RootLayout() {
  useOfflineSync();

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    async function initWatch() {
      const status = await watchBridge.initialize();
      console.log('Watch status:', status.connectionState);
      if (status.isSupported) {
        await initHeartRateEngine();
        const unsub = watchBridge.onMessage(message => {
          handleWatchMessage(message, {
            onSOS: () => {},
            onHydrationLogged: (_amount) => {},
            onHeartRateUpdate: (_bpm) => {},
          });
        });
        startBackgroundSync(() => null);
        return unsub;
      }
    }

    const cleanup = initWatch();
    return () => { cleanup?.then(unsub => unsub?.()); };
  }, []);

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
        <Stack.Screen name="watch/setup" options={{ headerShown: false }} />
      </Stack>
    </SettingsProvider>
  );
}