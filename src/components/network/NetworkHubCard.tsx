// ─────────────────────────────────────────────
// NetworkHubCard
// Home screen hub card for Emergency Network Hub
// ─────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  computeNetworkSnapshot,
  getShelterStatusConfig,
  type NetworkSnapshot,
} from '../../features/network/networkEngine';
import {
  loadNetworkSnapshot,
  saveNetworkSnapshot,
} from '../../features/network/networkStorage';

const C = {
  CARD: '#1E293B',
  BORDER: '#334155',
  TEXT: '#F1F5F9',
  TEXT_DIM: '#94A3B8',
  TEXT_MUTED: '#64748B',
  ACCENT: '#3B82F6',
  SUCCESS: '#22C55E',
  WARNING: '#F59E0B',
  DANGER: '#EF4444',
} as const;

export function NetworkHubCard() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<NetworkSnapshot | null>(null);

  useEffect(() => {
    (async () => {
      let snap = await loadNetworkSnapshot();
      if (!snap) {
        snap = computeNetworkSnapshot();
        await saveNetworkSnapshot(snap);
      }
      setSnapshot(snap);
    })();
  }, []);

  const availableShelters = snapshot?.shelters.filter((s) => s.status === 'open' || s.status === 'limited').length ?? 0;
  const availableVolunteers = snapshot?.volunteers.filter((v) => v.status === 'available').length ?? 0;
  const criticalRequests = snapshot?.activeRequests.filter((r) => r.urgency === 'critical' && !r.resolved).length ?? 0;
  const nearestOpen = snapshot?.shelters.find((s) => s.status === 'open');

  const statusColors: Record<string, string> = {
    normal: C.SUCCESS,
    elevated: C.WARNING,
    critical: C.DANGER,
  };
  const systemStatus = snapshot?.systemStatus ?? 'normal';
  const statusColor = statusColors[systemStatus];

  return (
    <View style={[styles.card, { borderColor: statusColor + '33' }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.cardIcon}>🚨</Text>
          <Text style={styles.cardTitle}>Emergency Network</Text>
        </View>
        <View style={[styles.systemBadge, { backgroundColor: statusColor + '22' }]}>
          <View style={[styles.systemDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.systemBadgeText, { color: statusColor }]}>
            {systemStatus.charAt(0).toUpperCase() + systemStatus.slice(1)}
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={[styles.statVal, { color: C.SUCCESS }]}>{availableShelters}</Text>
          <Text style={styles.statLabel}>Shelters Open</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={[styles.statVal, { color: C.ACCENT }]}>{availableVolunteers}</Text>
          <Text style={styles.statLabel}>Volunteers</Text>
        </View>
        {criticalRequests > 0 && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={[styles.statVal, { color: C.DANGER }]}>{criticalRequests}</Text>
              <Text style={styles.statLabel}>Critical</Text>
            </View>
          </>
        )}
      </View>

      {/* Nearest shelter */}
      {nearestOpen && (
        <View style={styles.nearestRow}>
          <Text style={styles.nearestLabel}>Nearest open</Text>
          <View style={styles.nearestRight}>
            <Text style={styles.nearestName} numberOfLines={1}>{nearestOpen.name}</Text>
            <Text style={styles.nearestDist}>{nearestOpen.distanceMiles} mi</Text>
          </View>
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity
        style={styles.cta}
        onPress={() => router.push('/network')}
        activeOpacity={0.75}
      >
        <Text style={styles.ctaText}>Open Network Hub</Text>
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
  systemBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  systemDot: { width: 6, height: 6, borderRadius: 3 },
  systemBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 10,
  },
  statBlock: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 10, color: C.TEXT_MUTED, marginTop: 2, letterSpacing: 0.3 },
  statDivider: { width: 1, height: 32, backgroundColor: C.BORDER },

  nearestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  nearestLabel: { fontSize: 11, color: C.TEXT_MUTED, fontWeight: '600', letterSpacing: 0.5 },
  nearestRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nearestName: { fontSize: 12, color: C.TEXT_DIM, maxWidth: 160 },
  nearestDist: { fontSize: 12, fontWeight: '700', color: C.SUCCESS },

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
