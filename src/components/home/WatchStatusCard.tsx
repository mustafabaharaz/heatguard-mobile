// ─────────────────────────────────────────────
// WatchStatusCard
// Home screen card showing Apple Watch connectivity and live metrics
// ─────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { watchBridge, type WatchConnectionState } from '../../features/watch/watchBridge';
import { getLatestHeartRate, formatBpm, getHrZoneLabel } from '../../features/watch/heartRateEngine';
import { COLORS } from '../../../theme';

// ── Types ─────────────────────────────────────────────────────────────────

interface WatchStatusCardProps {
  currentTempF?: number;
  thermalLevel?: 'safe' | 'caution' | 'high' | 'extreme' | 'crisis';
}

// ── Connection indicator ──────────────────────────────────────────────────

const CONN_CONFIG: Record<WatchConnectionState, {
  color: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = {
  reachable:   { color: COLORS.thermal.safe,    label: 'Connected',    icon: 'checkmark-circle' },
  paired:      { color: COLORS.thermal.caution, label: 'Not in Range', icon: 'radio-outline' },
  unavailable: { color: COLORS.neutral[400],    label: 'Not Paired',   icon: 'watch-outline' },
  error:       { color: COLORS.thermal.extreme, label: 'Error',        icon: 'alert-circle-outline' },
};

// ── Component ─────────────────────────────────────────────────────────────

export default function WatchStatusCard({
  currentTempF,
  thermalLevel = 'safe',
}: WatchStatusCardProps) {
  const [connectionState, setConnectionState] = useState<WatchConnectionState>('unavailable');
  const [heartBpm, setHeartBpm] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  // ── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    watchBridge.initialize().then(status => {
      setConnectionState(status.connectionState);
    });

    const unsub = watchBridge.onConnectionChange(state => {
      setConnectionState(state);
    });

    return unsub;
  }, []);

  // ── Heart rate polling ───────────────────────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const poll = async () => {
      const reading = await getLatestHeartRate();
      if (reading) {
        setHeartBpm(reading.bpm);
        setLastSyncTime(reading.timestamp);
      }
    };

    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Pulse animation for reachable state ──────────────────────────────────

  useEffect(() => {
    if (connectionState !== 'reachable') return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [connectionState, pulseAnim]);

  // ── Render ───────────────────────────────────────────────────────────────

  const conn = CONN_CONFIG[connectionState];
  const thermalColor = {
    safe:    COLORS.thermal.safe,
    caution: COLORS.thermal.caution,
    high:    COLORS.thermal.high,
    extreme: COLORS.thermal.extreme,
    crisis:  COLORS.thermal.crisis,
  }[thermalLevel];

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const diff = Math.round((Date.now() - lastSyncTime) / 1000);
    if (diff < 60) return `${diff}s ago`;
    return `${Math.round(diff / 60)}m ago`;
  };

  if (Platform.OS !== 'ios') return null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push('/watch/setup')}
      activeOpacity={0.85}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="watch" size={18} color={COLORS.neutral[100]} />
          <Text style={styles.title}>Apple Watch</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: conn.color + '22' }]}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Ionicons name={conn.icon} size={12} color={conn.color} />
          </Animated.View>
          <Text style={[styles.statusLabel, { color: conn.color }]}>
            {conn.label}
          </Text>
        </View>
      </View>

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        {/* Heart rate */}
        <View style={styles.metric}>
          <Ionicons name="heart" size={16} color="#EF4444" />
          <Text style={styles.metricValue}>{formatBpm(heartBpm)}</Text>
          <Text style={styles.metricLabel}>{getHrZoneLabel(heartBpm)}</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Thermal on Watch */}
        <View style={styles.metric}>
          <Ionicons name="thermometer" size={16} color={thermalColor} />
          <Text style={[styles.metricValue, { color: thermalColor }]}>
            {currentTempF != null ? `${currentTempF}°F` : '—'}
          </Text>
          <Text style={styles.metricLabel}>On Watch</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Last sync */}
        <View style={styles.metric}>
          <Ionicons name="sync" size={16} color={COLORS.neutral[400]} />
          <Text style={styles.metricValue}>{formatLastSync()}</Text>
          <Text style={styles.metricLabel}>Last Sync</Text>
        </View>
      </View>

      {/* CTA for unpaired state */}
      {connectionState === 'unavailable' && (
        <View style={styles.ctaRow}>
          <Text style={styles.ctaText}>
            Pair your Apple Watch for wrist alerts →
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.neutral[100],
    fontFamily: 'Inter-SemiBold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.neutral[100],
    fontFamily: 'Inter-Bold',
    marginTop: 3,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.neutral[400],
    fontFamily: 'Inter-Regular',
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  ctaRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  ctaText: {
    fontSize: 12,
    color: COLORS.neutral[400],
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
});
