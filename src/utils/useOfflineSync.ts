// ─────────────────────────────────────────────
// useOfflineSync Hook
// Call once in the root layout to trigger
// smart sync on app foreground and wire up
// the offline banner across the whole app.
// ─────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { runSmartSync, getSyncStatus, type SyncStatus } from '../features/offline/offlineSync';
import { useNetworkStatus } from './networkStatus';

interface UseOfflineSyncResult {
  syncStatus: SyncStatus | null;
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
}

export function useOfflineSync(): UseOfflineSyncResult {
  const network = useNetworkStatus();
  const [syncStatus, setSyncStatus]   = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing]     = useState(false);
  const lastForegroundSync = useRef<number>(0);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const triggerSync = async () => {
    if (isSyncing || !network.isOnline) return;
    setIsSyncing(true);
    try {
      await runSmartSync();
      const status = await getSyncStatus();
      setSyncStatus(status);
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync on mount (first launch)
  useEffect(() => {
    getSyncStatus().then(setSyncStatus);
    if (network.isOnline) {
      triggerSync();
    }
  }, []);

  // Sync when coming back to foreground (throttled to once per 5 min)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground = appState.current === 'background' || appState.current === 'inactive';
      const isNowActive   = nextState === 'active';

      if (wasBackground && isNowActive && network.isOnline) {
        const now = Date.now();
        const timeSinceLastSync = now - lastForegroundSync.current;
        if (timeSinceLastSync > 5 * 60_000) {
          lastForegroundSync.current = now;
          triggerSync();
        }
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [network.isOnline]);

  // Sync when connectivity is restored after being offline
  const wasOffline = useRef(false);
  useEffect(() => {
    if (network.isOffline) {
      wasOffline.current = true;
    } else if (wasOffline.current && network.isOnline) {
      wasOffline.current = false;
      triggerSync();
    }
  }, [network.isOffline, network.isOnline]);

  return { syncStatus, isSyncing, triggerSync };
}
