/**
 * app/exposure/tracker.tsx
 *
 * Passive Exposure Tracker screen.
 * Shows live session stats and the dead man's switch escalation UI.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PassiveTracker, type ExposureState } from '../../src/features/exposure/passiveTracker';
import {
  DeadManSwitch,
  type DmsState,
  type EscalationStep,
  formatCountdown,
  escalationStepLabel,
} from '../../src/features/exposure/deadManSwitch';

// ── Inline design tokens (matches project pattern) ────────────────────────

const COLORS = {
  background: '#F8F9FA',
  surface:    '#FFFFFF',
  text:       '#1D3557',
  textSec:    '#6B7280',
  textTer:    '#9CA3AF',
  border:     '#E5E7EB',
  safe:       '#2D9B6F',
  caution:    '#F4A261',
  highAlert:  '#E76F51',
  extreme:    '#DC2626',
  crisis:     '#7C2D12',
};

function getThermalColor(thermalLevel: string): string {
  switch (thermalLevel) {
    case 'crisis':    return COLORS.crisis;
    case 'extreme':   return COLORS.extreme;
    case 'highAlert': return COLORS.highAlert;
    case 'caution':   return COLORS.caution;
    default:          return COLORS.safe;
  }
}

// ── Countdown ring ────────────────────────────────────────────────────────

function CountdownRing({
  seconds,
  totalSeconds,
  step,
}: {
  seconds: number;
  totalSeconds: number;
  step: EscalationStep;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0,  duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const ringColor =
    step === 'checkin'       ? COLORS.caution :
    step === 'alertContacts' ? COLORS.extreme  :
                               COLORS.crisis;

  return (
    <Animated.View style={[styles.ringWrap, { transform: [{ scale: pulse }] }]}>
      <View style={[styles.ringOuter, { borderColor: ringColor + '35' }]}>
        <View style={[styles.ringInner, { borderColor: ringColor }]}>
          <Text style={[styles.ringTime, { color: ringColor }]}>
            {formatCountdown(seconds)}
          </Text>
          <Text style={[styles.ringLabel, { color: ringColor }]}>remaining</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Exposure bar ──────────────────────────────────────────────────────────

function ExposureBar({ percent, thermalLevel }: { percent: number; thermalLevel: string }) {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(width, {
      toValue: Math.min(percent, 100),
      useNativeDriver: false,
      speed: 6,
      bounciness: 0,
    }).start();
  }, [percent]);

  const barColor =
    percent >= 90 ? COLORS.crisis    :
    percent >= 70 ? COLORS.extreme   :
    percent >= 50 ? COLORS.highAlert :
    getThermalColor(thermalLevel);

  return (
    <View style={styles.barTrack}>
      <Animated.View
        style={[
          styles.barFill,
          {
            width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            backgroundColor: barColor,
          },
        ]}
      />
    </View>
  );
}

// ── Escalation card ───────────────────────────────────────────────────────

function EscalationCard({
  step,
  seconds,
  onImOK,
  onCall911,
}: {
  step: EscalationStep;
  seconds: number;
  onImOK: () => void;
  onCall911: () => void;
}) {
  if (step === 'idle' || step === 'resolved') return null;

  const isCheckin  = step === 'checkin';
  const isAlerting = step === 'alertContacts';
  const isCalling  = step === 'call911';

  const cardColor =
    isCheckin  ? COLORS.caution :
    isAlerting ? COLORS.extreme  :
                 COLORS.crisis;

  const totalSeconds = isCheckin ? 60 : 300;
  const allSteps: EscalationStep[] = ['checkin', 'alertContacts', 'call911'];
  const currentIdx = allSteps.indexOf(step);

  return (
    <View style={[styles.escalationCard, { borderColor: cardColor }]}>

      <View style={[styles.escalationHeader, { backgroundColor: cardColor + '18' }]}>
        <Ionicons
          name={isCheckin ? 'alert-circle' : isAlerting ? 'people' : 'call'}
          size={20}
          color={cardColor}
        />
        <Text style={[styles.escalationTitle, { color: cardColor }]}>
          {escalationStepLabel(step)}
        </Text>
      </View>

      {(isCheckin || isAlerting) && (
        <CountdownRing seconds={seconds} totalSeconds={totalSeconds} step={step} />
      )}

      <Text style={styles.escalationBody}>
        {isCheckin
          ? 'You have been in the heat beyond your safe limit. Confirm you are okay, or your emergency contacts will be alerted.'
          : isAlerting
          ? 'Your emergency contacts have been notified and your location has been shared. If no one confirms you are safe within 5 minutes, 911 will be called.'
          : 'Unable to reach your emergency contacts. Calling 911 now — hold your phone close.'}
      </Text>

      <View style={styles.escalationActions}>
        {!isCalling && (
          <View
            style={[styles.okButton, { backgroundColor: cardColor }]}
            accessible
            accessibilityRole="button"
            accessibilityLabel="I am okay"
          >
            <Text style={styles.okButtonText} onPress={onImOK}>I'm OK</Text>
          </View>
        )}
        <View
          style={[styles.call911Button, { borderColor: COLORS.crisis + '60' }]}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Call 911 now"
        >
          <Ionicons name="call" size={16} color={COLORS.crisis} />
          <Text style={[styles.call911Text, { color: COLORS.crisis }]} onPress={onCall911}>
            Call 911
          </Text>
        </View>
      </View>

      <View style={styles.pillsRow}>
        {allSteps.map((s, i) => (
          <View
            key={s}
            style={[styles.pill, { backgroundColor: i <= currentIdx ? cardColor : cardColor + '28' }]}
          />
        ))}
      </View>
      <View style={styles.pillLabels}>
        {['Check-in', 'Alert contacts', 'Call 911'].map((l) => (
          <Text key={l} style={styles.pillLabel}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────

export default function ExposureTrackerScreen() {
  const [exposure, setExposure] = useState<ExposureState>(PassiveTracker.getState());
  const [dms, setDms]           = useState<DmsState>(DeadManSwitch.getState());
  const prevPercent = useRef(0);

  useEffect(() => {
    const unsubE = PassiveTracker.subscribe((state) => {
      setExposure(state);
      if (state.percentUsed >= 100 && prevPercent.current < 100) {
        DeadManSwitch.activate();
      }
      prevPercent.current = state.percentUsed;
    });
    const unsubD = DeadManSwitch.subscribe(setDms);
    return () => { unsubE(); unsubD(); };
  }, []);

  const handleImOK    = useCallback(() => DeadManSwitch.userConfirmedOK(), []);
  const handleCall911 = useCallback(() => DeadManSwitch.manualCall911(), []);
  const handleEnd     = useCallback(() => {
    DeadManSwitch.reset();
    PassiveTracker.stopSession();
    router.back();
  }, []);

  const thermalColor = getThermalColor(exposure.thermalLevel);
  const dmsActive    = dms.step !== 'idle' && dms.step !== 'resolved';

  const sessionMins  = exposure.sessionMinutes;
  const durationText = sessionMins >= 60
    ? `${Math.floor(sessionMins / 60)}h ${sessionMins % 60}m`
    : `${sessionMins}m`;

  const thermalLabel =
    exposure.thermalLevel === 'highAlert' ? 'High alert' :
    exposure.thermalLevel.charAt(0).toUpperCase() + exposure.thermalLevel.slice(1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      <View style={styles.header}>
        <View style={styles.backBtn} accessible accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={COLORS.text} onPress={() => router.back()} />
        </View>
        <Text style={styles.headerTitle}>Exposure Tracker</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: thermalColor + '18', borderColor: thermalColor + '40' }]}>
          <View style={[styles.statusDot, { backgroundColor: thermalColor }]} />
          <Text style={[styles.statusText, { color: thermalColor }]}>
            {exposure.isTracking ? 'Session active' : 'Not tracking'}
          </Text>
          <Text style={styles.statusTemp}>
            {exposure.currentTempF > 0 ? `${Math.round(exposure.currentTempF)}°F` : '—'}
          </Text>
        </View>

        {/* Meter card */}
        <View style={styles.meterCard}>
          <View style={styles.meterHeader}>
            <Text style={styles.meterTitle}>Heat exposure</Text>
            <Text style={[styles.meterPct, {
              color: exposure.percentUsed >= 90 ? COLORS.crisis
                   : exposure.percentUsed >= 70 ? COLORS.extreme
                   : COLORS.text,
            }]}>
              {Math.round(exposure.percentUsed)}%
            </Text>
          </View>

          <ExposureBar percent={exposure.percentUsed} thermalLevel={exposure.thermalLevel} />

          <View style={styles.meterFooter}>
            <Text style={styles.meterSub}>
              {Math.round(exposure.weightedMinutes)} of {exposure.safeLimit} weighted min
            </Text>
            <Text style={styles.meterSub}>
              {exposure.safeLimit - Math.round(exposure.weightedMinutes) > 0
                ? `${exposure.safeLimit - Math.round(exposure.weightedMinutes)} min remaining`
                : 'Limit reached'}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{durationText}</Text>
              <Text style={styles.statLabel}>Session time</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{Math.round(exposure.weightedMinutes)}</Text>
              <Text style={styles.statLabel}>Weighted min</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={[styles.statValue, { color: thermalColor }]}>{thermalLabel}</Text>
              <Text style={styles.statLabel}>Heat level</Text>
            </View>
          </View>
        </View>

        {/* DMS escalation */}
        {dmsActive && (
          <EscalationCard
            step={dms.step}
            seconds={dms.countdownSeconds}
            onImOK={handleImOK}
            onCall911={handleCall911}
          />
        )}

        {/* Info card */}
        {!dmsActive && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How weighted exposure works</Text>
            <Text style={styles.infoBody}>
              Not all time in the heat is equal. One minute at 105°F counts nearly
              3× more than one minute at 80°F. Your personal risk factors lower your
              safe limit so you get warned before your body does.
            </Text>
            <View style={styles.infoRow}>
              <Ionicons name="thermometer-outline" size={14} color={COLORS.textSec} />
              <Text style={styles.infoRowText}>Your safe limit today: {exposure.safeLimit} weighted minutes</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.textSec} />
              <Text style={styles.infoRowText}>Dead man's switch activates at 100%</Text>
            </View>
          </View>
        )}

        {/* End session */}
        <View style={styles.endBtn} accessible accessibilityRole="button" accessibilityLabel="End session">
          <Ionicons name="stop-circle-outline" size={18} color={COLORS.textSec} />
          <Text style={styles.endBtnText} onPress={handleEnd}>End session</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: COLORS.background },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  backBtn:           { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:       { fontSize: 17, fontWeight: '600', color: COLORS.text },
  scroll:            { flex: 1 },
  scrollContent:     { padding: 16, gap: 12, paddingBottom: 40 },
  statusBanner:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 0.5 },
  statusDot:         { width: 8, height: 8, borderRadius: 4 },
  statusText:        { fontSize: 15, fontWeight: '500', flex: 1 },
  statusTemp:        { fontSize: 15, color: COLORS.textSec },
  meterCard:         { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: COLORS.border, gap: 12 },
  meterHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterTitle:        { fontSize: 15, fontWeight: '600', color: COLORS.text },
  meterPct:          { fontSize: 22, fontWeight: '700' },
  barTrack:          { height: 10, borderRadius: 5, backgroundColor: COLORS.border, overflow: 'hidden' },
  barFill:           { height: '100%', borderRadius: 5 },
  meterFooter:       { flexDirection: 'row', justifyContent: 'space-between' },
  meterSub:          { fontSize: 12, color: COLORS.textSec },
  statsRow:          { flexDirection: 'row', paddingTop: 12, borderTopWidth: 0.5, borderTopColor: COLORS.border },
  statBlock:         { flex: 1, alignItems: 'center', gap: 2 },
  statDivider:       { width: 0.5, backgroundColor: COLORS.border },
  statValue:         { fontSize: 15, fontWeight: '600', color: COLORS.text },
  statLabel:         { fontSize: 11, color: COLORS.textSec, textAlign: 'center' },
  escalationCard:    { borderRadius: 16, borderWidth: 1.5, backgroundColor: COLORS.surface, overflow: 'hidden' },
  escalationHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  escalationTitle:   { fontSize: 15, fontWeight: '600' },
  ringWrap:          { alignItems: 'center', paddingVertical: 16 },
  ringOuter:         { width: 140, height: 140, borderRadius: 70, borderWidth: 12, alignItems: 'center', justifyContent: 'center' },
  ringInner:         { width: 116, height: 116, borderRadius: 58, borderWidth: 3, alignItems: 'center', justifyContent: 'center', gap: 2 },
  ringTime:          { fontSize: 28, fontWeight: '700' },
  ringLabel:         { fontSize: 11, fontWeight: '500' },
  escalationBody:    { fontSize: 14, color: COLORS.textSec, paddingHorizontal: 20, paddingBottom: 16, lineHeight: 22 },
  escalationActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  okButton:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  okButtonText:      { fontSize: 15, fontWeight: '600', color: '#fff' },
  call911Button:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  call911Text:       { fontSize: 15, fontWeight: '600' },
  pillsRow:          { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 6 },
  pill:              { flex: 1, height: 4, borderRadius: 2 },
  pillLabels:        { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 16 },
  pillLabel:         { fontSize: 10, color: COLORS.textTer, flex: 1, textAlign: 'center' },
  infoCard:          { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: COLORS.border, gap: 8 },
  infoTitle:         { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  infoBody:          { fontSize: 13, color: COLORS.textSec, lineHeight: 20 },
  infoRow:           { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  infoRowText:       { fontSize: 12, color: COLORS.textSec },
  endBtn:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border, marginTop: 4 },
  endBtnText:        { fontSize: 15, color: COLORS.textSec },
});
