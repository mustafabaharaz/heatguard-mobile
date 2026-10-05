/**
 * Dead Man's Switch
 *
 * Triggered when the user's exposure session exceeds their safe limit.
 * Runs a 3-step escalation ladder:
 *
 *   Step 1: Check-in prompt (60s countdown) — user confirms they're OK
 *   Step 2: Urgent alert to the USER (loud notification) + one-tap
 *           "text my contacts my location" in the UI
 *   Step 3: Open the 911 call prompt after 5 more minutes without a response
 *
 * Honest limits (iOS): an app cannot send texts or place calls without the
 * user's tap, and timers pause while the app is in the background. Truly
 * automatic contact alerts need a server-side SMS service (planned, v1.1+).
 *
 * The switch resets when:
 *   - User responds "I'm OK" at any step
 *   - The user manually ends their tracking session
 */

import { Platform, Linking } from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────

export type EscalationStep = 'idle' | 'checkin' | 'alertContacts' | 'call911' | 'resolved';

export interface DmsState {
  step: EscalationStep;
  countdownSeconds: number;    // Seconds remaining in current step's countdown
  triggeredAt: number;         // epoch ms when DMS was activated
  stepEnteredAt: number;       // epoch ms when current step was entered
  contactsAlerted: boolean;
  locationShared: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

type DmsStateListener = (state: DmsState) => void;

// ── Constants ─────────────────────────────────────────────────────────────

const CHECKIN_COUNTDOWN_S = 60;         // 60 seconds to respond
const CONTACT_ALERT_WAIT_S = 5 * 60;   // 5 minutes before auto-911
const CALL_911 = 'tel:911';

// ── Service ───────────────────────────────────────────────────────────────

class DeadManSwitchService {
  private listeners: Set<DmsStateListener> = new Set();
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private escalationTimer: ReturnType<typeof setTimeout> | null = null;

  private state: DmsState = {
    step: 'idle',
    countdownSeconds: CHECKIN_COUNTDOWN_S,
    triggeredAt: 0,
    stepEnteredAt: 0,
    contactsAlerted: false,
    locationShared: false,
  };

  // ── Listeners ─────────────────────────────────────────────────────────

  subscribe(listener: DmsStateListener) {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  private emit() {
    const snap = { ...this.state };
    this.listeners.forEach(l => l(snap));
  }

  // ── Activate ──────────────────────────────────────────────────────────

  /**
   * Called by the exposure tracker when safe limit is exceeded.
   * Idempotent — calling it again while already active does nothing.
   */
  activate() {
    if (this.state.step !== 'idle') return;

    const now = Date.now();
    this.state = {
      step: 'checkin',
      countdownSeconds: CHECKIN_COUNTDOWN_S,
      triggeredAt: now,
      stepEnteredAt: now,
      contactsAlerted: false,
      locationShared: false,
    };

    this.startCountdown(CHECKIN_COUNTDOWN_S, () => this.escalateToStep2());
    this.emit();
  }

  // ── User response — "I'm OK" ──────────────────────────────────────────

  userConfirmedOK() {
    this.stopAllTimers();
    this.state = {
      ...this.state,
      step: 'resolved',
      countdownSeconds: 0,
    };
    this.emit();

    // Reset to idle after a short moment so UI can show the confirmation
    setTimeout(() => {
      this.state = { ...this.state, step: 'idle' };
      this.emit();
    }, 2000);
  }

  // ── Step 2: Alert contacts ────────────────────────────────────────────

  private async escalateToStep2() {
    this.stopAllTimers();

    this.state = {
      ...this.state,
      step: 'alertContacts',
      countdownSeconds: CONTACT_ALERT_WAIT_S,
      stepEnteredAt: Date.now(),
      contactsAlerted: false,
      locationShared: false,
    };

    this.emit();

    // Loud alert to the user (contacts are texted via the UI button)
    await this.alertUser();

    // Start a new countdown to auto-911
    this.startCountdown(CONTACT_ALERT_WAIT_S, () => this.escalateToStep3());
  }

  // ── Step 3: Auto-call 911 ─────────────────────────────────────────────

  private async escalateToStep3() {
    this.stopAllTimers();

    this.state = {
      ...this.state,
      step: 'call911',
      countdownSeconds: 0,
      stepEnteredAt: Date.now(),
    };

    this.emit();

    // Open the 911 call prompt (iOS requires the user to tap Call)
    try {
      const canCall = await Linking.canOpenURL(CALL_911);
      if (canCall) {
        await Linking.openURL(CALL_911);
      }
    } catch {
      // Silently fail on web — the UI will surface a manual call button
    }
  }

  // ── Manual override: call 911 now ─────────────────────────────────────

  async manualCall911() {
    this.stopAllTimers();
    try {
      await Linking.openURL(CALL_911);
    } catch {}
  }

  // ── Reset ─────────────────────────────────────────────────────────────

  reset() {
    this.stopAllTimers();
    this.state = {
      step: 'idle',
      countdownSeconds: CHECKIN_COUNTDOWN_S,
      triggeredAt: 0,
      stepEnteredAt: 0,
      contactsAlerted: false,
      locationShared: false,
    };
    this.emit();
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private startCountdown(seconds: number, onExpire: () => void) {
    this.state = { ...this.state, countdownSeconds: seconds };

    this.countdownTimer = setInterval(() => {
      const remaining = this.state.countdownSeconds - 1;
      this.state = { ...this.state, countdownSeconds: Math.max(0, remaining) };
      this.emit();

      if (remaining <= 0) {
        this.stopCountdownTimer();
      }
    }, 1000);

    this.escalationTimer = setTimeout(onExpire, seconds * 1000);
  }

  private stopAllTimers() {
    this.stopCountdownTimer();
    if (this.escalationTimer) {
      clearTimeout(this.escalationTimer);
      this.escalationTimer = null;
    }
  }

  private stopCountdownTimer() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private async alertUser() {
    // Urgent local notification to the user's own phone. This does NOT reach
    // emergency contacts — that requires the user's tap (see emergencyMessaging).
    try {
      const Notifications = require('expo-notifications');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🆘 HeatGuard — Are you okay?',
          body: "You haven't responded to your heat check-in. Open HeatGuard to confirm you're safe or text your contacts.",
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null, // immediate
      });
    } catch {
      // expo-notifications not available in this context
    }
  }

  // ── Public read ───────────────────────────────────────────────────────

  getState(): DmsState {
    return { ...this.state };
  }

  isActive(): boolean {
    return this.state.step !== 'idle';
  }
}

// Singleton
export const DeadManSwitch = new DeadManSwitchService();

// ── Formatting helpers (used by UI) ───────────────────────────────────────

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function escalationStepLabel(step: EscalationStep): string {
  switch (step) {
    case 'checkin':      return 'Check-in required';
    case 'alertContacts': return 'Urgent — are you okay?';
    case 'call911':      return 'Opening 911 call';
    case 'resolved':     return "You're safe";
    default:             return '';
  }
}
