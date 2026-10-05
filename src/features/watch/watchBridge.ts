// ─────────────────────────────────────────────
// HeatGuard Watch Bridge
// Core WCSession management for Phone ↔ Watch communication
// ─────────────────────────────────────────────
//
// Requires: react-native-watch-connectivity
// Install:  npx expo install react-native-watch-connectivity
// Note:     Requires EAS build (not Expo Go)

import { Platform, NativeEventEmitter, NativeModules } from 'react-native';
import type {
  WatchApplicationContext,
  WatchToPhoneMessage,
  PhoneToWatchMessage,
} from './watchTypes';

// ── Type shim for react-native-watch-connectivity ──────────────────────────
// We import dynamically so the module fails gracefully on Android / Expo Go
let WatchConnectivity: any = null;

try {
  WatchConnectivity = require('react-native-watch-connectivity').default;
} catch {
  // Not available in Expo Go or Android — silent degradation
}

// ── Connection state ────────────────────────────────────────────────────────

export type WatchConnectionState =
  | 'unavailable'   // Not iOS, or Watch not paired
  | 'paired'        // Paired but Watch app not installed / reachable
  | 'reachable'     // Watch is in range and reachable
  | 'error';

export interface WatchBridgeStatus {
  isSupported: boolean;
  isPaired: boolean;
  isReachable: boolean;
  isWatchAppInstalled: boolean;
  connectionState: WatchConnectionState;
}

// ── Event listener management ───────────────────────────────────────────────

type MessageHandler = (message: WatchToPhoneMessage) => void;
type ConnectionHandler = (state: WatchConnectionState) => void;

class HeatGuardWatchBridge {
  private static instance: HeatGuardWatchBridge;
  private messageHandlers = new Set<MessageHandler>();
  private connectionHandlers = new Set<ConnectionHandler>();
  private subscriptions: any[] = [];
  private _status: WatchBridgeStatus = {
    isSupported: false,
    isPaired: false,
    isReachable: false,
    isWatchAppInstalled: false,
    connectionState: 'unavailable',
  };

  static getInstance(): HeatGuardWatchBridge {
    if (!HeatGuardWatchBridge.instance) {
      HeatGuardWatchBridge.instance = new HeatGuardWatchBridge();
    }
    return HeatGuardWatchBridge.instance;
  }

  // ── Init ────────────────────────────────────────────────────────────────

  async initialize(): Promise<WatchBridgeStatus> {
    if (Platform.OS !== 'ios' || !WatchConnectivity) {
      console.log('[WatchBridge] Not available on this platform');
      return this._status;
    }

    try {
      const supported = await WatchConnectivity.isSupported();
      if (!supported) {
        this._status = { ...this._status, isSupported: false, connectionState: 'unavailable' };
        return this._status;
      }

      const [paired, reachable, installed] = await Promise.all([
        WatchConnectivity.isPaired().catch(() => false),
        WatchConnectivity.isReachable().catch(() => false),
        WatchConnectivity.isWatchAppInstalled().catch(() => false),
      ]);

      this._status = {
        isSupported: true,
        isPaired: paired,
        isReachable: reachable,
        isWatchAppInstalled: installed,
        connectionState: reachable ? 'reachable' : paired ? 'paired' : 'unavailable',
      };

      this._setupListeners();
      console.log('[WatchBridge] Initialized:', this._status);
    } catch (err) {
      console.error('[WatchBridge] Init error:', err);
      this._status = { ...this._status, connectionState: 'error' };
    }

    return this._status;
  }

  // ── Listeners ────────────────────────────────────────────────────────────

  private _setupListeners() {
    if (!WatchConnectivity) return;

    // Incoming messages from Watch
    const msgSub = WatchConnectivity.watchEvents.on(
      'message',
      (message: WatchToPhoneMessage) => {
        console.log('[WatchBridge] Message from Watch:', message.type);
        this.messageHandlers.forEach(h => h(message));
      },
    );

    // Reachability changes
    const reachSub = WatchConnectivity.watchEvents.on(
      'reachability',
      (reachable: boolean) => {
        this._status = {
          ...this._status,
          isReachable: reachable,
          connectionState: reachable ? 'reachable' : this._status.isPaired ? 'paired' : 'unavailable',
        };
        const state = this._status.connectionState;
        this.connectionHandlers.forEach(h => h(state));
      },
    );

    this.subscriptions.push(msgSub, reachSub);
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  // ── Sending ──────────────────────────────────────────────────────────────

  /**
   * Update application context — persisted on Watch even when not reachable.
   * This is the primary sync mechanism for thermal + user data.
   */
  async updateContext(context: WatchApplicationContext): Promise<boolean> {
    if (!WatchConnectivity || !this._status.isPaired) return false;

    try {
      await WatchConnectivity.updateApplicationContext(context as any);
      return true;
    } catch (err) {
      console.error('[WatchBridge] updateContext failed:', err);
      return false;
    }
  }

  /**
   * Send a real-time message — only works when Watch is reachable.
   * Use for alerts, haptics, SOS acknowledgement.
   */
  async sendMessage(message: PhoneToWatchMessage): Promise<boolean> {
    if (!WatchConnectivity || !this._status.isReachable) return false;

    return new Promise(resolve => {
      WatchConnectivity.sendMessage(
        message as any,
        (_reply: any) => resolve(true),
        (err: any) => {
          console.error('[WatchBridge] sendMessage failed:', err);
          resolve(false);
        },
      );
    });
  }

  /**
   * Transfer user info — queued delivery, survives disconnect.
   * Use for non-urgent data like profile updates.
   */
  async transferUserInfo(info: Partial<WatchApplicationContext>): Promise<boolean> {
    if (!WatchConnectivity || !this._status.isPaired) return false;

    try {
      await WatchConnectivity.transferUserInfo(info as any);
      return true;
    } catch (err) {
      console.error('[WatchBridge] transferUserInfo failed:', err);
      return false;
    }
  }

  // ── Haptic dispatch ──────────────────────────────────────────────────────

  async sendHaptic(pattern: 'warning' | 'critical' | 'success' | 'reminder'): Promise<boolean> {
    return this.sendMessage({ type: 'HAPTIC', pattern });
  }

  // ── Status ───────────────────────────────────────────────────────────────

  get status(): WatchBridgeStatus { return this._status; }

  async refreshStatus(): Promise<WatchBridgeStatus> {
    return this.initialize();
  }

  destroy() {
    this.subscriptions.forEach(s => {
      if (s && typeof s.remove === 'function') s.remove();
    });
    this.subscriptions = [];
    this.messageHandlers.clear();
    this.connectionHandlers.clear();
  }
}

export const watchBridge = HeatGuardWatchBridge.getInstance();
