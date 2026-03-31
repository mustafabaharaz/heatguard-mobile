// ─────────────────────────────────────────────
// Heat-Safe Route Planner Screen
// Shade-aware routing with SVG map, route
// comparison cards, and segment breakdown
// ─────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, {
  Path,
  Circle,
  Rect,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';
import {
  computeRouteComparison,
  getRiskConfig,
  getSurfaceLabel,
  getSurfaceColor,
  formatDistance,
  WAYPOINTS,
  type Route,
  type RouteComparison,
  type Waypoint,
  type RouteSegment,
} from '../../src/features/routes/routePlannerEngine';
import {
  saveRecentComparison,
  saveLastWaypoints,
} from '../../src/features/routes/routePlannerStorage';

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  BG:          '#0F172A',
  CARD:        '#1E293B',
  CARD_RAISED: '#243044',
  BORDER:      '#334155',
  TEXT:        '#F1F5F9',
  TEXT_DIM:    '#94A3B8',
  TEXT_MUTED:  '#64748B',
  ACCENT:      '#3B82F6',
  SUCCESS:     '#22C55E',
  WARNING:     '#F59E0B',
  DANGER:      '#EF4444',
} as const;

const MAP_W = 320;
const MAP_H = 200;

// ─── SVG Route Map ────────────────────────────────────────────────────────────

function RouteMap({
  comparison,
  activeRouteId,
  from,
  to,
}: {
  comparison: RouteComparison;
  activeRouteId: string | null;
  from: Waypoint;
  to: Waypoint;
}) {
  const toSVG = (pct: number, dim: number) => (pct / 100) * dim;

  // Build SVG path string from segment points
  const buildPath = (segments: RouteSegment[]): string => {
    const all = segments.flatMap((s) => s.points);
    if (all.length < 2) return '';
    return all
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSVG(p.x, MAP_W).toFixed(1)} ${toSVG(p.y, MAP_H).toFixed(1)}`)
      .join(' ');
  };

  const fromX = toSVG(from.mapX, MAP_W);
  const fromY = toSVG(from.mapY, MAP_H);
  const toX   = toSVG(to.mapX, MAP_W);
  const toY   = toSVG(to.mapY, MAP_H);

  return (
    <Svg width={MAP_W} height={MAP_H}>
      <Defs>
        <LinearGradient id="mapBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#1A2E4A" />
          <Stop offset="100%" stopColor="#0F172A" />
        </LinearGradient>
      </Defs>

      {/* Background */}
      <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#mapBg)" rx={12} />

      {/* Street grid */}
      {[0.25, 0.5, 0.75].map((f) => (
        <G key={`grid-${f}`}>
          <Line x1={MAP_W * f} y1={0} x2={MAP_W * f} y2={MAP_H} stroke="#1E3A5F" strokeWidth={5} />
          <Line x1={0} y1={MAP_H * f} x2={MAP_W} y2={MAP_H * f} stroke="#1E3A5F" strokeWidth={5} />
          <Line x1={MAP_W * f} y1={0} x2={MAP_W * f} y2={MAP_H} stroke="#253D5B" strokeWidth={0.8} strokeDasharray="3,5" />
          <Line x1={0} y1={MAP_H * f} x2={MAP_W} y2={MAP_H * f} stroke="#253D5B" strokeWidth={0.8} strokeDasharray="3,5" />
        </G>
      ))}

      {/* Water feature */}
      <Rect x={MAP_W * 0.05} y={MAP_H * 0.42} width={MAP_W * 0.18} height={MAP_H * 0.1}
        fill="#1D4ED8" fillOpacity={0.28} rx={6} />

      {/* Routes — dim first, active on top */}
      {comparison.routes.map((route) => {
        const isActive = activeRouteId === null || route.id === activeRouteId;
        const pathStr = buildPath(route.segments);
        return (
          <Path
            key={route.id}
            d={pathStr}
            stroke={route.color}
            strokeWidth={isActive ? 3.5 : 1.5}
            strokeOpacity={isActive ? 0.9 : 0.25}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={route.type === 'direct' ? undefined : undefined}
          />
        );
      })}

      {/* FROM pin */}
      <Circle cx={fromX} cy={fromY} r={10} fill={C.ACCENT} fillOpacity={0.2} />
      <Circle cx={fromX} cy={fromY} r={6}  fill={C.ACCENT} />
      <Circle cx={fromX} cy={fromY} r={2.5} fill="#fff" />
      <SvgText x={fromX} y={fromY - 13} fontSize={8} fill={C.TEXT} textAnchor="middle" fontWeight="bold">
        {from.shortLabel}
      </SvgText>

      {/* TO pin */}
      <Circle cx={toX}   cy={toY}   r={10} fill={C.SUCCESS} fillOpacity={0.2} />
      <Circle cx={toX}   cy={toY}   r={6}  fill={C.SUCCESS} />
      <Circle cx={toX}   cy={toY}   r={2.5} fill="#fff" />
      <SvgText x={toX} y={toY - 13} fontSize={8} fill={C.TEXT} textAnchor="middle" fontWeight="bold">
        {to.shortLabel}
      </SvgText>

      {/* Route legend */}
      {comparison.routes.map((r, i) => (
        <G key={`legend-${r.id}`}>
          <Rect x={6} y={MAP_H - 28 + i * 10} width={14} height={3} rx={1.5} fill={r.color} />
          <SvgText x={24} y={MAP_H - 26 + i * 10} fontSize={7} fill={C.TEXT_DIM}>{r.label}</SvgText>
        </G>
      ))}
    </Svg>
  );
}

// ─── Safety Score Ring ────────────────────────────────────────────────────────

function SafetyRing({ score, color, size = 56 }: { score: number; color: string; size?: number }) {
  const R = (size / 2) - 5;
  const circ = 2 * Math.PI * R;
  const dash = (score / 100) * circ;
  const cx = size / 2;

  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cx} r={R} stroke={color + '22'} strokeWidth={5} fill="none" />
      <Circle
        cx={cx} cy={cx} r={R}
        stroke={color}
        strokeWidth={5}
        fill="none"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
      <SvgText x={cx} y={cx + 5} fontSize={14} fontWeight="bold" fill={color} textAnchor="middle">
        {score}
      </SvgText>
    </Svg>
  );
}

// ─── Shade Bar ────────────────────────────────────────────────────────────────

function ShadeBar({ percent, color }: { percent: number; color: string }) {
  return (
    <View style={styles.shadeBarContainer}>
      <View style={styles.shadeBarBg}>
        <View style={[styles.shadeBarFill, { width: `${percent}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.shadeBarLabel, { color }]}>{percent}%</Text>
    </View>
  );
}

// ─── Route Card ───────────────────────────────────────────────────────────────

function RouteCard({
  route,
  isRecommended,
  isSelected,
  onSelect,
}: {
  route: Route;
  isRecommended: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const rCfg = getRiskConfig(route.riskLevel);

  return (
    <TouchableOpacity
      style={[
        styles.routeCard,
        { borderColor: isSelected ? route.color : C.BORDER },
        isSelected && { backgroundColor: route.color + '0A' },
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      {/* Recommended badge */}
      {isRecommended && (
        <View style={[styles.recommendedBadge, { backgroundColor: route.color + '22' }]}>
          <Text style={[styles.recommendedText, { color: route.color }]}>★ RECOMMENDED</Text>
        </View>
      )}

      <View style={styles.routeCardBody}>
        {/* Safety ring */}
        <SafetyRing score={route.safetyScore} color={route.color} />

        <View style={styles.routeCardCenter}>
          <Text style={styles.routeLabel}>{route.label}</Text>
          <Text style={styles.routeTagline}>{route.tagline}</Text>

          {/* Stats row */}
          <View style={styles.routeStatRow}>
            <Text style={styles.routeStat}>{route.totalDistanceMiles} mi</Text>
            <Text style={styles.routeStatDot}>·</Text>
            <Text style={styles.routeStat}>{route.estimatedMinutes} min</Text>
            <Text style={styles.routeStatDot}>·</Text>
            <Text style={[styles.routeStat, { color: rCfg.color }]}>{rCfg.label}</Text>
          </View>

          {/* Shade bar */}
          <View style={styles.shadeLabelRow}>
            <Text style={styles.shadePrefixLabel}>Shade</Text>
            <ShadeBar percent={route.overallShadePercent} color={route.color} />
          </View>
        </View>

        {/* UV + surface temp */}
        <View style={styles.routeMetrics}>
          <View style={styles.routeMetric}>
            <Text style={[styles.routeMetricVal, { color: route.color }]}>{route.uvExposure}</Text>
            <Text style={styles.routeMetricLabel}>UV dose</Text>
          </View>
          <View style={styles.routeMetric}>
            <Text style={styles.routeMetricVal}>{route.peakSurfaceTemp}°</Text>
            <Text style={styles.routeMetricLabel}>surface</Text>
          </View>
        </View>
      </View>

      {/* Segment breakdown — only when selected */}
      {isSelected && (
        <View style={styles.segmentBreakdown}>
          <Text style={styles.segmentBreakdownTitle}>Segment Breakdown</Text>
          {route.segments.map((seg, i) => {
            const surfColor = getSurfaceColor(seg.surface);
            return (
              <View key={seg.id} style={styles.segmentRow}>
                <View style={[styles.segmentDot, { backgroundColor: surfColor }]} />
                <View style={styles.segmentInfo}>
                  <View style={styles.segmentTopRow}>
                    <Text style={styles.segmentLabel}>{seg.label}</Text>
                    <Text style={styles.segmentDist}>{formatDistance(seg.distanceMiles)}</Text>
                  </View>
                  <View style={styles.segmentMeta}>
                    <Text style={[styles.segmentSurface, { color: surfColor }]}>
                      {getSurfaceLabel(seg.surface)}
                    </Text>
                    <Text style={styles.segmentShade}>{seg.shadePercent}% shade</Text>
                  </View>
                  <Text style={styles.segmentLandmark}>{seg.landmark}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Tips — only when selected */}
      {isSelected && route.tips.length > 0 && (
        <View style={styles.tipsSection}>
          <Text style={styles.tipsSectionTitle}>Safety Tips</Text>
          {route.tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={[styles.tipBullet, { color: route.color }]}>▸</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Waypoint Picker Modal ────────────────────────────────────────────────────

function WaypointModal({
  visible,
  title,
  excludeId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  excludeId: string | null;
  onSelect: (w: Waypoint) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {WAYPOINTS.filter((w) => w.id !== excludeId).map((w) => (
              <TouchableOpacity
                key={w.id}
                style={styles.waypointRow}
                onPress={() => { onSelect(w); onClose(); }}
                activeOpacity={0.75}
              >
                <View style={styles.waypointIcon}>
                  <Text style={styles.waypointIconText}>
                    {w.id === 'home' ? '⌂' : w.id.includes('lake') ? '~' : '●'}
                  </Text>
                </View>
                <View style={styles.waypointInfo}>
                  <Text style={styles.waypointLabel}>{w.label}</Text>
                  <Text style={styles.waypointDesc}>{w.description}</Text>
                </View>
                <Text style={styles.waypointChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RoutePlanner() {
  const router = useRouter();

  const [from, setFrom] = useState<Waypoint>(WAYPOINTS[0]);
  const [to,   setTo]   = useState<Waypoint>(WAYPOINTS[1]);
  const [comparison, setComparison] = useState<RouteComparison | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [fromModalOpen, setFromModalOpen] = useState(false);
  const [toModalOpen,   setToModalOpen]   = useState(false);
  const [computing, setComputing] = useState(false);

  const handleCompute = useCallback(async () => {
    if (from.id === to.id) return;
    setComputing(true);
    setComparison(null);
    setSelectedRouteId(null);
    // Simulate brief computation
    await new Promise((r) => setTimeout(r, 600));
    const result = computeRouteComparison(from, to, 108, 9);
    setComparison(result);
    setSelectedRouteId(result.recommended.id);
    await saveRecentComparison(result, from, to);
    await saveLastWaypoints(from.id, to.id);
    setComputing(false);
  }, [from, to]);

  const handleSwap = () => {
    const tmp = from;
    setFrom(to);
    setTo(tmp);
    setComparison(null);
    setSelectedRouteId(null);
  };

  const uvSavingsText = comparison
    ? `${comparison.uvSavings} UV units saved vs worst route`
    : null;

  const timeCostText = comparison && comparison.timeCostMinutes > 0
    ? `+${comparison.timeCostMinutes} min vs fastest`
    : comparison
    ? 'Fastest and safest'
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Route Planner</Text>
          <Text style={styles.headerSub}>108°F · UV 9 · 20% humidity</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Waypoint Selector ── */}
        <View style={styles.waypointSelector}>
          <TouchableOpacity style={styles.waypointBtn} onPress={() => setFromModalOpen(true)} activeOpacity={0.8}>
            <View style={[styles.waypointDotFrom]} />
            <View style={styles.waypointBtnContent}>
              <Text style={styles.waypointBtnLabel}>From</Text>
              <Text style={styles.waypointBtnValue}>{from.label}</Text>
            </View>
            <Text style={styles.waypointChevronInline}>›</Text>
          </TouchableOpacity>

          <View style={styles.waypointConnector}>
            <View style={styles.waypointConnectorLine} />
            <TouchableOpacity style={styles.swapBtn} onPress={handleSwap} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.swapIcon}>⇅</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.waypointBtn} onPress={() => setToModalOpen(true)} activeOpacity={0.8}>
            <View style={styles.waypointDotTo} />
            <View style={styles.waypointBtnContent}>
              <Text style={styles.waypointBtnLabel}>To</Text>
              <Text style={styles.waypointBtnValue}>{to.label}</Text>
            </View>
            <Text style={styles.waypointChevronInline}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Compute Button ── */}
        <TouchableOpacity
          style={[styles.computeBtn, (from.id === to.id || computing) && styles.computeBtnDisabled]}
          onPress={handleCompute}
          disabled={from.id === to.id || computing}
          activeOpacity={0.8}
        >
          <Text style={styles.computeBtnText}>
            {computing ? 'Analyzing routes…' : 'Find Safest Route'}
          </Text>
        </TouchableOpacity>

        {/* ── Results ── */}
        {comparison && (
          <>
            {/* SVG Map */}
            <View style={styles.mapCard}>
              <RouteMap
                comparison={comparison}
                activeRouteId={selectedRouteId}
                from={from}
                to={to}
              />
            </View>

            {/* Summary Banner */}
            <View style={[styles.summaryBanner, { borderColor: comparison.recommended.color + '44' }]}>
              <View style={styles.summaryLeft}>
                <Text style={styles.summaryTitle}>Best Route</Text>
                <Text style={[styles.summaryRoute, { color: comparison.recommended.color }]}>
                  {comparison.recommended.label}
                </Text>
              </View>
              <View style={styles.summaryRight}>
                {uvSavingsText && <Text style={styles.summaryStat}>{uvSavingsText}</Text>}
                {timeCostText  && <Text style={styles.summaryStat}>{timeCostText}</Text>}
              </View>
            </View>

            {/* Route Cards */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Route Comparison</Text>
              {comparison.routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  isRecommended={route.id === comparison.recommended.id}
                  isSelected={route.id === selectedRouteId}
                  onSelect={() => setSelectedRouteId(route.id === selectedRouteId ? null : route.id)}
                />
              ))}
            </View>

            {/* Heat Context */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Conditions</Text>
              <View style={styles.conditionsCard}>
                {[
                  { label: 'Air Temperature', value: `${comparison.temperatureF}°F`, color: '#EF4444' },
                  { label: 'UV Index',         value: `${comparison.uvIndex} (Very High)`, color: '#F59E0B' },
                  { label: 'Best time to walk', value: 'Before 8 AM or after 7 PM', color: C.SUCCESS },
                ].map((item, i, arr) => (
                  <View key={item.label}>
                    <View style={styles.conditionRow}>
                      <Text style={styles.conditionLabel}>{item.label}</Text>
                      <Text style={[styles.conditionValue, { color: item.color }]}>{item.value}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Waypoint Modals */}
      <WaypointModal
        visible={fromModalOpen}
        title="Select Starting Point"
        excludeId={to.id}
        onSelect={setFrom}
        onClose={() => setFromModalOpen(false)}
      />
      <WaypointModal
        visible={toModalOpen}
        title="Select Destination"
        excludeId={from.id}
        onSelect={setTo}
        onClose={() => setToModalOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.BORDER,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: C.TEXT },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: C.TEXT, letterSpacing: 0.3 },
  headerSub: { fontSize: 11, color: C.TEXT_MUTED, marginTop: 1 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },

  // Waypoint selector
  waypointSelector: {
    backgroundColor: C.CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.BORDER,
    overflow: 'hidden',
  },
  waypointBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  waypointDotFrom: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.ACCENT,
    flexShrink: 0,
  },
  waypointDotTo: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.SUCCESS,
    flexShrink: 0,
  },
  waypointBtnContent: { flex: 1 },
  waypointBtnLabel: { fontSize: 10, color: C.TEXT_MUTED, fontWeight: '600', letterSpacing: 0.8 },
  waypointBtnValue: { fontSize: 15, fontWeight: '600', color: C.TEXT, marginTop: 1 },
  waypointChevronInline: { fontSize: 20, color: C.TEXT_MUTED },

  waypointConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 1,
  },
  waypointConnectorLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.BORDER,
    marginLeft: 24,
  },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.CARD_RAISED,
    borderWidth: 1,
    borderColor: C.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  swapIcon: { fontSize: 16, color: C.ACCENT },

  // Compute button
  computeBtn: {
    backgroundColor: C.ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  computeBtnDisabled: { opacity: 0.4 },
  computeBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },

  // Map
  mapCard: {
    backgroundColor: C.CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.BORDER,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 12,
  },

  // Summary banner
  summaryBanner: {
    backgroundColor: C.CARD,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryLeft: { flex: 1 },
  summaryTitle: { fontSize: 11, color: C.TEXT_MUTED, fontWeight: '600', letterSpacing: 0.8 },
  summaryRoute: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  summaryRight: { gap: 4, alignItems: 'flex-end' },
  summaryStat: { fontSize: 11, color: C.TEXT_DIM },

  // Section
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.TEXT },

  // Route card
  routeCard: {
    backgroundColor: C.CARD,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  recommendedBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
  },
  recommendedText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  routeCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  routeCardCenter: { flex: 1, gap: 6 },
  routeLabel: { fontSize: 15, fontWeight: '700', color: C.TEXT },
  routeTagline: { fontSize: 11, color: C.TEXT_MUTED },
  routeStatRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeStat: { fontSize: 12, color: C.TEXT_DIM },
  routeStatDot: { color: C.TEXT_MUTED, fontSize: 10 },
  shadeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shadePrefixLabel: { fontSize: 10, color: C.TEXT_MUTED, width: 32 },
  shadeBarContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  shadeBarBg: { flex: 1, height: 5, backgroundColor: C.BORDER, borderRadius: 3, overflow: 'hidden' },
  shadeBarFill: { height: 5, borderRadius: 3 },
  shadeBarLabel: { fontSize: 10, fontWeight: '700', width: 28, textAlign: 'right' },
  routeMetrics: { alignItems: 'flex-end', gap: 6 },
  routeMetric: { alignItems: 'center' },
  routeMetricVal: { fontSize: 18, fontWeight: '700', color: C.TEXT, fontVariant: ['tabular-nums'] },
  routeMetricLabel: { fontSize: 9, color: C.TEXT_MUTED, letterSpacing: 0.3 },

  // Segment breakdown
  segmentBreakdown: {
    borderTopWidth: 1,
    borderTopColor: C.BORDER,
    padding: 14,
    gap: 12,
  },
  segmentBreakdownTitle: { fontSize: 12, fontWeight: '700', color: C.TEXT_DIM, letterSpacing: 0.5 },
  segmentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  segmentDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  segmentInfo: { flex: 1, gap: 2 },
  segmentTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  segmentLabel: { fontSize: 13, fontWeight: '600', color: C.TEXT },
  segmentDist: { fontSize: 12, color: C.TEXT_DIM },
  segmentMeta: { flexDirection: 'row', gap: 8 },
  segmentSurface: { fontSize: 11, fontWeight: '500' },
  segmentShade: { fontSize: 11, color: C.TEXT_MUTED },
  segmentLandmark: { fontSize: 11, color: C.TEXT_MUTED, fontStyle: 'italic' },

  // Tips
  tipsSection: {
    borderTopWidth: 1,
    borderTopColor: C.BORDER,
    padding: 14,
    gap: 8,
  },
  tipsSectionTitle: { fontSize: 12, fontWeight: '700', color: C.TEXT_DIM, letterSpacing: 0.5 },
  tipRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  tipBullet: { fontSize: 12, marginTop: 1, flexShrink: 0 },
  tipText: { flex: 1, fontSize: 13, color: C.TEXT_DIM, lineHeight: 18 },

  // Conditions card
  conditionsCard: {
    backgroundColor: C.CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.BORDER,
    overflow: 'hidden',
  },
  conditionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  conditionLabel: { fontSize: 13, color: C.TEXT_DIM },
  conditionValue: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1, backgroundColor: C.BORDER, marginLeft: 14 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.BORDER,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.TEXT,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.BORDER,
  },
  waypointIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waypointIconText: { fontSize: 16, color: C.ACCENT },
  waypointInfo: { flex: 1 },
  waypointLabel: { fontSize: 14, fontWeight: '600', color: C.TEXT },
  waypointDesc: { fontSize: 12, color: C.TEXT_MUTED, marginTop: 1 },
  waypointChevron: { fontSize: 20, color: C.TEXT_MUTED },

  bottomPad: { height: 40 },
});
