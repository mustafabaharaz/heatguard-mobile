// ─────────────────────────────────────────────
// RouteSafetyCard
// Home screen hub card for Heat-Safe Route Planner
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

const C = {
  CARD:       '#1E293B',
  BORDER:     '#334155',
  TEXT:       '#F1F5F9',
  TEXT_DIM:   '#94A3B8',
  TEXT_MUTED: '#64748B',
  ACCENT:     '#3B82F6',
  SUCCESS:    '#22C55E',
  WARNING:    '#F59E0B',
  DANGER:     '#EF4444',
} as const;

export function RouteSafetyCard() {
  const router = useRouter();

  // Static conditions snapshot — matches planner defaults
  const conditions = [
    { label: 'Direct route', value: 'High Risk', color: C.DANGER },
    { label: 'Shaded route', value: 'Low Risk',  color: C.SUCCESS },
    { label: 'UV savings',   value: '~3.2 units', color: C.WARNING },
  ];

  return (
    <View style={[styles.card, { borderColor: C.SUCCESS + '33' }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.cardIcon}>🛣</Text>
          <Text style={styles.cardTitle}>Heat-Safe Route Planner</Text>
        </View>
        <View style={styles.uvBadge}>
          <Text style={styles.uvBadgeText}>UV 9</Text>
        </View>
      </View>

      {/* Route comparison preview */}
      <View style={styles.routePreview}>
        {conditions.map((c, i) => (
          <View key={c.label} style={[styles.previewItem, i < conditions.length - 1 && styles.previewItemBorder]}>
            <Text style={styles.previewLabel}>{c.label}</Text>
            <Text style={[styles.previewValue, { color: c.color }]}>{c.value}</Text>
          </View>
        ))}
      </View>

      {/* Prompt */}
      <View style={styles.promptRow}>
        <Text style={styles.promptText}>
          Pick a safer path — shade cuts UV exposure by up to 75%
        </Text>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.cta}
        onPress={() => router.push('/routes/planner')}
        activeOpacity={0.75}
      >
        <Text style={styles.ctaText}>Plan My Route</Text>
        <Text style={styles.ctaArrow}>→</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.CARD,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIcon: { fontSize: 16 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.TEXT, letterSpacing: 0.2 },
  uvBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  uvBadgeText: { fontSize: 11, fontWeight: '700', color: C.WARNING, letterSpacing: 0.3 },

  routePreview: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  previewItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 3,
  },
  previewItemBorder: {
    borderRightWidth: 1,
    borderRightColor: C.BORDER,
  },
  previewLabel: {
    fontSize: 10,
    color: C.TEXT_MUTED,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  promptRow: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  promptText: {
    fontSize: 12,
    color: C.TEXT_DIM,
    lineHeight: 17,
  },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.BORDER,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ctaText: { fontSize: 13, fontWeight: '600', color: C.ACCENT },
  ctaArrow: { fontSize: 16, color: C.ACCENT },
});
