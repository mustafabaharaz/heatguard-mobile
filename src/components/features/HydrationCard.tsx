import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  getStatusColor,
  getStatusLabel,
  type HydrationSummary,
} from '../../features/hydration/hydrationEngine';

const COLORS = {
  surface: '#1A2942',
  surfaceElevated: '#243352',
  surfaceHigh: '#2D3F5C',
  border: '#2D3F5C',
  text: { primary: '#F8FAFC', secondary: '#94A3B8', tertiary: '#64748B' },
};

interface Props {
  summary: HydrationSummary | null;
}

export function HydrationCard({ summary }: Props) {
  if (!summary) {
    return (
      <TouchableOpacity
        style={styles.emptyCard}
        onPress={() => router.push('/hydration/tracker')}
        activeOpacity={0.75}
      >
        <Text style={styles.emptyIcon}>💧</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.emptyTitle}>Hydration Tracker</Text>
          <Text style={styles.emptySubtitle}>Track your daily water intake</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  const statusColor = getStatusColor(summary.status);
  const pct = summary.percentComplete;
  const consumedOz = Math.round(summary.consumedMl / 29.574);
  const targetOz = Math.round(summary.target.dailyTargetMl / 29.574);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push('/hydration/tracker')}
      activeOpacity={0.8}
    >
      <View style={styles.row}>
        {/* Left: text info */}
        <View style={styles.info}>
          <Text style={styles.cardLabel}>HYDRATION</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.consumed, { color: statusColor }]}>{consumedOz}</Text>
            <Text style={styles.target}>/ {targetOz} oz</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(summary.status)}
            </Text>
          </View>
        </View>

        {/* Right: mini arc */}
        <View style={styles.arcContainer}>
          <View style={styles.arcBackground}>
            <View
              style={[
                styles.arcFill,
                {
                  height: `${pct}%`,
                  backgroundColor: statusColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.arcPct, { color: statusColor }]}>{pct}%</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${pct}%`, backgroundColor: statusColor },
          ]}
        />
      </View>

      <Text style={styles.hint}>Tap to log intake →</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 14,
  },
  emptyIcon: { fontSize: 24 },
  emptyTitle: { color: COLORS.text.primary, fontSize: 15, fontWeight: '600' },
  emptySubtitle: { color: COLORS.text.secondary, fontSize: 12, marginTop: 3 },
  chevron: { color: COLORS.text.tertiary, fontSize: 20 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  info: { gap: 6 },
  cardLabel: {
    color: COLORS.text.tertiary,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  consumed: { fontSize: 32, fontWeight: '700' },
  target: { color: COLORS.text.secondary, fontSize: 14 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  arcContainer: { alignItems: 'center', gap: 4 },
  arcBackground: {
    width: 28,
    height: 52,
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  arcFill: { width: '100%', borderRadius: 14 },
  arcPct: { fontSize: 11, fontWeight: '700' },

  progressTrack: {
    height: 5,
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  hint: { color: COLORS.text.tertiary, fontSize: 11, textAlign: 'right' },
});
