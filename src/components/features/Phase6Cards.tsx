// ─── AcclimationCard ──────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { getPhaseColor, getPhaseLabel, type AcclimationPhase } from '../../features/acclimation/acclimationEngine';
import type { AcclimationState } from '../../features/acclimation/acclimationStorage';

const COLORS = {
  surface: '#1A2942',
  surfaceHigh: '#2D3F5C',
  border: '#2D3F5C',
  text: { primary: '#F8FAFC', secondary: '#94A3B8', tertiary: '#64748B' },
  primary: '#3B82F6',
  success: '#22C55E',
};

interface AcclimationCardProps {
  state: AcclimationState | null;
}

export function AcclimationCard({ state }: AcclimationCardProps) {
  const isActive = state?.isActive ?? false;
  const completedDays = state?.completedDays?.length ?? 0;
  const currentDay = state?.currentDay ?? 1;
  const score = Math.min(Math.round((completedDays / 14) * 100), 100);

  const getCurrentPhase = (day: number): AcclimationPhase => {
    if (day <= 3) return 'introduction';
    if (day <= 7) return 'adaptation';
    if (day <= 11) return 'progressive';
    return 'consolidation';
  };

  const phase = getCurrentPhase(currentDay);
  const phaseColor = getPhaseColor(phase);

  return (
    <TouchableOpacity
      style={styles.acclimCard}
      onPress={() => router.push('/acclimation')}
      activeOpacity={0.8}
    >
      <View style={styles.acclimHeader}>
        <View>
          <Text style={styles.acclimLabel}>HEAT ACCLIMATION</Text>
          {isActive ? (
            <Text style={styles.acclimTitle}>Day {currentDay} of 14</Text>
          ) : completedDays >= 14 ? (
            <Text style={[styles.acclimTitle, { color: COLORS.success }]}>
              Program Complete ✓
            </Text>
          ) : (
            <Text style={styles.acclimTitle}>Not Started</Text>
          )}
        </View>
        <View style={styles.acclimScoreBadge}>
          <Text style={[styles.acclimScore, { color: phaseColor }]}>{score}%</Text>
          <Text style={styles.acclimScoreLabel}>acclimated</Text>
        </View>
      </View>

      {/* Phase bar */}
      <View style={styles.acclimBar}>
        {([
          { phase: 'introduction' as const, days: 3 },
          { phase: 'adaptation' as const, days: 4 },
          { phase: 'progressive' as const, days: 4 },
          { phase: 'consolidation' as const, days: 3 },
        ]).map((seg) => {
          const segDone = Math.min(
            Math.max(completedDays - getPhaseStart(seg.phase) + 1, 0),
            seg.days,
          );
          const pct = segDone / seg.days;
          const c = getPhaseColor(seg.phase);
          return (
            <View key={seg.phase} style={[styles.acclimBarSeg, { flex: seg.days }]}>
              <View style={[styles.acclimBarFill, { width: `${pct * 100}%`, backgroundColor: c }]} />
            </View>
          );
        })}
      </View>

      {isActive && (
        <Text style={[styles.acclimPhaseText, { color: phaseColor }]}>
          {getPhaseLabel(phase)} Phase · Tap to view today's task
        </Text>
      )}

      {!isActive && completedDays < 14 && (
        <Text style={styles.acclimCta}>Start your 14-day acclimation protocol →</Text>
      )}
    </TouchableOpacity>
  );
}

function getPhaseStart(phase: AcclimationPhase): number {
  const starts: Record<AcclimationPhase, number> = {
    introduction: 1,
    adaptation: 4,
    progressive: 8,
    consolidation: 12,
  };
  return starts[phase];
}

// ─── VehicleAlertCard ─────────────────────────────────────────────────────────

import type { VehicleSession } from '../../features/vehicle/vehicleAlertEngine';
import {
  getAlertState,
  estimateInteriorTempF,
} from '../../features/vehicle/vehicleAlertEngine';

interface VehicleAlertCardProps {
  session: VehicleSession | null;
  currentTempF: number;
}

export function VehicleAlertCard({ session, currentTempF }: VehicleAlertCardProps) {
  if (session) {
    const elapsed = Math.floor(
      (Date.now() - new Date(session.startTime).getTime()) / 60_000,
    );
    const alertState = getAlertState(session, elapsed);
    const alertColor = alertState.color;

    return (
      <TouchableOpacity
        style={[styles.vehicleCard, styles.vehicleCardActive, { borderColor: alertColor }]}
        onPress={() => router.push('/vehicle/alert')}
        activeOpacity={0.8}
      >
        <View style={[styles.vehiclePulse, { backgroundColor: `${alertColor}30` }]}>
          <View style={[styles.vehicleDot, { backgroundColor: alertColor }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.vehicleActiveTitle, { color: alertColor }]}>
            {alertState.title}
          </Text>
          <Text style={styles.vehicleActiveSub}>
            {elapsed} min · {alertState.interiorEstimateF}°F interior · Tap to manage
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.vehicleCard}
      onPress={() => router.push('/vehicle/alert')}
      activeOpacity={0.75}
    >
      <Text style={styles.vehicleIcon}>🚗</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.vehicleTitle}>Vehicle Heat Alert</Text>
        <Text style={styles.vehicleSub}>
          {currentTempF}°F outside · Start timer when parking
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Acclimation
  acclimCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  acclimHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  acclimLabel: {
    color: COLORS.text.tertiary,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 3,
  },
  acclimTitle: { color: COLORS.text.primary, fontSize: 16, fontWeight: '700' },
  acclimScoreBadge: { alignItems: 'center' },
  acclimScore: { fontSize: 24, fontWeight: '700' },
  acclimScoreLabel: { color: COLORS.text.tertiary, fontSize: 10 },
  acclimBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    gap: 2,
    backgroundColor: COLORS.surfaceHigh,
  },
  acclimBarSeg: {
    height: '100%',
    backgroundColor: COLORS.surfaceHigh,
    overflow: 'hidden',
  },
  acclimBarFill: { height: '100%' },
  acclimPhaseText: { fontSize: 12 },
  acclimCta: { color: COLORS.primary, fontSize: 12 },

  // Vehicle
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  vehicleCardActive: { borderWidth: 1.5 },
  vehiclePulse: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleDot: { width: 12, height: 12, borderRadius: 6 },
  vehicleIcon: { fontSize: 24 },
  vehicleActiveTitle: { fontSize: 14, fontWeight: '700' },
  vehicleActiveSub: { color: COLORS.text.secondary, fontSize: 12, marginTop: 2 },
  vehicleTitle: { color: COLORS.text.primary, fontSize: 14, fontWeight: '600' },
  vehicleSub: { color: COLORS.text.secondary, fontSize: 12, marginTop: 3 },
  chevron: { color: COLORS.text.tertiary, fontSize: 20 },
});
