/**
 * Passive Exposure Tracker
 *
 * Runs a 60-second tick loop while the app is foregrounded.
 * Accumulates heat-weighted exposure minutes and persists the
 * current session so it survives app restarts.
 *
 * Weighted exposure: 1 minute at 100°F counts more than 1 minute
 * at 80°F. Formula: weight = 0.5 + (tempF - 80) / 10, clamped [0.5, 4].
 * The risk multiplier from the Heat Profile lowers the safe-limit threshold
 * so higher-risk users get warned sooner.
 */

import { AppState, AppStateStatus } from 'react-native';
import { getHeatProfile, getRiskMultiplier } from '../profile/storage/profileStorage';
import { saveExposureSession, loadCurrentSession } from './exposureStorage';

// ── Thermal level helper ──────────────────────────────────────────────────

function getThermalLevel(tempC: number): string {
  if (tempC >= 40) return 'crisis';
  if (tempC >= 35) return 'extreme';
  if (tempC >= 30) return 'highAlert';
  if (tempC >= 25) return 'caution';
  return 'safe';
}

// ── Constants ─────────────────────────────────────────────────────────────

const TICK_INTERVAL_MS = 60_000;
const BASE_TEMP_F = 80;

const BASE_SAFE_LIMITS: Record<string, number> = {
  safe:      240,
  caution:   120,
  highAlert:  60,
  extreme:    30,
  crisis:     15,
};

// ── Types ─────────────────────────────────────────────────────────────────

export interface ExposureState {
  isTracking: boolean;
  sessionMinutes: number;
  weightedMinutes: number;
  safeLimit: number;
  percentUsed: number;
  currentTempF: number;
  thermalLevel: string;
  sessionStart: number;
  lastTickAt: number;
}

type ExposureStateListener = (state: ExposureState) => void;

// ── Service ───────────────────────────────────────────────────────────────

class PassiveTrackerService {
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private listeners: Set<ExposureStateListener> = new Set();

  private state: ExposureState = {
    isTracking: false,
    sessionMinutes: 0,
    weightedMinutes: 0,
    safeLimit: 120,
    percentUsed: 0,
    currentTempF: 0,
    thermalLevel: 'safe',
    sessionStart: 0,
    lastTickAt: 0,
  };

  // ── Listeners ─────────────────────────────────────────────────────────

  subscribe(listener: ExposureStateListener) {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  private emit() {
    const snapshot = { ...this.state };
    this.listeners.forEach(l => l(snapshot));
  }

  // ── Start / Stop ──────────────────────────────────────────────────────

  async startSession(initialTempF: number) {
    if (this.state.isTracking) return;

    const persisted = await loadCurrentSession();
    const now = Date.now();

    if (persisted && (now - persisted.lastTickAt) < 10 * 60_000) {
      this.state = {
        ...this.state,
        isTracking: true,
        sessionMinutes: persisted.sessionMinutes,
        weightedMinutes: persisted.weightedMinutes,
        sessionStart: persisted.sessionStart,
        lastTickAt: persisted.lastTickAt,
        currentTempF: initialTempF,
      };
    } else {
      this.state = {
        ...this.state,
        isTracking: true,
        sessionMinutes: 0,
        weightedMinutes: 0,
        sessionStart: now,
        lastTickAt: now,
        currentTempF: initialTempF,
      };
    }

    await this.refreshLimits(initialTempF);
    this.attachAppStateListener();
    this.startTick();
    this.emit();
  }

  async stopSession() {
    this.stopTick();
    this.detachAppStateListener();
    await saveExposureSession(null);
    this.state = {
      ...this.state,
      isTracking: false,
      sessionMinutes: 0,
      weightedMinutes: 0,
      percentUsed: 0,
      sessionStart: 0,
      lastTickAt: 0,
    };
    this.emit();
  }

  async updateTemperature(tempF: number) {
    if (!this.state.isTracking) return;
    await this.refreshLimits(tempF);
    this.emit();
  }

  // ── Tick ──────────────────────────────────────────────────────────────

  private startTick() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  private stopTick() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private async tick() {
    if (!this.state.isTracking) return;

    const weight = this.calcWeight(this.state.currentTempF);
    const newSession = this.state.sessionMinutes + 1;
    const newWeighted = this.state.weightedMinutes + weight;
    const percentUsed = Math.min(100, (newWeighted / this.state.safeLimit) * 100);

    this.state = {
      ...this.state,
      sessionMinutes: newSession,
      weightedMinutes: newWeighted,
      percentUsed,
      lastTickAt: Date.now(),
    };

    await saveExposureSession({
      sessionStart: this.state.sessionStart,
      sessionMinutes: newSession,
      weightedMinutes: newWeighted,
      safeLimit: this.state.safeLimit,
      lastTickAt: this.state.lastTickAt,
      currentTempF: this.state.currentTempF,
    });

    this.emit();
  }

  // ── Limit calculation ─────────────────────────────────────────────────

  private async refreshLimits(tempF: number) {
    const thermalLevel = getThermalLevel(this.fToC(tempF));
    const profile = await getHeatProfile();
    const riskMultiplier = profile ? getRiskMultiplier(profile) : 1.0;

    const baseLimit = BASE_SAFE_LIMITS[thermalLevel] ?? 120;
    const safeLimit = Math.round(baseLimit / riskMultiplier);
    const percentUsed = this.state.isTracking
      ? Math.min(100, (this.state.weightedMinutes / safeLimit) * 100)
      : 0;

    this.state = {
      ...this.state,
      currentTempF: tempF,
      thermalLevel,
      safeLimit,
      percentUsed,
    };
  }

  private calcWeight(tempF: number): number {
    const excess = tempF - BASE_TEMP_F;
    const raw = 0.5 + Math.max(0, excess) / 10;
    return Math.min(4.0, Math.max(0.5, raw));
  }

  private fToC(f: number) {
    return (f - 32) * 5 / 9;
  }

  // ── AppState ──────────────────────────────────────────────────────────

  private attachAppStateListener() {
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppState);
  }

  private detachAppStateListener() {
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }

  private handleAppState = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      if (this.state.isTracking && !this.tickTimer) {
        this.startTick();
      }
    } else if (nextState === 'background' || nextState === 'inactive') {
      this.stopTick();
    }
  };

  // ── Public read ───────────────────────────────────────────────────────

  getState(): ExposureState {
    return { ...this.state };
  }
}

export const PassiveTracker = new PassiveTrackerService();
