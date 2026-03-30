// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Personal Exposure Analytics
// Visualises the user's cumulative heat exposure over time using check-in
// history cross-referenced with the temperature model.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, {
  Rect,
  Line,
  Text as SvgText,
  G,
} from 'react-native-svg';
import {
  buildExposureAnalytics,
  ExposureAnalytics,
  DayExposure,
  EXPOSURE_LEVEL_CONFIG,
  ExposureLevel,
} from '../../src/features/intelligence/exposureEngine';
import { loadCheckInsForExposure } from '../../src/features/intelligence/storage/exposureStorage';
import { getHeatProfile, getRiskMultiplier } from '../../src/features/profile/storage/profileStorage';

// ── Design tokens ──────────────────────────────────────────────────────────

const C = {
  navy:      '#0A1628',
  navyMid:   '#1A2B4A',
  navyLight: '#243856',
  accent:    '#3B82F6',
  border:    '#2D3F5C',
  text:      '#FFFFFF',
  textSub:   '#94A3B8',
  textMuted: '#64748B',
};

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_H_PAD = 20;
const CHART_W     = Math.min(SCREEN_W - CHART_H_PAD * 2 - 32, 540);
const BAR_AREA_H  = 100;
const LABEL_H     = 20;

// ── 14-day exposure bar chart ──────────────────────────────────────────────

function ExposureBarChart({ days }: { days: DayExposure[] }) {
  const n    = days.length;
  const slotW = CHART_W / n;
  const barW  = Math.max(2, slotW - 3);

  return (
    <Svg width={CHART_W} height={BAR_AREA_H + LABEL_H + 8}>
      {/* Grid lines at 25, 50, 75 */}
      {[25, 50, 75].map(pct => {
        const y = 4 + BAR_AREA_H - (pct / 100) * BAR_AREA_H;
        return (
          <Line
            key={pct}
            x1={0} y1={y} x2={CHART_W} y2={y}
            stroke={C.border}
            strokeWidth={0.5}
            strokeDasharray="3,5"
          />
        );
      })}

      {days.map((d, i) => {
        const bH  = Math.max(2, (d.cappedScore / 100) * BAR_AREA_H);
        const x   = i * slotW + (slotW - barW) / 2;
        const y   = 4 + BAR_AREA_H - bH;
        const cfg = EXPOSURE_LEVEL_CONFIG[d.level];
        const showLabel = i % 2 === 0;

        return (
          <G key={i}>
            {/* Today highlight column */}
            {d.isToday && (
              <Rect
                x={i * slotW}
                y={4}
                width={slotW}
                height={BAR_AREA_H}
                fill={C.accent}
                fillOpacity={0.08}
                rx={2}
              />
            )}
            {/* Exposure bar */}
            {d.checkInCount > 0 && (
              <Rect
                x={x}
                y={y}
                width={barW}
                height={bH}
                fill={cfg.color}
                fillOpacity={d.isToday ? 1 : 0.8}
                rx={2}
              />
            )}
            {/* Day label (every other to avoid crowding) */}
            {showLabel && (
              <SvgText
                x={i * slotW + slotW / 2}
                y={BAR_AREA_H + LABEL_H + 4}
                textAnchor="middle"
                fontSize={9}
                fill={d.isToday ? C.accent : C.textMuted}
                fontFamily="System"
                fontWeight={d.isToday ? '700' : '400'}
              >
                {d.isToday ? 'TODAY' : d.dateLabel.toUpperCase()}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

// ── Streak badge ───────────────────────────────────────────────────────────

function StreakBadge({
  value,
  label,
  color,
  sub,
}: {
  value: number;
  label: string;
  color: string;
  sub?: string;
}) {
  return (
    <View style={[styles.streakBadge, { borderColor: color + '44' }]}>
      <Text style={[styles.streakValue, { color }]}>{value}</Text>
      <Text style={styles.streakLabel}>{label}</Text>
      {sub ? <Text style={styles.streakSub}>{sub}</Text> : null}
    </View>
  );
}

// ── Week comparison card ───────────────────────────────────────────────────

function WeekCompareRow({
  analytics,
}: {
  analytics: ExposureAnalytics;
}) {
  const { thisWeek, lastWeek, trendPercent, overallRiskTrend } = analytics;
  const trendColor =
    overallRiskTrend === 'improving' ? '#4ADE80' :
    overallRiskTrend === 'worsening' ? '#F87171' : C.textSub;
  const trendPrefix = trendPercent > 0 ? '+' : '';
  const trendIcon   =
    overallRiskTrend === 'improving' ? '↓' :
    overallRiskTrend === 'worsening' ? '↑' : '→';

  return (
    <View style={styles.weekCompareCard}>
      {/* This week */}
      <View style={styles.weekCol}>
        <Text style={styles.weekColLabel}>THIS WEEK</Text>
        <Text style={styles.weekColScore}>{thisWeek.totalScore}</Text>
        <Text style={styles.weekColSub}>exposure score</Text>
        <View style={styles.weekStatRow}>
          <Text style={styles.weekStatItem}>✅ {thisWeek.safeDays} safe days</Text>
          <Text style={styles.weekStatItem}>⚠️ {thisWeek.highExposureDays} high days</Text>
        </View>
      </View>

      {/* Trend divider */}
      <View style={styles.weekDivider}>
        <Text style={[styles.trendIcon, { color: trendColor }]}>{trendIcon}</Text>
        <Text style={[styles.trendPct, { color: trendColor }]}>
          {trendPrefix}{trendPercent}%
        </Text>
      </View>

      {/* Last week */}
      <View style={[styles.weekCol, styles.weekColRight]}>
        <Text style={styles.weekColLabel}>LAST WEEK</Text>
        <Text style={[styles.weekColScore, { color: C.textSub }]}>{lastWeek.totalScore}</Text>
        <Text style={styles.weekColSub}>exposure score</Text>
        <View style={styles.weekStatRow}>
          <Text style={styles.weekStatItem}>✅ {lastWeek.safeDays} safe days</Text>
          <Text style={styles.weekStatItem}>⚠️ {lastWeek.highExposureDays} high days</Text>
        </View>
      </View>
    </View>
  );
}

// ── Recent check-in list ───────────────────────────────────────────────────

function CheckInRow({ checkIn }: { checkIn: ExposureAnalytics['recentCheckIns'][0] }) {
  const cfg = EXPOSURE_LEVEL_CONFIG[checkIn.level];
  const ts  = checkIn.timestamp;
  const timeLabel = ts.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const dateLabel = ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <View style={styles.checkInRow}>
      <View style={[styles.checkInDot, { backgroundColor: cfg.color }]} />
      <View style={styles.checkInLeft}>
        <Text style={styles.checkInTime}>{timeLabel}</Text>
        <Text style={styles.checkInDate}>{dateLabel}</Text>
      </View>
      <View style={styles.checkInRight}>
        <Text style={[styles.checkInTemp, { color: cfg.color }]}>
          {checkIn.tempAtTime}°F felt
        </Text>
        <View style={[styles.checkInLevelPill, { backgroundColor: cfg.light, borderColor: cfg.color + '44' }]}>
          <Text style={[styles.checkInLevelText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Level legend ───────────────────────────────────────────────────────────

function ExposureLegend() {
  return (
    <View style={styles.legend}>
      {(Object.entries(EXPOSURE_LEVEL_CONFIG) as [ExposureLevel, typeof EXPOSURE_LEVEL_CONFIG[ExposureLevel]][]).map(([key, cfg]) => (
        <View key={key} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: cfg.color }]} />
          <Text style={styles.legendText}>{cfg.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function ExposureHistoryScreen() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<ExposureAnalytics | null>(null);

  useEffect(() => {
    const raw       = getHeatProfile();
    const multiplier = getRiskMultiplier(raw);
    const checkIns  = loadCheckInsForExposure();
    const result    = buildExposureAnalytics(checkIns, multiplier);
    setAnalytics(result);
  }, []);

  if (!analytics) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Analysing your exposure history…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const trendColor =
    analytics.overallRiskTrend === 'improving' ? '#4ADE80' :
    analytics.overallRiskTrend === 'worsening' ? '#F87171' : C.textSub;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Exposure History</Text>
          <Text style={styles.headerSub}>14-day personalised heat exposure</Text>
        </View>
        <View style={[styles.trendChip, { borderColor: trendColor + '55' }]}>
          <Text style={[styles.trendChipText, { color: trendColor }]}>
            {analytics.overallRiskTrend === 'improving' ? '↓ Improving' :
             analytics.overallRiskTrend === 'worsening' ? '↑ Worsening' : '→ Stable'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Insight banner ── */}
        <View style={styles.insightBanner}>
          <View style={styles.insightAccent} />
          <Text style={styles.insightText}>{analytics.insight}</Text>
        </View>

        {/* ── 14-Day Chart ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>14-Day Exposure</Text>
            <Text style={styles.sectionHint}>{analytics.totalCheckIns} check-ins total</Text>
          </View>
          <View style={styles.chartCard}>
            <ExposureBarChart days={analytics.days} />
            <ExposureLegend />
          </View>
        </View>

        {/* ── Streak row ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Streaks & Stats</Text>
          <View style={styles.streakRow}>
            <StreakBadge
              value={analytics.streaks.currentSafeDays}
              label="Safe Days"
              color="#4ADE80"
              sub="current streak"
            />
            <StreakBadge
              value={analytics.streaks.longestSafeDays}
              label="Best Streak"
              color={C.accent}
              sub="all time"
            />
            <StreakBadge
              value={analytics.streaks.currentActiveDays}
              label="Active Days"
              color={C.textSub}
              sub="in a row"
            />
            <StreakBadge
              value={analytics.streaks.totalSafeDays}
              label="Total Safe"
              color="#65A30D"
              sub="last 14 days"
            />
          </View>
        </View>

        {/* ── Week-over-week comparison ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Week Comparison</Text>
          <WeekCompareRow analytics={analytics} />
        </View>

        {/* ── Daily breakdown (this week only) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.dailyGrid}>
            {analytics.days.slice(7).map((d, i) => {
              const cfg = EXPOSURE_LEVEL_CONFIG[d.level];
              return (
                <View
                  key={i}
                  style={[
                    styles.dailyCell,
                    { backgroundColor: d.checkInCount > 0 ? cfg.light : C.navyMid },
                    d.isToday && styles.dailyCellToday,
                  ]}
                >
                  <Text style={[styles.dailyCellDay, d.isToday && { color: C.accent }]}>
                    {d.isToday ? 'TODAY' : d.dateLabel.toUpperCase()}
                  </Text>
                  {d.checkInCount > 0 ? (
                    <>
                      <Text style={[styles.dailyCellScore, { color: cfg.color }]}>
                        {d.totalScore}
                      </Text>
                      <Text style={styles.dailyCellLevel}>{cfg.label}</Text>
                      <Text style={styles.dailyCellCheckins}>{d.checkInCount} check-in{d.checkInCount > 1 ? 's' : ''}</Text>
                    </>
                  ) : (
                    <Text style={styles.dailyCellNone}>No data</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Recent check-ins ── */}
        {analytics.recentCheckIns.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Check-ins</Text>
            <View style={styles.checkInList}>
              {analytics.recentCheckIns.map((c, i) => (
                <CheckInRow key={i} checkIn={c} />
              ))}
            </View>
          </View>
        )}

        {/* ── Footer ── */}
        <Text style={styles.footerNote}>
          Exposure scores are personalised using your heat profile and estimated temperature at each check-in time.
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.navy },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: C.text, fontSize: 16, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.navyMid, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  backIcon: { color: C.text, fontSize: 20, lineHeight: 22 },
  headerTextWrap: { flex: 1 },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { color: C.textMuted, fontSize: 12, marginTop: 1 },
  trendChip: {
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  trendChipText: { fontSize: 12, fontWeight: '700' },

  // Scroll
  scroll: { paddingTop: 8 },

  // Insight
  insightBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: C.navyMid,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  insightAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: C.accent, marginTop: 2 },
  insightText: { color: C.textSub, fontSize: 14, lineHeight: 22, flex: 1 },

  // Section
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  sectionHint: { color: C.textMuted, fontSize: 11 },

  // Chart
  chartCard: {
    backgroundColor: C.navyMid,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    marginTop: 10, gap: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: C.textMuted, fontSize: 10 },

  // Streaks
  streakRow: { flexDirection: 'row', gap: 10 },
  streakBadge: {
    flex: 1, alignItems: 'center', backgroundColor: C.navyMid,
    borderRadius: 14, paddingVertical: 14, borderWidth: 1, gap: 2,
  },
  streakValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  streakLabel: { color: C.text, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  streakSub: { color: C.textMuted, fontSize: 9, textAlign: 'center' },

  // Week compare
  weekCompareCard: {
    backgroundColor: C.navyMid,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  weekCol: { flex: 1, padding: 16, gap: 4 },
  weekColRight: { alignItems: 'flex-end' },
  weekColLabel: {
    color: C.textMuted, fontSize: 9, fontWeight: '700',
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  weekColScore: { color: C.text, fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  weekColSub: { color: C.textMuted, fontSize: 11 },
  weekStatRow: { marginTop: 6, gap: 3 },
  weekStatItem: { color: C.textSub, fontSize: 12 },
  weekDivider: {
    width: 56, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.navyLight, gap: 4,
  },
  trendIcon: { fontSize: 20, fontWeight: '800' },
  trendPct: { fontSize: 13, fontWeight: '700' },

  // Daily grid
  dailyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dailyCell: {
    width: (SCREEN_W - 40 - 8 * 3) / 4 - 2,
    borderRadius: 12, padding: 10, gap: 3,
    borderWidth: 1, borderColor: C.border,
  },
  dailyCellToday: { borderColor: C.accent },
  dailyCellDay: { color: C.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  dailyCellScore: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  dailyCellLevel: { color: C.textSub, fontSize: 10 },
  dailyCellCheckins: { color: C.textMuted, fontSize: 9 },
  dailyCellNone: { color: C.textMuted, fontSize: 11, marginTop: 6 },

  // Check-in list
  checkInList: {
    backgroundColor: C.navyMid,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  checkInDot: { width: 8, height: 8, borderRadius: 4 },
  checkInLeft: { flex: 1 },
  checkInTime: { color: C.text, fontSize: 14, fontWeight: '600' },
  checkInDate: { color: C.textMuted, fontSize: 11 },
  checkInRight: { alignItems: 'flex-end', gap: 4 },
  checkInTemp: { fontSize: 13, fontWeight: '700' },
  checkInLevelPill: {
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1,
  },
  checkInLevelText: { fontSize: 10, fontWeight: '700' },

  // Footer
  footerNote: {
    color: C.textMuted, fontSize: 12, textAlign: 'center',
    paddingHorizontal: 36, marginTop: 20, lineHeight: 18,
  },
});
