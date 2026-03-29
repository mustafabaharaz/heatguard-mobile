import "../global.css";
import { Stack } from 'expo-router';
import { useEffect } from 'react';

export default function RootLayout() {
  // Load web-specific styles
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.textContent = `
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
