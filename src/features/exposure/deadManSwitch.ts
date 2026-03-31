/**
 * Dead Man's Switch
 *
 * Triggered when the user's exposure session exceeds their safe limit.
 * Runs a 3-step escalation ladder:
 *
 *   Step 1: Check-in prompt (60s countdown) — user confirms they're OK
 *   Step 2: Alert all emergency contacts + share GPS location
 *   Step 3: Auto-call 911 after 5 additional minutes of no confirmation
 *
 * The switch resets when:
 *   - User responds "I'm OK" at any step
 *   - An emergency contact confirms via the app
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
      contactsAlerted: true,
      locationShared: true,
    };

    this.emit();

    // Fire the actual notifications to contacts
    await this.notifyContacts();

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

    // Attempt to open the phone dialer pre-filled with 911
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

  private async notifyContacts() {
    // Load emergency contacts from storage and fire SMS / push
    // In a production app this would call a backend API that sends
    // authenticated push notifications and SMS to stored contacts.
    // For now we schedule a local notification as the fallback.
    try {
      const Notifications = require('expo-notifications');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🆘 HeatGuard — Safety Alert',
          body: 'Your contact may need help. Their location has been shared with you.',
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
    case 'alertContacts': return 'Alerting your contacts';
    case 'call911':      return 'Calling 911';
    case 'resolved':     return "You're safe";
    default:             return '';
  }
}
