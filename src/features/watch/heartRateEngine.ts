// ─────────────────────────────────────────────
// HeatGuard Heart Rate Engine
// HealthKit heart rate integration — elevates heat risk when HR is high
// ─────────────────────────────────────────────
//
// Requires: react-native-health
// Install:  npx expo install react-native-health
// Note:     Requires EAS build + HealthKit entitlement

import { Platform } from 'react-native';
import type { ThermalLevel } from './watchTypes';

// ── HealthKit shim ────────────────────────────────────────────────────────

let AppleHealthKit: any = null;

try {
  AppleHealthKit = require('react-native-health').default;
} catch {
  // Graceful degradation — feature simply unavailable
}

// ── Constants ─────────────────────────────────────────────────────────────

const PERMISSIONS = {
  permissions: {
    read: ['HeartRate', 'RestingHeartRate', 'HeartRateVariabilitySDNN'],
    write: [],
  },
};

// Heart rate thresholds (bpm) that indicate heat stress
const HR_THRESHOLDS = {
  elevated:  90,   // Worth noting; mild flag
  high:     110,   // Moderate heat stress signal
  critical: 130,   // Strong heat stress; escalate risk
};

// ── Types ─────────────────────────────────────────────────────────────────

export interface HeartRateReading {
  bpm: number;
  timestamp: number;
  source: 'apple_watch' | 'healthkit' | 'manual';
}

export interface HeartRateRisk {
  currentBpm: number | null;
  status: 'normal' | 'elevated' | 'high' | 'critical' | 'unavailable';
  riskMultiplier: number;       // 1.0 baseline, up to 1.5 for critical
  recommendation: string | null;
  lastUpdated: number | null;
}

// ── State ─────────────────────────────────────────────────────────────────

let isInitialized = false;
let latestReading: HeartRateReading | null = null;
let readingSubscription: any = null;

// ── Init ──────────────────────────────────────────────────────────────────

export async function initHeartRateEngine(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !AppleHealthKit) return false;
  if (isInitialized) return true;

  return new Promise(resolve => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (err: any) => {
      if (err) {
        console.error('[HeartRate] HealthKit init failed:', err);
        resolve(false);
        return;
      }
      isInitialized = true;
      console.log('[HeartRate] HealthKit initialized');
      resolve(true);
    });
  });
}

// ── Read ──────────────────────────────────────────────────────────────────

export async function getLatestHeartRate(): Promise<HeartRateReading | null> {
  if (!isInitialized || !AppleHealthKit) return null;

  const options = {
    unit: 'bpm' as const,
    startDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // Last 5 min
    ascending: false,
    limit: 1,
  };

  return new Promise(resolve => {
    AppleHealthKit.getHeartRateSamples(options, (err: any, results: any[]) => {
      if (err || !results?.length) {
        resolve(null);
        return;
      }
      const sample = results[0];
      const reading: HeartRateReading = {
        bpm: Math.round(sample.value),
        timestamp: new Date(sample.startDate).getTime(),
        source: 'healthkit',
      };
      latestReading = reading;
      resolve(reading);
    });
  });
}

export async function getRestingHeartRate(): Promise<number | null> {
  if (!isInitialized || !AppleHealthKit) return null;

  const options = {
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    ascending: false,
    limit: 1,
  };

  return new Promise(resolve => {
    AppleHealthKit.getRestingHeartRate(options, (err: any, results: any) => {
      if (err || !results?.value) {
        resolve(null);
        return;
      }
      resolve(Math.round(results.value));
    });
  });
}

// ── Stream live heart rate from Watch ────────────────────────────────────

export function subscribeToHeartRate(
  onReading: (reading: HeartRateReading) => void,
): () => void {
  if (!isInitialized || !AppleHealthKit) return () => {};

  // Query every 30 seconds for fresh readings
  const interval = setInterval(async () => {
    const reading = await getLatestHeartRate();
    if (reading && reading.bpm > 0) {
      latestReading = reading;
      onReading(reading);
    }
  }, 30_000);

  return () => clearInterval(interval);
}

// ── Risk calculation ──────────────────────────────────────────────────────

/**
 * Returns a risk multiplier based on current heart rate.
 * A higher BPM in heat conditions compounds the danger significantly.
 *
 * Combined with thermal level:
 *   Safe + Normal HR     = 1.0x (baseline)
 *   Extreme + Critical HR = up to 1.5x (escalated to near-crisis)
 */
export function getHeartRateRisk(bpm: number | null): HeartRateRisk {
  if (bpm === null) {
    return {
      currentBpm: null,
      status: 'unavailable',
      riskMultiplier: 1.0,
      recommendation: null,
      lastUpdated: null,
    };
  }

  if (bpm >= HR_THRESHOLDS.critical) {
    return {
      currentBpm: bpm,
      status: 'critical',
      riskMultiplier: 1.5,
      recommendation: 'Move to cool shade or AC immediately. Your heart rate indicates significant heat stress.',
      lastUpdated: Date.now(),
    };
  }

  if (bpm >= HR_THRESHOLDS.high) {
    return {
      currentBpm: bpm,
      status: 'high',
      riskMultiplier: 1.3,
      recommendation: 'Slow your activity and hydrate now. Your heart is working hard in this heat.',
      lastUpdated: Date.now(),
    };
  }

  if (bpm >= HR_THRESHOLDS.elevated) {
    return {
      currentBpm: bpm,
      status: 'elevated',
      riskMultiplier: 1.15,
      recommendation: 'Take a break and drink water. Your heart rate is elevated for these conditions.',
      lastUpdated: Date.now(),
    };
  }

  return {
    currentBpm: bpm,
    status: 'normal',
    riskMultiplier: 1.0,
    recommendation: null,
    lastUpdated: Date.now(),
  };
}

/**
 * Compute composite risk score factoring in both thermal level and heart rate.
 * Used to elevate risk tier shown to the user.
 */
export function computeCompositeRisk(
  baseRiskScore: number,
  hrRisk: HeartRateRisk,
): { compositeScore: number; escalated: boolean; explanation: string | null } {
  const composite = Math.min(100, Math.round(baseRiskScore * hrRisk.riskMultiplier));
  const escalated = composite > baseRiskScore;

  return {
    compositeScore: composite,
    escalated,
    explanation:
      escalated && hrRisk.currentBpm
        ? `Heart rate ${hrRisk.currentBpm} bpm is increasing your heat risk.`
        : null,
  };
}

// ── Utility ───────────────────────────────────────────────────────────────

export function formatBpm(bpm: number | null): string {
  if (bpm === null) return '– bpm';
  return `${bpm} bpm`;
}

export function getHrZoneLabel(bpm: number | null): string {
  if (bpm === null) return 'Unavailable';
  if (bpm < 60)  return 'Resting';
  if (bpm < 90)  return 'Normal';
  if (bpm < 110) return 'Elevated';
  if (bpm < 130) return 'High';
  return 'Critical';
}
