import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  generateAcclimationProgram,
  getAcclimationScore,
  getPhaseLabel,
  getPhaseColor,
  getIntensityLabel,
  type DailyAcclimationTask,
  type AcclimationPhase,
} from '../../src/features/acclimation/acclimationEngine';
import {
  getAcclimationState,
  startAcclimationProgram,
  completeAcclimationDay,
  resetAcclimationProgram,
  getStreak,
  type AcclimationState,
} from '../../src/features/acclimation/acclimationStorage';
import { getHeatProfile } from '../../src/features/profile/storage/profileStorage';

const COLORS = {
  background: '#0A1628',
  surface: '#1A2942',
  surfaceElevated: '#243352',
  surfaceHigh: '#2D3F5C',
  text: { primary: '#F8FAFC', secondary: '#94A3B8', tertiary: '#64748B' },
  border: '#2D3F5C',
  borderLight: '#374B6D',
  primary: '#3B82F6',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
};

// ─── Phase Progress Bar ───────────────────────────────────────────────────────

function PhaseBar({ completedDays }: { completedDays: number[] }) {
  const phases: { phase: AcclimationPhase; days: number[]; label: string }[] = [
    { phase: 'introduction', days: [1, 2, 3], label: 'Intro' },
    { phase: 'adaptation', days: [4, 5, 6, 7], label: 'Adapt' },
    { phase: 'progressive', days: [8, 9, 10, 11], label: 'Prog' },
    { phase: 'consolidation', days: [12, 13, 14], label: 'Final' },
  ];

  return (
    <View style={styles.phaseBarContainer}>
      {phases.map((p, i) => {
        const done = p.days.filter((d) => completedDays.includes(d)).length;
        const total = p.days.length;
        const pct = done / total;
        const color = getPhaseColor(p.phase);
        return (
          <View key={p.phase} style={styles.phaseBarItem}>
            <View style={styles.phaseBarTrack}>
              <View
                style={[
                  styles.phaseBarFill,
                  { width: `${pct * 100}%`, backgroundColor: color },
                ]}
              />
            </View>
            <Text style={[styles.phaseBarLabel, { color }]}>{p.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Day Card ─────────────────────────────────────────────────────────────────

function DayCard({
  task,
  isCompleted,
  isCurrent,
  isLocked,
  onPress,
}: {
  task: DailyAcclimationTask;
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked: boolean;
  onPress: () => void;
}) {
  const phaseColor = getPhaseColor(task.phase);
  const borderColor = isCompleted
    ? COLORS.success
    : isCurrent
    ? phaseColor
    : COLORS.border;

  return (
    <TouchableOpacity
      style={[
        styles.dayCard,
        { borderColor },
        isLocked && styles.dayCardLocked,
      ]}
      onPress={onPress}
      activeOpacity={isLocked ? 0.4 : 0.75}
    >
      <View style={styles.dayCardLeft}>
        <View
          style={[
            styles.dayNumber,
            {
              backgroundColor: isCompleted
                ? COLORS.success
                : isCurrent
                ? phaseColor
                : COLORS.surfaceHigh,
            },
          ]}
        >
          {isCompleted ? (
            <Text style={styles.dayCheck}>✓</Text>
          ) : (
            <Text style={[styles.dayNumText, isLocked && { color: COLORS.text.tertiary }]}>
              {task.day}
            </Text>
          )}
        </View>
        <View style={styles.dayCardMeta}>
          <Text
            style={[
              styles.dayPhaseLabel,
              { color: isLocked ? COLORS.text.tertiary : phaseColor },
            ]}
          >
            {getPhaseLabel(task.phase).toUpperCase()} · {getIntensityLabel(task.intensity)}
          </Text>
          <Text style={[styles.dayTitle, isLocked && { color: COLORS.text.tertiary }]}>
            {task.physiologicalGoal}
          </Text>
        </View>
      </View>

      <View style={styles.dayCardRight}>
        <Text style={[styles.dayDuration, isLocked && { color: COLORS.text.tertiary }]}>
          {task.durationMinutes}
        </Text>
        <Text style={styles.dayDurationUnit}>min</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AcclimationScreen() {
  const [state, setState] = useState<AcclimationState>(getAcclimationState);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      setState(getAcclimationState());
    }, []),
  );

  const profile = getHeatProfile();
  const program = generateAcclimationProgram(
    profile ?? {
      age: 35,
      activityLevel: 'moderate',
      conditions: [],
    },
  );

  const score = getAcclimationScore(state.completedDays.length);
  const streak = getStreak(state);

  const handleStart = () => {
    const newState = startAcclimationProgram();
    setState(newState);
  };

  const handleCompleteDay = (day: number) => {
    const task = program.tasks.find((t) => t.day === day);
    if (!task) return;

    Alert.alert(
      `Complete Day ${day}?`,
      `This will mark your ${task.durationMinutes}-minute session as done and unlock Day ${day + 1}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Complete',
          onPress: () => {
            const newState = completeAcclimationDay(day);
            setState(newState);
          },
        },
      ],
    );
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Program?',
      'This will clear all your progress. You can restart from Day 1.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetAcclimationProgram();
            setState(getAcclimationState());
          },
        },
      ],
    );
  };

  const isComplete = state.completedDays.length >= 14;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerLabel}>PROGRAM</Text>
            <Text style={styles.headerTitle}>Heat Acclimation</Text>
          </View>
          {state.isActive && (
            <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Score Card ──────────────────────────────────────────────────── */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreValue}>{score}%</Text>
              <Text style={styles.scoreLabel}>Acclimated</Text>
            </View>
            <View style={styles.scoreDivider} />
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: '#F59E0B' }]}>
                {state.completedDays.length}
              </Text>
              <Text style={styles.scoreLabel}>Days Done</Text>
            </View>
            <View style={styles.scoreDivider} />
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: '#3B82F6' }]}>{streak}</Text>
              <Text style={styles.scoreLabel}>Day Streak</Text>
            </View>
          </View>

          <PhaseBar completedDays={state.completedDays} />

          {isComplete && (
            <View style={styles.completeBadge}>
              <Text style={styles.completeBadgeText}>
                ✓  Fully Acclimated — Program Complete
              </Text>
            </View>
          )}
        </View>

        {/* ── Science Callout ──────────────────────────────────────────────── */}
        {!state.isActive && !isComplete && (
          <View style={styles.scienceCard}>
            <Text style={styles.scienceTitle}>Why 14 Days?</Text>
            <Text style={styles.scienceBody}>
              Heat acclimation triggers plasma volume expansion, lowers your
              core temperature set-point, and makes your sweat glands more
              efficient — but these adaptations take 10–14 days to fully
              manifest. Rushing it is dangerous. This protocol is derived from
              sports medicine research used by military and elite athletes.
            </Text>
          </View>
        )}

        {/* ── Start CTA ───────────────────────────────────────────────────── */}
        {!state.isActive && !isComplete && (
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStart}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>Start 14-Day Program</Text>
          </TouchableOpacity>
        )}

        {/* ── Day List ────────────────────────────────────────────────────── */}
        {(state.isActive || isComplete) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DAILY TASKS</Text>
            {program.tasks.map((task) => {
              const isCompleted = state.completedDays.includes(task.day);
              const isCurrent = task.day === state.currentDay;
              const isLocked = !isCompleted && task.day > state.currentDay;
              const isExpanded = expandedDay === task.day;

              return (
                <View key={task.day}>
                  <DayCard
                    task={task}
                    isCompleted={isCompleted}
                    isCurrent={isCurrent}
                    isLocked={isLocked}
                    onPress={() => {
                      if (!isLocked) {
                        setExpandedDay(isExpanded ? null : task.day);
                      }
                    }}
                  />

                  {/* Expanded detail */}
                  {isExpanded && !isLocked && (
                    <View style={styles.expandedCard}>
                      <Text style={styles.expandedSection}>BEST TIME</Text>
                      <Text style={styles.expandedValue}>{task.bestTimeOfDay}</Text>

                      <Text style={[styles.expandedSection, { marginTop: 14 }]}>TIPS</Text>
                      {task.tips.map((tip, i) => (
                        <View key={i} style={styles.tipRow}>
                          <Text style={styles.tipDot}>•</Text>
                          <Text style={styles.tipText}>{tip}</Text>
                        </View>
                      ))}

                      {task.adaptationUnlocked && (
                        <View style={styles.unlockBadge}>
                          <Text style={styles.unlockText}>
                            🔓  Unlocks: {task.adaptationUnlocked}
                          </Text>
                        </View>
                      )}

                      {isCurrent && !isCompleted && (
                        <TouchableOpacity
                          style={styles.completeButton}
                          onPress={() => handleCompleteDay(task.day)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.completeButtonText}>
                            Mark Day {task.day} Complete
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: COLORS.text.primary, fontSize: 22 },
  headerLabel: { color: COLORS.text.tertiary, fontSize: 11, letterSpacing: 2, fontWeight: '600' },
  headerTitle: { color: COLORS.text.primary, fontSize: 18, fontWeight: '700', marginTop: 2 },
  resetBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.surface },
  resetBtnText: { color: COLORS.error, fontSize: 13, fontWeight: '600' },

  scoreCard: {
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 16,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  scoreItem: { flex: 1, alignItems: 'center', gap: 4 },
  scoreValue: { fontSize: 28, fontWeight: '700', color: COLORS.success },
  scoreLabel: { fontSize: 11, color: COLORS.text.secondary },
  scoreDivider: { width: 1, height: 40, backgroundColor: COLORS.border },

  phaseBarContainer: { flexDirection: 'row', gap: 8 },
  phaseBarItem: { flex: 1, gap: 5 },
  phaseBarTrack: {
    height: 5,
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 3,
    overflow: 'hidden',
  },
  phaseBarFill: { height: '100%', borderRadius: 3 },
  phaseBarLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },

  completeBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    padding: 12,
    alignItems: 'center',
  },
  completeBadgeText: { color: COLORS.success, fontWeight: '600', fontSize: 14 },

  scienceCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  scienceTitle: { color: COLORS.text.primary, fontWeight: '700', fontSize: 14, marginBottom: 8 },
  scienceBody: { color: COLORS.text.secondary, fontSize: 13, lineHeight: 20 },

  startButton: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  section: { marginHorizontal: 20, marginTop: 24 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: COLORS.text.tertiary,
    marginBottom: 12,
  },

  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 8,
  },
  dayCardLocked: { opacity: 0.45 },
  dayCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  dayNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCheck: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dayNumText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dayCardMeta: { flex: 1, gap: 3 },
  dayPhaseLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dayTitle: { color: COLORS.text.primary, fontSize: 13, lineHeight: 17 },
  dayCardRight: { alignItems: 'center' },
  dayDuration: { color: COLORS.text.primary, fontSize: 20, fontWeight: '700' },
  dayDurationUnit: { color: COLORS.text.tertiary, fontSize: 10, marginTop: 1 },

  expandedCard: {
    marginHorizontal: 8,
    marginBottom: 8,
    marginTop: -4,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
  },
  expandedSection: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: COLORS.text.tertiary,
    marginBottom: 4,
  },
  expandedValue: { color: COLORS.text.primary, fontSize: 14 },
  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tipDot: { color: COLORS.text.secondary, marginTop: 1 },
  tipText: { color: COLORS.text.secondary, fontSize: 13, lineHeight: 19, flex: 1 },
  unlockBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 8,
    padding: 10,
  },
  unlockText: { color: '#60A5FA', fontSize: 12, fontWeight: '600' },
  completeButton: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  completeButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
