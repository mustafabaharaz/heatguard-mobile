import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  generateDailyBrief,
  getCachedBrief,
  cacheBrief,
  getRiskColor,
  getRiskGradient,
  type DailyBrief,
} from '../../src/features/brief/briefEngine';
import {
  getHeatProfile,
  type HeatProfile,
} from '../../src/features/profile/storage/profileStorage';
import { getAcclimationState, getAcclimationScore } from '../../src/features/acclimation/acclimationEngine';
import { getAcclimationState as loadAcclimationState } from '../../src/features/acclimation/acclimationStorage';
import { calculateHydrationTarget, computeHydrationSummary, mlToOz } from '../../src/features/hydration/hydrationEngine';
import { getHydrationLogs } from '../../src/features/hydration/hydrationStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  background: '#0A1628',
  surface: '#1A2942',
  surfaceElevated: '#243352',
  text: { primary: '#F8FAFC', secondary: '#94A3B8', tertiary: '#64748B' },
  border: '#2D3F5C',
  borderLight: '#374B6D',
  primary: '#3B82F6',
};

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, color }: { score: number; color: string }) {
  const size = 160;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - score / 100);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
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
          <Text style={{ fontSize: 42, fontWeight: '700', color: color }}>{score}</Text>
          <Text style={{ fontSize: 11, color: COLORS.text.secondary, letterSpacing: 1.5, marginTop: 2 }}>
            RISK SCORE
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Recommendation Row ───────────────────────────────────────────────────────

function RecommendationRow({ text, index }: { text: string; index: number }) {
  return (
    <View style={styles.recRow}>
      <View style={styles.recNumber}>
        <Text style={styles.recNumberText}>{index + 1}</Text>
      </View>
      <Text style={styles.recText}>{text}</Text>
    </View>
  );
}

// ─── Stat Cell ────────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  subvalue,
  color,
  onPress,
}: {
  label: string;
  value: string;
  subvalue?: string;
  color?: string;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={styles.statCell}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      {subvalue ? (
        <Text style={styles.statSub}>{subvalue}</Text>
      ) : null}
      <Text style={styles.statLabel}>{label}</Text>
    </Wrapper>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DailyBriefScreen() {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const buildBrief = useCallback(async (force = false) => {
    // Try cache first (unless forcing refresh)
    if (!force) {
      const cached = getCachedBrief();
      if (cached) {
        setBrief(cached);
        setLoading(false);
        return;
      }
    }

    const profile = getHeatProfile() as (HeatProfile & { weight?: number }) | null;
    if (!profile) {
      setLoading(false);
      return;
    }

    // Gather all data sources
    const acclimationRaw = loadAcclimationState();
    const acclimationScore = getAcclimationScore(acclimationRaw.completedDays.length);
    const acclimationDay = acclimationRaw.isActive ? acclimationRaw.currentDay : null;

    const forecastHighF = 108; // TODO: wire to forecastEngine
    const hydrationTarget = calculateHydrationTarget(profile, forecastHighF);
    const logs = getHydrationLogs();
    const hydrationSummary = computeHydrationSummary(hydrationTarget, logs);

    const result = generateDailyBrief({
      profile,
      forecastHighF,
      hydrationTargetOz: mlToOz(hydrationTarget.dailyTargetMl),
      hydrationPercentComplete: hydrationSummary.percentComplete,
      acclimationDay,
      acclimationScore,
      medicationWarnings: profile.medications?.length ?? 0,
    });

    cacheBrief(result);
    setBrief(result);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { buildBrief(); }, [buildBrief]);

  const handleRefresh = () => {
    setRefreshing(true);
    buildBrief(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Building your daily brief…</Text>
      </View>
    );
  }

  if (!brief) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>
          Complete your Heat Profile to receive daily briefs.
        </Text>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/profile/heat-profile')}
        >
          <Text style={styles.ctaText}>Set Up Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const riskColor = getRiskColor(brief.riskLevel);
  const gradient = getRiskGradient(brief.riskLevel);
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

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
            <Text style={styles.headerLabel}>DAILY BRIEF</Text>
            <Text style={styles.headerDate}>{dateStr}</Text>
          </View>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
            <Text style={styles.refreshIcon}>{refreshing ? '⟳' : '↺'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Hero Card ───────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[gradient[0], gradient[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroLeft}>
              <View style={[styles.riskBadge, { backgroundColor: `${riskColor}25`, borderColor: `${riskColor}50` }]}>
                <Text style={[styles.riskBadgeText, { color: riskColor }]}>
                  {brief.riskLevel.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.heroHeadline}>{brief.headline}</Text>
              <Text style={styles.heroForecast}>{brief.forecastSummary}</Text>
            </View>
            <ScoreRing score={brief.overallScore} color={riskColor} />
          </View>

          {/* Personal risk note */}
          <View style={styles.personalNote}>
            <Text style={styles.personalNoteIcon}>⚠</Text>
            <Text style={styles.personalNoteText}>{brief.personalRiskNote}</Text>
          </View>
        </LinearGradient>

        {/* ── Quick Stats Grid ─────────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <StatCell
            label="Hydration"
            value={`${brief.hydrationPercentComplete}%`}
            subvalue={`of ${brief.hydrationTargetOz} oz`}
            color={brief.hydrationPercentComplete >= 80 ? '#22C55E' : brief.hydrationPercentComplete >= 40 ? '#F59E0B' : '#EF4444'}
            onPress={() => router.push('/hydration/tracker')}
          />
          <View style={styles.statDivider} />
          <StatCell
            label="Acclimation"
            value={`${brief.acclimationScore}%`}
            subvalue={brief.acclimationDay ? `Day ${brief.acclimationDay}` : 'Not started'}
            color="#3B82F6"
            onPress={() => router.push('/acclimation')}
          />
          <View style={styles.statDivider} />
          <StatCell
            label="Med Warnings"
            value={String(brief.medicationWarnings)}
            subvalue={brief.medicationWarnings > 0 ? 'Review now' : 'All clear'}
            color={brief.medicationWarnings > 0 ? '#EF4444' : '#22C55E'}
            onPress={() => router.push('/profile/medications')}
          />
        </View>

        {/* ── Today's Recommendations ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TODAY'S RECOMMENDATIONS</Text>
          <View style={styles.recCard}>
            {brief.topRecommendations.map((rec, i) => (
              <RecommendationRow key={i} text={rec} index={i} />
            ))}
          </View>
        </View>

        {/* ── Quick Actions ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push('/hydration/tracker')}
              activeOpacity={0.75}
            >
              <Text style={styles.actionIcon}>💧</Text>
              <Text style={styles.actionLabel}>Log Water</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push('/acclimation')}
              activeOpacity={0.75}
            >
              <Text style={styles.actionIcon}>🏃</Text>
              <Text style={styles.actionLabel}>Acclimate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push('/vehicle/alert')}
              activeOpacity={0.75}
            >
              <Text style={styles.actionIcon}>🚗</Text>
              <Text style={styles.actionLabel}>Vehicle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push('/intelligence/forecast')}
              activeOpacity={0.75}
            >
              <Text style={styles.actionIcon}>📊</Text>
              <Text style={styles.actionLabel}>Forecast</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <Text style={styles.footer}>
          Generated at {timeStr} · Refreshes daily
        </Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  loadingText: { color: COLORS.text.secondary, fontSize: 15, textAlign: 'center' },

  ctaButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  ctaText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  // Header
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
  headerDate: { color: COLORS.text.primary, fontSize: 16, fontWeight: '700', marginTop: 2 },
  refreshBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  refreshIcon: { color: COLORS.text.secondary, fontSize: 20 },

  // Hero card
  heroCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  heroLeft: { flex: 1, marginRight: 16 },
  riskBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 12,
  },
  riskBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  heroHeadline: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 25,
    marginBottom: 8,
  },
  heroForecast: { color: 'rgba(248,250,252,0.7)', fontSize: 13, lineHeight: 18 },

  personalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  personalNoteIcon: { fontSize: 14, marginTop: 1 },
  personalNoteText: { color: 'rgba(248,250,252,0.85)', fontSize: 13, lineHeight: 18, flex: 1 },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: COLORS.text.primary },
  statSub: { fontSize: 11, color: COLORS.text.tertiary, marginTop: 2 },
  statLabel: { fontSize: 11, color: COLORS.text.secondary, marginTop: 6, letterSpacing: 0.5, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 16 },

  // Sections
  section: { marginHorizontal: 20, marginTop: 24 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: COLORS.text.tertiary,
    marginBottom: 12,
  },

  // Recommendations
  recCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 4,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 12,
  },
  recNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recNumberText: { color: COLORS.text.secondary, fontSize: 12, fontWeight: '600' },
  recText: { flex: 1, color: COLORS.text.primary, fontSize: 14, lineHeight: 20 },

  // Quick actions
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  actionIcon: { fontSize: 20 },
  actionLabel: { color: COLORS.text.secondary, fontSize: 11, fontWeight: '500' },

  footer: {
    color: COLORS.text.tertiary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 20,
  },
});
