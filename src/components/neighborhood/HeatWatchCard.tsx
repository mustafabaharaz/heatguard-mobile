// ─────────────────────────────────────────────
// HeatWatchCard
// Home screen hub card for Neighborhood Heat Watch
// ─────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  computeNeighborhoodSnapshot,
  getThermalConfig,
  type BlockReading,
  type ThermalLevel,
} from '../../features/neighborhood/neighborhoodEngine';
import { loadSnapshot, saveSnapshot } from '../../features/neighborhood/neighborhoodStorage';

const C = {
  CARD: '#1E293B',
  BORDER: '#334155',
  TEXT: '#F1F5F9',
  TEXT_DIM: '#94A3B8',
  TEXT_MUTED: '#64748B',
  ACCENT: '#3B82F6',
} as const;

interface MiniBlockBadge {
  name: string;
  heatIndex: number;
  level: ThermalLevel;
}

export function HeatWatchCard() {
  const router = useRouter();
  const [userBlock, setUserBlock] = useState<BlockReading | null>(null);
  const [hotBlocks, setHotBlocks] = useState<MiniBlockBadge[]>([]);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    (async () => {
      let snapshot = await loadSnapshot();
      if (!snapshot) {
        snapshot = computeNeighborhoodSnapshot(108, 20, 9);
        await saveSnapshot(snapshot);
      }
      const ub = snapshot.blocks.find((b) => b.block.isUserBlock);
      setUserBlock(ub ?? null);
      setAlertCount(snapshot.alerts.length);
      // Top 2 hottest non-user blocks
      const tops = snapshot.blocks
        .filter((b) => !b.block.isUserBlock)
        .slice(0, 2)
        .map((b) => ({
          name: b.block.name,
          heatIndex: b.heatIndex,
          level: b.thermalLevel,
        }));
      setHotBlocks(tops);
    })();
  }, []);

  const cfg = userBlock ? getThermalConfig(userBlock.thermalLevel) : null;

  return (
    <View style={[styles.card, cfg ? { borderColor: cfg.color + '33' } : undefined]}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.cardIcon}>📍</Text>
          <Text style={styles.cardTitle}>Neighborhood Heat Watch</Text>
        </View>
        {alertCount > 0 && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{alertCount} alert{alertCount > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {/* Your block summary */}
      {userBlock && cfg && (
        <View style={[styles.blockSummary, { backgroundColor: cfg.background }]}>
          <View style={styles.blockSummaryLeft}>
            <Text style={styles.blockSummaryLabel}>Your Block</Text>
            <Text style={[styles.blockSummaryTemp, { color: cfg.color }]}>
              {userBlock.heatIndex}°F
            </Text>
            <Text style={styles.blockSummaryDistrict}>{userBlock.block.district}</Text>
          </View>
          <View style={[styles.levelPill, { backgroundColor: cfg.color + '22' }]}>
            <Text style={[styles.levelPillText, { color: cfg.color }]}>
              {cfg.label}
            </Text>
          </View>
        </View>
      )}

      {/* Hottest blocks mini list */}
      {hotBlocks.length > 0 && (
        <View style={styles.miniList}>
          <Text style={styles.miniListLabel}>Hottest nearby</Text>
          <View style={styles.miniListRow}>
            {hotBlocks.map((b) => {
              const bcfg = getThermalConfig(b.level);
              return (
                <View key={b.name} style={[styles.miniBlock, { borderColor: bcfg.color + '44' }]}>
                  <Text style={styles.miniBlockName} numberOfLines={1}>{b.name}</Text>
                  <Text style={[styles.miniBlockTemp, { color: bcfg.color }]}>{b.heatIndex}°</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity
        style={styles.cta}
        onPress={() => router.push('/neighborhood')}
        activeOpacity={0.75}
      >
        <Text style={styles.ctaText}>View All Neighborhoods</Text>
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
    borderColor: C.BORDER,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardIcon: {
    fontSize: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.TEXT,
    letterSpacing: 0.2,
  },
  alertBadge: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.3,
  },

  blockSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  blockSummaryLeft: {
    gap: 1,
  },
  blockSummaryLabel: {
    fontSize: 10,
    color: C.TEXT_MUTED,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  blockSummaryTemp: {
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  blockSummaryDistrict: {
    fontSize: 11,
    color: C.TEXT_DIM,
  },
  levelPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  levelPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  miniList: {
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 6,
  },
  miniListLabel: {
    fontSize: 10,
    color: C.TEXT_MUTED,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  miniListRow: {
    flexDirection: 'row',
    gap: 8,
  },
  miniBlock: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  miniBlockName: {
    fontSize: 11,
    color: C.TEXT_DIM,
    marginBottom: 2,
  },
  miniBlockTemp: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.ACCENT,
  },
  ctaArrow: {
    fontSize: 16,
    color: C.ACCENT,
  },
});
