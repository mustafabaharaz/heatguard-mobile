// ─────────────────────────────────────────────
// Network Status Monitor
// NetInfo wrapper with React hook and
// connection quality classification
// ─────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export type ConnectionState = 'online' | 'offline' | 'degraded';

export interface NetworkStatus {
  state: ConnectionState;
  isOnline: boolean;
  isOffline: boolean;
  /** True when connected but slow/unreliable */
  isDegraded: boolean;
  /** Connection type: wifi | cellular | none | unknown */
  type: string;
  /** ISO timestamp of last state change */
  lastChanged: string;
}

const DEFAULT_STATUS: NetworkStatus = {
  state: 'online',
  isOnline: true,
  isOffline: false,
  isDegraded: false,
  type: 'unknown',
  lastChanged: new Date().toISOString(),
};

// ─── Platform-safe NetInfo import ────────────────────────────────────────────
// NetInfo is available in Expo but we guard for web fallback

let NetInfo: any = null;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch {
  // Web or unavailable — use navigator.onLine
}

function classifyState(isConnected: boolean | null, type: string): ConnectionState {
  if (!isConnected) return 'offline';
  if (type === 'cellular' && Platform.OS !== 'web') return 'degraded';
  return 'online';
}

// ─── Singleton Listener ───────────────────────────────────────────────────────

type Listener = (status: NetworkStatus) => void;

class NetworkMonitor {
  private current: NetworkStatus = { ...DEFAULT_STATUS };
  private listeners: Set<Listener> = new Set();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private init() {
    if (Platform.OS === 'web') {
      this.initWeb();
    } else if (NetInfo) {
      this.initNative();
    }
  }

  private initWeb() {
    const update = () => {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      this.update(isOnline, 'unknown');
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online',  update);
      window.addEventListener('offline', update);
      update();
      this.unsubscribe = () => {
        window.removeEventListener('online',  update);
        window.removeEventListener('offline', update);
      };
    }
  }

  private initNative() {
    this.unsubscribe = NetInfo.addEventListener((state: any) => {
      this.update(
        state.isConnected ?? true,
        state.type ?? 'unknown',
      );
    });
    // Fetch current state immediately
    NetInfo.fetch().then((state: any) => {
      this.update(state.isConnected ?? true, state.type ?? 'unknown');
    }).catch(() => {
      // silent — default to online
    });
  }

  private update(isConnected: boolean, type: string) {
    const connectionState = classifyState(isConnected, type);
    this.current = {
      state: connectionState,
      isOnline: connectionState === 'online' || connectionState === 'degraded',
      isOffline: connectionState === 'offline',
      isDegraded: connectionState === 'degraded',
      type,
      lastChanged: new Date().toISOString(),
    };
    this.listeners.forEach((fn) => fn(this.current));
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.current); // emit current state immediately
    return () => this.listeners.delete(fn);
  }

  getStatus(): NetworkStatus {
    return this.current;
  }

  destroy() {
    this.unsubscribe?.();
    this.listeners.clear();
  }
}

// Singleton instance
const monitor = new NetworkMonitor();

// ─── React Hook ───────────────────────────────────────────────────────────────

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => monitor.getStatus());

  useEffect(() => {
    const unsub = monitor.subscribe(setStatus);
    return unsub;
  }, []);

  return status;
}

// ─── Imperative API ───────────────────────────────────────────────────────────

export function getNetworkStatus(): NetworkStatus {
  return monitor.getStatus();
}

export function subscribeToNetwork(fn: Listener): () => void {
  return monitor.subscribe(fn);
}
