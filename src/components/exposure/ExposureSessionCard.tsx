/**
 * src/components/exposure/ExposureSessionCard.tsx
 *
 * Home screen card for passive exposure tracking.
 * Three states: idle / active / DMS alert.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PassiveTracker, type ExposureState } from '../../features/exposure/passiveTracker';
import { DeadManSwitch, type DmsState, formatCountdown } from '../../features/exposure/deadManSwitch';

// Matches the project's inline COLORS pattern
const C = {
  surface:   '#FFFFFF',
  text:      '#1D3557',
  textSec:   '#6B7280',
  border:    '#E5E7EB',
  primary:   '#1D3557',
  safe:      '#2D9B6F',
  caution:   '#F4A261',
  highAlert: '#E76F51',
  extreme:   '#DC2626',
  crisis:    '#7C2D12',
};

function getThermalColor(thermalLevel: string): string {
  switch (thermalLevel) {
    case 'crisis':    return C.crisis;
    case 'extreme':   return C.extreme;
    case 'highAlert': return C.highAlert;
    case 'caution':   return C.caution;
    default:          return C.safe;
  }
}

// ── Pulsing dot ────────────────────────────────────────────────────────────

function PulsingDot({ color }: { color: string }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale,   { toValue: 1.5, duration: 800, useNativeDriver: true }),
          Animated.timing(scale,   { toValue: 1.0, duration: 800, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.2, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[s.dot, { backgroundColor: color, transform: [{ scale }], opacity }]} />
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  currentTempF: number;
}

export default function ExposureSessionCard({ currentTempF }: Props) {
  const [exposure, setExposure] = useState<ExposureState>(PassiveTracker.getState());
  const [dms, setDms]           = useState<DmsState>(DeadManSwitch.getState());

  useEffect(() => {
    const unsubE = PassiveTracker.subscribe(setExposure);
    const unsubD = DeadManSwitch.subscribe(setDms);
    return () => { unsubE(); unsubD(); };
  }, []);

  const dmsActive = dms.step !== 'idle' && dms.step !== 'resolved';

  const handleStart = async () => {
    await PassiveTracker.startSession(currentTempF);
    router.push('/exposure/tracker');
  };

  const handleView = () => router.push('/exposure/tracker');

  // ── DMS alert ─────────────────────────────────────────────────────────────

  if (dmsActive) {
    const alertColor = dms.step === 'call911' ? C.crisis : C.extreme;
    return (
      <Pressable onPress={handleView} accessibilityLabel="View safety alert" accessibilityRole="button">
        <View style={[s.card, { borderColor: alertColor, borderWidth: 1.5 }]}>
          <View style={s.row}>
            <PulsingDot color={alertColor} />
            <Text style={[s.alertTitle, { color: alertColor }]}>Safety check required</Text>
            <Ionicons name="chevron-forward" size={16} color={alertColor} />
          </View>
          <Text style={s.alertSub}>
            {dms.step === 'checkin'
              ? `Respond within ${formatCountdown(dms.countdownSeconds)} — contacts will be alerted if you don't`
              : dms.step === 'alertContacts'
              ? `Contacts alerted · 911 in ${formatCountdown(dms.countdownSeconds)}`
              : 'Calling 911 — open app to cancel'}
          </Text>
        </View>
      </Pressable>
    );
  }

  // ── Active session ─────────────────────────────────────────────────────────

  if (exposure.isTracking) {
    const mins         = exposure.sessionMinutes;
    const durationText = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    const barColor     =
      exposure.percentUsed >= 90 ? C.crisis    :
      exposure.percentUsed >= 70 ? C.extreme   :
                                   C.highAlert;

    return (
      <Pressable onPress={handleView} accessibilityLabel="View exposure tracker" accessibilityRole="button">
        <View style={s.card}>
          <View style={s.row}>
            <PulsingDot color={C.safe} />
            <Text style={s.cardTitle}>Tracking active</Text>
            <Text style={[s.pctLabel, { color: exposure.percentUsed >= 70 ? barColor : C.textSec }]}>
              {Math.round(exposure.percentUsed)}%
            </Text>
          </View>

          <View style={s.miniTrack}>
            <View style={[s.miniFill, {
              width: `${Math.min(100, exposure.percentUsed)}%` as any,
              backgroundColor: barColor,
            }]} />
          </View>

          <View style={s.row}>
            <Text style={s.subLabel}>{durationText} in the heat</Text>
            <Text style={s.subLabel}>
              {exposure.safeLimit - Math.round(exposure.weightedMinutes) > 0
                ? `${exposure.safeLimit - Math.round(exposure.weightedMinutes)} min left`
                : 'Limit reached'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  // ── Idle ───────────────────────────────────────────────────────────────────

  return (
    <Pressable onPress={handleStart} accessibilityLabel="Start exposure tracking" accessibilityRole="button">
      <View style={s.card}>
        <View style={s.row}>
          <Ionicons name="timer-outline" size={18} color={C.textSec} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.cardTitle}>Exposure tracker</Text>
            <Text style={s.cardSub}>
              Tracks time + heat with a dead man's switch if you go unresponsive
            </Text>
          </View>
          <View style={s.startPill}>
            <Text style={s.startPillText}>Start</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card:          { backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: C.border, gap: 8 },
  row:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:           { width: 8, height: 8, borderRadius: 4 },
  cardTitle:     { fontSize: 15, fontWeight: '600', color: C.text, flex: 1 },
  cardSub:       { fontSize: 12, color: C.textSec, lineHeight: 17 },
  pctLabel:      { fontSize: 15, fontWeight: '600' },
  subLabel:      { fontSize: 12, color: C.textSec, flex: 1 },
  miniTrack:     { height: 6, borderRadius: 3, backgroundColor: C.border, overflow: 'hidden' },
  miniFill:      { height: '100%', borderRadius: 3 },
  startPill:     { backgroundColor: C.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  startPillText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  alertTitle:    { fontSize: 15, fontWeight: '600', flex: 1 },
  alertSub:      { fontSize: 13, color: C.textSec, lineHeight: 18 },
});
