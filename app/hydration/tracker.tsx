import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  calculateHydrationTarget,
  computeHydrationSummary,
  getStatusColor,
  getStatusLabel,
  getStatusMessage,
  formatMl,
  mlToOz,
  QUICK_ADD_OPTIONS,
  type HydrationSummary,
  type HydrationLog,
} from '../../src/features/hydration/hydrationEngine';
import {
  getHydrationLogs,
  addHydrationLog,
  removeHydrationLog,
  getWeeklyTotals,
} from '../../src/features/hydration/hydrationStorage';
import { getHeatProfile } from '../../src/features/profile/storage/profileStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
};

const CURRENT_TEMP_F = 108; // TODO: wire to live weather

// ─── Progress Ring ────────────────────────────────────────────────────────────

function HydrationRing({ summary }: { summary: HydrationSummary }) {
  const size = 200;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - summary.percentComplete / 100);
  const color = getStatusColor(summary.status);

  const consumedOz = Math.round(summary.consumedMl / 29.574);
  const targetOz = Math.round(summary.target.dailyTargetMl / 29.574);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <View style={StyleSheet.absoluteFill as object}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, color: COLORS.text.tertiary, letterSpacing: 1.5, marginBottom: 4 }}>
            TODAY
          </Text>
          <Text style={{ fontSize: 46, fontWeight: '700', color }}>
            {consumedOz}
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.text.secondary }}>
            of {targetOz} oz
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color, marginTop: 4 }}>
            {summary.percentComplete}%
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────

function WeeklyChart({ targetMl }: { targetMl: number }) {
  const data = getWeeklyTotals();
  const maxVal = Math.max(...data.map((d) => d.totalMl), targetMl);
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const todayIdx = new Date().getDay();

  return (
    <View style={styles.weeklyChart}>
      {data.map((day, i) => {
        const pct = day.totalMl / maxVal;
        const isToday = i === 6; // last item is today
        const hitTarget = day.totalMl >= targetMl;
        const barColor = hitTarget ? COLORS.success : isToday ? COLORS.primary : COLORS.surfaceHigh;
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const label = days[d.getDay()];

        return (
          <View key={i} style={styles.weeklyBarColumn}>
            <View style={styles.weeklyBarTrack}>
              <View
                style={[
                  styles.weeklyBarFill,
                  {
                    height: `${Math.max(pct * 100, 4)}%`,
                    backgroundColor: barColor,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.weeklyBarLabel,
                isToday && { color: COLORS.primary, fontWeight: '700' },
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Log Item ─────────────────────────────────────────────────────────────────

function LogItem({ log, onDelete }: { log: HydrationLog; onDelete: () => void }) {
  const time = new Date(log.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <View style={styles.logItem}>
      <Text style={styles.logTime}>{time}</Text>
      <Text style={styles.logAmount}>{formatMl(log.amountMl)}</Text>
      <Text style={styles.logAmountOz}>({mlToOz(log.amountMl)} oz)</Text>
      <TouchableOpacity onPress={onDelete} style={styles.logDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.logDeleteText}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HydrationTrackerScreen() {
  const [logs, setLogs] = useState<HydrationLog[]>(() => getHydrationLogs());
  const [customAmount, setCustomAmount] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLogs(getHydrationLogs());
    }, []),
  );

  const profile = getHeatProfile();
  const target = calculateHydrationTarget(
    profile ?? { age: 35, activityLevel: 'moderate', conditions: [] },
    CURRENT_TEMP_F,
  );
  const summary = computeHydrationSummary(target, logs);
  const todayLogs = logs
    .filter((l) => new Date(l.timestamp).toDateString() === new Date().toDateString())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const statusColor = getStatusColor(summary.status);

  const handleQuickAdd = (amountMl: number) => {
    addHydrationLog(amountMl);
    setLogs(getHydrationLogs());
  };

  const handleCustomAdd = () => {
    const ml = parseInt(customAmount, 10);
    if (isNaN(ml) || ml <= 0 || ml > 5000) {
      Alert.alert('Invalid amount', 'Enter a value between 1 and 5000 ml.');
      return;
    }
    addHydrationLog(ml);
    setCustomAmount('');
    setShowCustom(false);
    setLogs(getHydrationLogs());
  };

  const handleDelete = (id: string) => {
    removeHydrationLog(id);
    setLogs(getHydrationLogs());
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerLabel}>TRACKER</Text>
            <Text style={styles.headerTitle}>Hydration</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Ring + Status ───────────────────────────────────────────────── */}
        <View style={styles.ringSection}>
          <HydrationRing summary={summary} />
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${statusColor}20`, borderColor: `${statusColor}40` },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(summary.status)}
            </Text>
          </View>
          <Text style={styles.statusMessage}>
            {getStatusMessage(
              summary.status,
              Math.round(summary.remainingMl / 29.574),
            )}
          </Text>
        </View>

        {/* ── Breakdown ───────────────────────────────────────────────────── */}
        <View style={styles.breakdown}>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownValue}>{formatMl(target.breakdown.baseMl)}</Text>
            <Text style={styles.breakdownLabel}>Base</Text>
          </View>
          <Text style={styles.breakdownPlus}>+</Text>
          <View style={styles.breakdownItem}>
            <Text style={[styles.breakdownValue, { color: '#F97316' }]}>
              {formatMl(target.breakdown.heatBonusMl)}
            </Text>
            <Text style={styles.breakdownLabel}>Heat</Text>
          </View>
          <Text style={styles.breakdownPlus}>+</Text>
          <View style={styles.breakdownItem}>
            <Text style={[styles.breakdownValue, { color: '#3B82F6' }]}>
              {formatMl(target.breakdown.activityBonusMl)}
            </Text>
            <Text style={styles.breakdownLabel}>Activity</Text>
          </View>
          {target.breakdown.ageAdjustmentMl > 0 && (
            <>
              <Text style={styles.breakdownPlus}>+</Text>
              <View style={styles.breakdownItem}>
                <Text style={[styles.breakdownValue, { color: '#A78BFA' }]}>
                  {formatMl(target.breakdown.ageAdjustmentMl)}
                </Text>
                <Text style={styles.breakdownLabel}>Age</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Quick Add ────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LOG INTAKE</Text>
          <View style={styles.quickAddRow}>
            {QUICK_ADD_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={styles.quickAddBtn}
                onPress={() => handleQuickAdd(opt.amountMl)}
                activeOpacity={0.75}
              >
                <Text style={styles.quickAddLabel}>{opt.label}</Text>
                <Text style={styles.quickAddAmount}>{formatMl(opt.amountMl)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.customToggle}
            onPress={() => setShowCustom((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.customToggleText}>
              {showCustom ? '— Custom amount' : '+ Custom amount'}
            </Text>
          </TouchableOpacity>

          {showCustom && (
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                value={customAmount}
                onChangeText={setCustomAmount}
                placeholder="Amount in ml"
                placeholderTextColor={COLORS.text.tertiary}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={handleCustomAdd}
              />
              <TouchableOpacity
                style={styles.customAddBtn}
                onPress={handleCustomAdd}
                activeOpacity={0.8}
              >
                <Text style={styles.customAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Weekly Chart ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>THIS WEEK</Text>
          <View style={styles.weeklyCard}>
            <WeeklyChart targetMl={target.dailyTargetMl} />
            <Text style={styles.weeklyTarget}>
              Target: {formatMl(target.dailyTargetMl)} / day
            </Text>
          </View>
        </View>

        {/* ── Today's Log ──────────────────────────────────────────────────── */}
        {todayLogs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TODAY'S LOG</Text>
            <View style={styles.logCard}>
              {todayLogs.map((log) => (
                <LogItem
                  key={log.id}
                  log={log}
                  onDelete={() => handleDelete(log.id)}
                />
              ))}
            </View>
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
  headerLabel: { color: COLORS.text.tertiary, fontSize: 11, letterSpacing: 2, fontWeight: '600', textAlign: 'center' },
  headerTitle: { color: COLORS.text.primary, fontSize: 18, fontWeight: '700', marginTop: 2, textAlign: 'center' },

  ringSection: { alignItems: 'center', paddingVertical: 16, gap: 14 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 13, fontWeight: '700' },
  statusMessage: {
    color: COLORS.text.secondary,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  breakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  breakdownItem: { alignItems: 'center', gap: 3 },
  breakdownValue: { fontSize: 13, fontWeight: '700', color: COLORS.text.primary },
  breakdownLabel: { fontSize: 10, color: COLORS.text.tertiary },
  breakdownPlus: { color: COLORS.text.tertiary, fontSize: 13 },

  section: { marginHorizontal: 20, marginTop: 24 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: COLORS.text.tertiary,
    marginBottom: 12,
  },

  quickAddRow: { flexDirection: 'row', gap: 10 },
  quickAddBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  quickAddLabel: { color: COLORS.text.primary, fontSize: 13, fontWeight: '600' },
  quickAddAmount: { color: COLORS.text.tertiary, fontSize: 11 },

  customToggle: { marginTop: 12, alignItems: 'center' },
  customToggleText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },

  customRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  customInput: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    color: COLORS.text.primary,
    fontSize: 15,
  },
  customAddBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customAddText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  weeklyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  weeklyChart: { flexDirection: 'row', height: 80, gap: 6, alignItems: 'flex-end' },
  weeklyBarColumn: { flex: 1, alignItems: 'center', gap: 4 },
  weeklyBarTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weeklyBarFill: { width: '100%', borderRadius: 4 },
  weeklyBarLabel: { fontSize: 10, color: COLORS.text.tertiary },
  weeklyTarget: { color: COLORS.text.tertiary, fontSize: 11, textAlign: 'center' },

  logCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  logTime: { color: COLORS.text.tertiary, fontSize: 12, width: 52 },
  logAmount: { color: COLORS.text.primary, fontSize: 14, fontWeight: '600', flex: 1 },
  logAmountOz: { color: COLORS.text.tertiary, fontSize: 12 },
  logDelete: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  logDeleteText: { color: COLORS.text.tertiary, fontSize: 18, fontWeight: '300' },
});
