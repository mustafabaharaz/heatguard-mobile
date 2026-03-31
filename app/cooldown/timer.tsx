// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Cool-down Timer
// A focused, single-purpose screen for timing heat recovery sessions.
// Designed to be usable with impaired cognition and shaking hands at 110°F.
// Large touch targets, high-contrast UI, minimal interaction required.
//
// Presets are derived from current temperature — hotter = longer cooldown.
// A pulsing ring tracks progress. Completion triggers haptics + a summary.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// ── Design tokens (inline, matching project pattern) ─────────────────────────

const COLORS = {
  background: '#F8F9FA',
  surface:    '#FFFFFF',
  text:       '#1D3557',
  textSec:    '#6B7280',
  textTer:    '#9CA3AF',
  border:     '#E5E7EB',
  ocean:      '#1D3557',
  safe:       '#2D9B6F',
  caution:    '#F4A261',
  highAlert:  '#E76F51',
  extreme:    '#DC2626',
  crisis:     '#7C2D12',
  cool:       '#3B82F6',   // Blue — the "cooling" colour
  coolLight:  '#EFF6FF',
};

// ── Types ─────────────────────────────────────────────────────────────────────

type TimerState = 'idle' | 'running' | 'paused' | 'complete';

interface Preset {
  label: string;
  seconds: number;
  icon: string;
  description: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getThermalColor(tempC: number): string {
  if (tempC >= 40) return COLORS.crisis;
  if (tempC >= 35) return COLORS.extreme;
  if (tempC >= 30) return COLORS.highAlert;
  if (tempC >= 25) return COLORS.caution;
  return COLORS.safe;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getPresets(tempC: number): Preset[] {
  // Cooldown needs increase with heat intensity
  if (tempC >= 40) {
    return [
      { label: 'Emergency',  seconds: 20 * 60, icon: 'snow',          description: 'Immediate cooling required' },
      { label: 'Extended',   seconds: 30 * 60, icon: 'water',         description: 'Full recovery session' },
      { label: 'Medical',    seconds: 45 * 60, icon: 'medkit',        description: 'Post heat-stress recovery' },
    ];
  }
  if (tempC >= 35) {
    return [
      { label: 'Quick',      seconds: 10 * 60, icon: 'partly-sunny',  description: 'Short break in cool air' },
      { label: 'Standard',   seconds: 20 * 60, icon: 'snow',          description: 'Full cool-down session' },
      { label: 'Extended',   seconds: 30 * 60, icon: 'water',         description: 'Deep recovery' },
    ];
  }
  if (tempC >= 30) {
    return [
      { label: 'Quick',      seconds:  5 * 60, icon: 'partly-sunny',  description: 'Brief shade break' },
      { label: 'Standard',   seconds: 10 * 60, icon: 'snow',          description: 'Cool-down session' },
      { label: 'Extended',   seconds: 20 * 60, icon: 'water',         description: 'Full recovery' },
    ];
  }
  return [
    { label: 'Quick',        seconds:  5 * 60, icon: 'partly-sunny',  description: 'Short rest' },
    { label: 'Standard',     seconds: 10 * 60, icon: 'snow',          description: 'Cool-down break' },
    { label: 'Extended',     seconds: 15 * 60, icon: 'water',         description: 'Recovery session' },
  ];
}

function getCooldownTips(tempC: number): string[] {
  const base = [
    'Sit or lie down — standing keeps blood in your legs',
    'Drink cool (not ice-cold) water slowly — 150–200ml every 15 min',
    'Apply cool wet cloth to neck, wrists, and forehead',
    'Loosen or remove excess clothing',
  ];
  if (tempC >= 35) {
    return [
      'Move to air-conditioned space if possible',
      ...base,
      'Do not return outdoors until you feel fully recovered + 10 min',
    ];
  }
  return base;
}

// ── Animated ring ─────────────────────────────────────────────────────────────

function TimerRing({
  progress,
  timerState,
  tempC,
}: {
  progress: number;       // 0 → 1
  timerState: TimerState;
  tempC: number;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (timerState === 'running') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.025, duration: 2000, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0,   duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [timerState]);

  const ringColor = timerState === 'complete' ? COLORS.safe : COLORS.cool;
  const bgColor   = timerState === 'complete' ? COLORS.safe + '18' : COLORS.coolLight;
  const fillPct   = `${Math.round(progress * 100)}%`;

  return (
    <Animated.View style={[styles.ringWrap, { transform: [{ scale: pulse }] }]}>
      <View style={[styles.ringOuter, { borderColor: ringColor + '30', backgroundColor: bgColor }]}>
        <View style={[styles.ringInner, { borderColor: ringColor }]}>
          {timerState === 'complete' ? (
            <>
              <Ionicons name="checkmark-circle" size={48} color={COLORS.safe} />
              <Text style={[styles.ringComplete, { color: COLORS.safe }]}>Done!</Text>
            </>
          ) : (
            <>
              <Ionicons name="snow-outline" size={24} color={ringColor} style={{ marginBottom: 4 }} />
              <Text style={[styles.ringTime, { color: ringColor }]}>
                {timerState === 'idle' ? '--:--' : formatTime(0)}
              </Text>
              <Text style={[styles.ringSub, { color: ringColor }]}>
                {timerState === 'idle' ? 'select preset' : 'cooling down'}
              </Text>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

interface Props {
  // tempC passed via route params or defaults to 38 (demo mode)
}

export default function CooldownTimerScreen() {
  const router = useRouter();

  // In production, receive tempC from route params or global store
  // For now default to 38°C (high alert) as a realistic demo value
  const [tempC] = useState(38);

  const presets = getPresets(tempC);
  const tips    = getCooldownTips(tempC);

  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [timerState, setTimerState]         = useState<TimerState>('idle');
  const [remainingSeconds, setRemaining]    = useState(0);
  const [totalSeconds, setTotal]            = useState(0);
  const [elapsedOnPause, setElapsedOnPause] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = totalSeconds > 0
    ? 1 - remainingSeconds / totalSeconds
    : 0;

  // ── Timer logic ────────────────────────────────────────────────────────────

  const startTimer = useCallback((preset: Preset) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSelectedPreset(preset);
    setTotal(preset.seconds);
    setRemaining(preset.seconds);
    setTimerState('running');

    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setTimerState('complete');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimerState('paused');
  }, []);

  const resumeTimer = useCallback(() => {
    setTimerState('running');
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setTimerState('complete');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const resetTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimerState('idle');
    setRemaining(0);
    setTotal(0);
    setSelectedPreset(null);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const thermalColor = getThermalColor(tempC);
  const isActive     = timerState === 'running' || timerState === 'paused';
  const isComplete   = timerState === 'complete';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Cool-down Timer</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Heat level banner */}
        <View style={[styles.heatBanner, { backgroundColor: thermalColor + '15', borderColor: thermalColor + '40' }]}>
          <Ionicons name="thermometer" size={16} color={thermalColor} />
          <Text style={[styles.heatBannerText, { color: thermalColor }]}>
            {tempC}°C · {tempC >= 40 ? 'Crisis' : tempC >= 35 ? 'Extreme heat' : tempC >= 30 ? 'High alert' : 'Caution'} — cool down now
          </Text>
        </View>

        {/* Timer ring */}
        <View style={styles.ringSection}>
          <View style={styles.ringWrap}>
            <View style={[
              styles.ringOuter,
              {
                borderColor: (isComplete ? COLORS.safe : COLORS.cool) + '30',
                backgroundColor: isComplete ? COLORS.safe + '12' : COLORS.coolLight,
              },
            ]}>
              <View style={[
                styles.ringInner,
                { borderColor: isComplete ? COLORS.safe : COLORS.cool },
              ]}>
                {isComplete ? (
                  <>
                    <Ionicons name="checkmark-circle" size={44} color={COLORS.safe} />
                    <Text style={[styles.ringCompleteText, { color: COLORS.safe }]}>Done!</Text>
                    <Text style={[styles.ringSub, { color: COLORS.safe }]}>Cool-down complete</Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="snow-outline"
                      size={24}
                      color={isActive ? COLORS.cool : COLORS.textTer}
                      style={{ marginBottom: 6 }}
                    />
                    <Text style={[
                      styles.ringTime,
                      { color: isActive ? COLORS.cool : COLORS.textTer },
                    ]}>
                      {isActive || timerState === 'paused'
                        ? formatTime(remainingSeconds)
                        : '--:--'}
                    </Text>
                    <Text style={[
                      styles.ringSub,
                      { color: isActive ? COLORS.cool : COLORS.textTer },
                    ]}>
                      {timerState === 'running' ? 'cooling down'
                        : timerState === 'paused' ? 'paused'
                        : 'select a preset below'}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Progress bar under ring */}
          {isActive && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
            </View>
          )}

          {/* Selected preset label */}
          {selectedPreset && !isComplete && (
            <Text style={styles.presetActiveLabel}>
              {selectedPreset.label} · {Math.round(selectedPreset.seconds / 60)} min session
            </Text>
          )}
        </View>

        {/* Controls */}
        {isActive && (
          <View style={styles.controls}>
            <Pressable
              onPress={timerState === 'running' ? pauseTimer : resumeTimer}
              style={[styles.controlBtn, styles.controlBtnPrimary]}
              accessibilityRole="button"
              accessibilityLabel={timerState === 'running' ? 'Pause timer' : 'Resume timer'}
            >
              <Ionicons
                name={timerState === 'running' ? 'pause' : 'play'}
                size={28}
                color="#fff"
              />
              <Text style={styles.controlBtnText}>
                {timerState === 'running' ? 'Pause' : 'Resume'}
              </Text>
            </Pressable>

            <Pressable
              onPress={resetTimer}
              style={[styles.controlBtn, styles.controlBtnSecondary]}
              accessibilityRole="button"
              accessibilityLabel="Reset timer"
            >
              <Ionicons name="refresh" size={24} color={COLORS.textSec} />
              <Text style={styles.controlBtnSecText}>Reset</Text>
            </Pressable>
          </View>
        )}

        {isComplete && (
          <View style={styles.controls}>
            <Pressable
              onPress={resetTimer}
              style={[styles.controlBtn, styles.controlBtnSafe]}
              accessibilityRole="button"
              accessibilityLabel="Start a new timer"
            >
              <Ionicons name="refresh" size={24} color="#fff" />
              <Text style={styles.controlBtnText}>New timer</Text>
            </Pressable>
          </View>
        )}

        {/* Preset selector (hidden while timer is running) */}
        {!isActive && !isComplete && (
          <View style={styles.presetsSection}>
            <Text style={styles.presetsTitle}>Choose a session</Text>
            <View style={styles.presets}>
              {presets.map((preset) => {
                const isSelected = selectedPreset?.label === preset.label;
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => startTimer(preset)}
                    style={[
                      styles.presetCard,
                      isSelected && styles.presetCardSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Start ${preset.label} ${Math.round(preset.seconds / 60)} minute cool-down`}
                  >
                    <Ionicons
                      name={preset.icon as any}
                      size={22}
                      color={isSelected ? COLORS.cool : COLORS.textSec}
                    />
                    <Text style={[
                      styles.presetLabel,
                      isSelected && { color: COLORS.cool },
                    ]}>
                      {preset.label}
                    </Text>
                    <Text style={[
                      styles.presetDuration,
                      isSelected && { color: COLORS.cool },
                    ]}>
                      {Math.round(preset.seconds / 60)} min
                    </Text>
                    <Text style={styles.presetDesc}>{preset.description}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Cool-down tips */}
        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb-outline" size={16} color={COLORS.cool} />
            <Text style={styles.tipsTitle}>While cooling down</Text>
          </View>
          {tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* When to seek help */}
        <View style={[styles.emergencyNote, { borderColor: COLORS.extreme + '40' }]}>
          <Ionicons name="warning-outline" size={16} color={COLORS.extreme} />
          <Text style={styles.emergencyNoteText}>
            Seek emergency help if you experience confusion, stop sweating,
            have a rapid pulse, or feel faint — these are heat stroke signs.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.background },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  backBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 17, fontWeight: '600', color: COLORS.text },
  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 48 },

  heatBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 0.5 },
  heatBannerText:{ fontSize: 14, fontWeight: '500', flex: 1 },

  // Ring
  ringSection:   { alignItems: 'center', gap: 12 },
  ringWrap:      { alignItems: 'center' },
  ringOuter:     { width: 200, height: 200, borderRadius: 100, borderWidth: 16, alignItems: 'center', justifyContent: 'center' },
  ringInner:     { width: 168, height: 168, borderRadius: 84, borderWidth: 3, alignItems: 'center', justifyContent: 'center', gap: 2 },
  ringTime:      { fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  ringCompleteText: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  ringSub:       { fontSize: 12, fontWeight: '500' },
  progressTrack: { width: 200, height: 6, borderRadius: 3, backgroundColor: COLORS.border, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3, backgroundColor: COLORS.cool },
  presetActiveLabel: { fontSize: 13, color: COLORS.textSec, textAlign: 'center' },

  // Controls — large touch targets for impaired users
  controls:           { flexDirection: 'row', gap: 12 },
  controlBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 16, minHeight: 64 },
  controlBtnPrimary:  { backgroundColor: COLORS.cool },
  controlBtnSecondary:{ backgroundColor: COLORS.surface, borderWidth: 0.5, borderColor: COLORS.border },
  controlBtnSafe:     { backgroundColor: COLORS.safe },
  controlBtnText:     { fontSize: 17, fontWeight: '700', color: '#fff' },
  controlBtnSecText:  { fontSize: 17, fontWeight: '600', color: COLORS.textSec },

  // Presets
  presetsSection: { gap: 10 },
  presetsTitle:   { fontSize: 15, fontWeight: '600', color: COLORS.text },
  presets:        { flexDirection: 'row', gap: 10 },
  presetCard:     { flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4, borderWidth: 0.5, borderColor: COLORS.border, minHeight: 110 },
  presetCardSelected: { borderColor: COLORS.cool, borderWidth: 1.5, backgroundColor: COLORS.coolLight },
  presetLabel:    { fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 4 },
  presetDuration: { fontSize: 20, fontWeight: '800', color: COLORS.textSec },
  presetDesc:     { fontSize: 11, color: COLORS.textTer, textAlign: 'center', lineHeight: 15 },

  // Tips
  tipsCard:    { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, gap: 10, borderWidth: 0.5, borderColor: COLORS.border },
  tipsHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipsTitle:   { fontSize: 14, fontWeight: '600', color: COLORS.text },
  tipRow:      { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.cool, marginTop: 7 },
  tipText:     { flex: 1, fontSize: 13, color: COLORS.textSec, lineHeight: 20 },

  // Emergency note
  emergencyNote:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1 },
  emergencyNoteText: { flex: 1, fontSize: 13, color: COLORS.textSec, lineHeight: 20 },
});
