import "../global.css";
import { Stack } from 'expo-router';
import { SettingsProvider } from '../src/context/SettingsContext';

export default function RootLayout() {
  return (
    <SettingsProvider>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding/index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="emergency/contacts" />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="exposure/tracker" options={{ headerShown: false }} />
      <Stack.Screen name="profile/medications" options={{ headerShown: false }} />
      </Stack>
    </SettingsProvider>
  );
}
