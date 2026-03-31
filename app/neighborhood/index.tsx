// ─────────────────────────────────────────────
// Neighborhood Heat Watch Screen
// Block-level heat index, comparison, and alerts
// ─────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Defs, LinearGradient, Stop, Rect, Line, Text as SvgText } from 'react-native-svg';
import {
  computeNeighborhoodSnapshot,
  getThermalConfig,
  compareToUserBlock,
  type BlockReading,
  type NeighborhoodSnapshot,
  type ThermalLevel,
} from '../../src/features/neighborhood/neighborhoodEngine';
import {
  saveSnapshot,
  loadSnapshot,
  filterActiveAlerts,
  dismissAlert,
} from '../../src/features/neighborhood/neighborhoodStorage';

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  BG: '#0F172A',
  CARD: '#1E293B',
  CARD_ELEVATED: '#243044',
  BORDER: '#334155',
  TEXT: '#F1F5F9',
  TEXT_DIM: '#94A3B8',
  TEXT_MUTED: '#64748B',
  ACCENT: '#3B82F6',
  SUCCESS: '#22C55E',
  WARNING: '#F59E0B',
  DANGER: '#EF4444',
} as const;

const TREND_SYMBOLS: Record<BlockReading['trend'], string> = {
  rising: '↑',
  stable: '→',
  falling: '↓',
};

const TREND_COLORS: Record<BlockReading['trend'], string> = {
  rising: C.DANGER,
  stable: C.TEXT_DIM,
  falling: C.SUCCESS,
};

// ─── Sparkline SVG ───────────────────────────────────────────────────────────

function Sparkline({
  data,
  thermalColor,
  width = 300,
  height = 72,
}: {
  data: number[];
  thermalColor: string;
  width?: number;
  height?: number;
}) {
  if (!data.length) return null;

  const PAD_LEFT = 28;
  const PAD_RIGHT = 8;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 18;
  const chartW = width - PAD_LEFT - PAD_RIGHT;
  const chartH = height - PAD_TOP - PAD_BOTTOM;

  const min = Math.min(...data) - 2;
  const max = Math.max(...data) + 2;
  const range = max - min || 1;

  const pts = data.map((v, i) => ({
    x: PAD_LEFT + (i / (data.length - 1)) * chartW,
    y: PAD_TOP + chartH - ((v - min) / range) * chartH,
  }));

  const linePath =
    pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

  const areaPath =
    linePath +
    ` L ${pts[pts.length - 1].x.toFixed(1)} ${(PAD_TOP + chartH).toFixed(1)}` +
    ` L ${PAD_LEFT} ${(PAD_TOP + chartH).toFixed(1)} Z`;

  // Hour labels: midnight, 6am, noon, 6pm
  const nowHour = new Date().getHours();
  const labelHours = [0, 6, 12, 18];
  const labelItems = labelHours.map((lh) => {
    const offset = (lh - nowHour + 24) % 24;
    const x = PAD_LEFT + (offset / 23) * chartW;
    const label = lh === 0 ? '12a' : lh === 6 ? '6a' : lh === 12 ? '12p' : '6p';
    return { x, label };
  });

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={thermalColor} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={thermalColor} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>
      {/* Grid lines */}
      {[0, 0.5, 1].map((frac) => (
        <Line
          key={frac}
          x1={PAD_LEFT}
          y1={PAD_TOP + chartH * frac}
          x2={PAD_LEFT + chartW}
          y2={PAD_TOP + chartH * frac}
          stroke={C.BORDER}
          strokeWidth={0.5}
          strokeDasharray="3,3"
        />
      ))}
      {/* Area fill */}
      <Path d={areaPath} fill="url(#areaGrad)" />
      {/* Line */}
      <Path d={linePath} stroke={thermalColor} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Current value dot */}
      <Rect
        x={pts[pts.length - 1].x - 3}
        y={pts[pts.length - 1].y - 3}
        width={6}
        height={6}
        rx={3}
        fill={thermalColor}
      />
      {/* Y-axis labels */}
      <SvgText x={PAD_LEFT - 4} y={PAD_TOP + 4} fontSize={8} fill={C.TEXT_MUTED} textAnchor="end">{Math.round(max)}°</SvgText>
      <SvgText x={PAD_LEFT - 4} y={PAD_TOP + chartH + 3} fontSize={8} fill={C.TEXT_MUTED} textAnchor="end">{Math.round(min)}°</SvgText>
      {/* X-axis hour labels */}
      {labelItems.map(({ x, label }) => (
        <SvgText key={label} x={x} y={height - 2} fontSize={8} fill={C.TEXT_MUTED} textAnchor="middle">{label}</SvgText>
      ))}
    </Svg>
  );
}

// ─── Your Block Hero ──────────────────────────────────────────────────────────

function UserBlockHero({ reading }: { reading: BlockReading }) {
  const cfg = getThermalConfig(reading.thermalLevel);
  const trendColor = TREND_COLORS[reading.trend];
  const trendSym = TREND_SYMBOLS[reading.trend];
  const absDelta = Math.abs(reading.trendDelta);

  return (
    <View style={[styles.heroCard, { borderColor: cfg.color + '44' }]}>
      <View style={[styles.heroBadge, { backgroundColor: cfg.background }]}>
        <Text style={[styles.heroBadgeText, { color: cfg.color }]}>
          {cfg.emoji}  {cfg.label.toUpperCase()}
        </Text>
      </View>

      <View style={styles.heroBody}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroBlockName}>{reading.block.name}</Text>
          <Text style={styles.heroDistrict}>{reading.block.district}</Text>

          <Text style={[styles.heroTemp, { color: cfg.color }]}>
            {reading.heatIndex}°
            <Text style={styles.heroTempUnit}>F</Text>
          </Text>
          <Text style={styles.heroSubTemp}>Heat Index · Air {reading.temperature}°F</Text>
        </View>

        <View style={styles.heroRight}>
          <View style={styles.heroStatRow}>
            <Text style={[styles.heroTrend, { color: trendColor }]}>
              {trendSym} {absDelta > 0 ? `${absDelta}°/hr` : 'Stable'}
            </Text>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{reading.block.shadeScore}</Text>
              <Text style={styles.heroStatLabel}>Shade%</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{reading.uvIndex}</Text>
              <Text style={styles.heroStatLabel}>UV Idx</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{Math.round(reading.block.pavementRatio * 100)}</Text>
              <Text style={styles.heroStatLabel}>Paved%</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Sparkline */}
      <View style={styles.sparklineContainer}>
        <Text style={styles.sparklineLabel}>24-Hour Heat Index</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Sparkline
            data={reading.hourlyHistory}
            thermalColor={cfg.color}
            width={340}
            height={80}
          />
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Block Comparison Row ─────────────────────────────────────────────────────

function BlockRow({
  reading,
  userReading,
}: {
  reading: BlockReading;
  userReading: BlockReading;
}) {
  const cfg = getThermalConfig(reading.thermalLevel);
  const trendColor = TREND_COLORS[reading.trend];
  const trendSym = TREND_SYMBOLS[reading.trend];
  const comparison = compareToUserBlock(userReading, reading);

  return (
    <View style={styles.blockRow}>
      <View style={[styles.blockLevelBar, { backgroundColor: cfg.color }]} />
      <View style={styles.blockRowContent}>
        <View style={styles.blockRowLeft}>
          <Text style={styles.blockRowName}>{reading.block.name}</Text>
          <Text style={styles.blockRowDistrict}>{reading.block.district}</Text>
          <View style={styles.blockRowTagRow}>
            <Text style={styles.blockRowTagline} numberOfLines={1}>
              {reading.block.tagline}
            </Text>
          </View>
        </View>
        <View style={styles.blockRowRight}>
          <Text style={[styles.blockRowTemp, { color: cfg.color }]}>
            {reading.heatIndex}°
          </Text>
          <Text style={[styles.blockRowTrend, { color: trendColor }]}>
            {trendSym}
          </Text>
          <View style={[styles.blockDeltaBadge, { backgroundColor: comparison.safer ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }]}>
            <Text style={[styles.blockDeltaText, { color: comparison.safer ? C.SUCCESS : C.DANGER }]}>
              {comparison.safer ? '-' : '+'}{Math.abs(comparison.delta)}°
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Alert Row ────────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  onDismiss,
}: {
  alert: { id: string; blockName: string; message: string; severity: ThermalLevel };
  onDismiss: (id: string) => void;
}) {
  const cfg = getThermalConfig(alert.severity);
  return (
    <View style={[styles.alertRow, { borderLeftColor: cfg.color, backgroundColor: cfg.background }]}>
      <View style={styles.alertContent}>
        <Text style={[styles.alertBlockName, { color: cfg.color }]}>{alert.blockName}</Text>
        <Text style={styles.alertMessage}>{alert.message}</Text>
      </View>
      <TouchableOpacity onPress={() => onDismiss(alert.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.alertDismiss}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NeighborhoodHeatWatch() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<NeighborhoodSnapshot | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<NeighborhoodSnapshot['alerts']>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = await loadSnapshot();
      if (cached) {
        setSnapshot(cached);
        const active = await filterActiveAlerts(cached.alerts);
        setActiveAlerts(active);
        setLastUpdated(new Date(cached.generatedAt));
        setLoading(false);
        return;
      }
    }
    const fresh = computeNeighborhoodSnapshot(108, 20, 9);
    await saveSnapshot(fresh);
    const active = await filterActiveAlerts(fresh.alerts);
    setSnapshot(fresh);
    setActiveAlerts(active);
    setLastUpdated(new Date(fresh.generatedAt));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleDismissAlert = async (alertId: string) => {
    await dismissAlert(alertId);
    setActiveAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const userBlock = snapshot?.blocks.find((b) => b.block.isUserBlock);
  const otherBlocks = snapshot?.blocks.filter((b) => !b.block.isUserBlock) ?? [];

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Heat Watch</Text>
          {lastUpdated && (
            <Text style={styles.headerSub}>Updated {formatTime(lastUpdated)}</Text>
          )}
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} disabled={refreshing}>
          {refreshing ? (
            <ActivityIndicator size="small" color={C.ACCENT} />
          ) : (
            <Text style={styles.refreshIcon}>⟳</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.ACCENT} />
          <Text style={styles.loadingText}>Computing hyperlocal heat data…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Your Block Hero */}
          {userBlock && <UserBlockHero reading={userBlock} />}

          {/* Active Alerts */}
          {activeAlerts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Active Alerts
                <Text style={[styles.sectionBadge, { color: C.DANGER }]}> {activeAlerts.length}</Text>
              </Text>
              {activeAlerts.map((alert) => (
                <AlertRow key={alert.id} alert={alert} onDismiss={handleDismissAlert} />
              ))}
            </View>
          )}

          {/* Neighborhood Comparison */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Neighborhood Comparison</Text>
              <Text style={styles.sectionSubtitle}>vs your block</Text>
            </View>
            <View style={styles.card}>
              {otherBlocks.map((reading, index) => (
                <View key={reading.block.id}>
                  <BlockRow reading={reading} userReading={userBlock!} />
                  {index < otherBlocks.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>

          {/* Heat Factor Legend */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What Drives Block Heat</Text>
            <View style={styles.card}>
              {[
                { icon: '🏗', label: 'Pavement Ratio', detail: 'Asphalt and concrete absorb and radiate heat' },
                { icon: '🌳', label: 'Tree Canopy', detail: 'Shade score reduces UV and radiant heat' },
                { icon: '💧', label: 'Green Space', detail: 'Vegetation cools through evapotranspiration' },
                { icon: '🏢', label: 'Building Density', detail: 'Urban canyons trap heat and block airflow' },
              ].map((item, i, arr) => (
                <View key={item.label}>
                  <View style={styles.legendRow}>
                    <Text style={styles.legendIcon}>{item.icon}</Text>
                    <View style={styles.legendText}>
                      <Text style={styles.legendLabel}>{item.label}</Text>
                      <Text style={styles.legendDetail}>{item.detail}</Text>
                    </View>
                  </View>
                  {i < arr.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.BG,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.BORDER,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: C.TEXT,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: C.TEXT,
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 11,
    color: C.TEXT_MUTED,
    marginTop: 1,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 22,
    color: C.ACCENT,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: C.TEXT_DIM,
    fontSize: 15,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },

  // Hero Card
  heroCard: {
    backgroundColor: C.CARD,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 0,
  },
  heroBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroBody: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  heroLeft: {
    flex: 1,
  },
  heroBlockName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.TEXT,
    letterSpacing: 0.2,
  },
  heroDistrict: {
    fontSize: 11,
    color: C.TEXT_MUTED,
    marginBottom: 6,
  },
  heroTemp: {
    fontSize: 64,
    fontWeight: '700',
    lineHeight: 70,
    letterSpacing: -2,
  },
  heroTempUnit: {
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: 0,
  },
  heroSubTemp: {
    fontSize: 12,
    color: C.TEXT_DIM,
    marginTop: 4,
  },
  heroRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  heroStatRow: {
    alignItems: 'flex-end',
  },
  heroTrend: {
    fontSize: 18,
    fontWeight: '700',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStat: {
    alignItems: 'center',
  },
  heroStatVal: {
    fontSize: 20,
    fontWeight: '700',
    color: C.TEXT,
    fontVariant: ['tabular-nums'],
  },
  heroStatLabel: {
    fontSize: 9,
    color: C.TEXT_MUTED,
    marginTop: 1,
    letterSpacing: 0.5,
  },
  sparklineContainer: {
    borderTopWidth: 1,
    borderTopColor: C.BORDER,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  sparklineLabel: {
    fontSize: 10,
    color: C.TEXT_MUTED,
    letterSpacing: 0.5,
    marginBottom: 6,
    fontWeight: '500',
  },

  // Sections
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.TEXT,
    letterSpacing: 0.1,
  },
  sectionBadge: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: C.TEXT_MUTED,
  },

  // Cards
  card: {
    backgroundColor: C.CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.BORDER,
    overflow: 'hidden',
  },

  // Block Row
  blockRow: {
    flexDirection: 'row',
  },
  blockLevelBar: {
    width: 3,
  },
  blockRowContent: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  blockRowLeft: {
    flex: 1,
    gap: 2,
  },
  blockRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.TEXT,
  },
  blockRowDistrict: {
    fontSize: 11,
    color: C.TEXT_MUTED,
  },
  blockRowTagRow: {
    marginTop: 2,
  },
  blockRowTagline: {
    fontSize: 11,
    color: C.TEXT_DIM,
    fontStyle: 'italic',
  },
  blockRowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  blockRowTemp: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  blockRowTrend: {
    fontSize: 14,
    fontWeight: '600',
  },
  blockDeltaBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  blockDeltaText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Alert Row
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  alertContent: {
    flex: 1,
    gap: 3,
  },
  alertBlockName: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  alertMessage: {
    fontSize: 13,
    color: C.TEXT,
    lineHeight: 18,
  },
  alertDismiss: {
    fontSize: 16,
    color: C.TEXT_MUTED,
    paddingHorizontal: 4,
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  legendIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  legendText: {
    flex: 1,
    gap: 2,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.TEXT,
  },
  legendDetail: {
    fontSize: 12,
    color: C.TEXT_DIM,
    lineHeight: 17,
  },

  divider: {
    height: 1,
    backgroundColor: C.BORDER,
    marginLeft: 14,
  },

  bottomPad: {
    height: 40,
  },
});
