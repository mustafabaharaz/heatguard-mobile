// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Heat Forecast Screen
// 5-day personalised forecast. Each day shows: a directive banner, hourly
// SVG risk chart, activity windows (danger / safe), and a personalised tip
// derived from the user's heat profile.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, {
  Rect,
  Line,
  Text as SvgText,
  G,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import {
  generateForecast,
  hourToLabel,
  DayForecast,
  ThermalLevel,
  ProfileInput,
} from '../../src/features/intelligence/forecastEngine';
import {
  saveLastViewedDay,
  getLastViewedDay,
} from '../../src/features/intelligence/storage/forecastStorage';
import { getHeatProfile, getRiskMultiplier } from '../../src/features/profile/storage/profileStorage';

// ── Design tokens ──────────────────────────────────────────────────────────

const C = {
  navy:         '#0A1628',
  navyMid:      '#1A2B4A',
  navyLight:    '#243856',
  accent:       '#3B82F6',
  border:       '#2D3F5C',
  text:         '#FFFFFF',
  textSub:      '#94A3B8',
  textMuted:    '#64748B',
};

const THERMAL: Record<ThermalLevel, { bg: string; light: string; label: string }> = {
  safe:      { bg: '#16A34A', light: 'rgba(22,163,74,0.15)',   label: 'Safe'       },
  caution:   { bg: '#D97706', light: 'rgba(217,119,6,0.15)',   label: 'Caution'    },
  highAlert: { bg: '#EA580C', light: 'rgba(234,88,12,0.15)',   label: 'High Alert' },
  extreme:   { bg: '#DC2626', light: 'rgba(220,38,38,0.15)',   label: 'Extreme'    },
  crisis:    { bg: '#7C2D12', light: 'rgba(124,45,18,0.15)',   label: 'Crisis'     },
};

const LEVEL_ORDER: ThermalLevel[] = ['safe', 'caution', 'highAlert', 'extreme', 'crisis'];

// ── Hourly SVG chart ───────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_OUTER_PAD = 20; // horizontal screen padding
const CHART_CARD_PAD  = 16; // card inner padding
const CHART_W = Math.min(SCREEN_W - CHART_OUTER_PAD * 2 - CHART_CARD_PAD * 2, 540);
const CHART_H = 110;        // bar area height
const LABEL_H = 22;         // x-axis label row height
const Y_OFFSET = 6;         // top breathing room

interface HourlyChartProps {
  hourly: DayForecast['hourly'];
  currentHour: number | null;
}

function HourlyChart({ hourly, currentHour }: HourlyChartProps) {
  const n       = hourly.length;                          // 18
  const slotW   = CHART_W / n;
  const barW    = Math.max(2, slotW - 2);
  const minTemp = 80;
  const maxTemp = 122;
  const tempRange = maxTemp - minTemp;

  const barHeight = (temp: number) =>
    Math.max(6, ((temp - minTemp) / tempRange) * CHART_H);

  const tickTemps = [80, 90, 100, 110, 120];

  return (
    <Svg width={CHART_W} height={CHART_H + LABEL_H + Y_OFFSET}>
      {/* Gradient definitions */}
      <Defs>
        {(Object.keys(THERMAL) as ThermalLevel[]).map(lvl => (
          <SvgLinearGradient key={lvl} id={`g_${lvl}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={THERMAL[lvl].bg} stopOpacity="1"   />
            <Stop offset="1"   stopColor={THERMAL[lvl].bg} stopOpacity="0.6" />
          </SvgLinearGradient>
        ))}
      </Defs>

      {/* Horizontal grid lines */}
      {tickTemps.map(t => {
        const y = Y_OFFSET + CHART_H - ((t - minTemp) / tempRange) * CHART_H;
        return (
          <Line
            key={t}
            x1={0} y1={y} x2={CHART_W} y2={y}
            stroke={C.border}
            strokeWidth={0.5}
            strokeDasharray="3,5"
          />
        );
      })}

      {/* Bars */}
      {hourly.map((h, i) => {
        const bH  = barHeight(h.effectiveTemp);
        const x   = i * slotW + (slotW - barW) / 2;
        const y   = Y_OFFSET + CHART_H - bH;
        const isNow = currentHour !== null && h.hour === currentHour;

        return (
          <G key={h.hour}>
            {/* "Now" highlight column */}
            {isNow && (
              <Rect
                x={i * slotW}
                y={Y_OFFSET}
                width={slotW}
                height={CHART_H}
                fill={THERMAL[h.level].bg}
                fillOpacity={0.12}
                rx={2}
              />
            )}
            {/* Temperature bar */}
            <Rect
              x={x}
              y={y}
              width={barW}
              height={bH}
              fill={`url(#g_${h.level})`}
              rx={2}
              opacity={0.9}
            />
          </G>
        );
      })}

      {/* X-axis labels every 3 hours */}
      {hourly.map((h, i) => {
        if (h.hour % 3 !== 0) return null;
        const cx = i * slotW + slotW / 2;
        const isNow = currentHour !== null && h.hour === currentHour;
        return (
          <SvgText
            key={`lbl_${h.hour}`}
            x={cx}
            y={CHART_H + LABEL_H + Y_OFFSET - 4}
            textAnchor="middle"
            fontSize={9}
            fill={isNow ? C.accent : C.textMuted}
            fontFamily="System"
            fontWeight={isNow ? '700' : '400'}
          >
            {hourToLabel(h.hour, true)}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ── Helper components ──────────────────────────────────────────────────────

function ThermalBadge({ level }: { level: ThermalLevel }) {
  return (
    <View style={[styles.thermalBadge, { backgroundColor: THERMAL[level].bg }]}>
      <Text style={styles.thermalBadgeText}>{THERMAL[level].label}</Text>
    </View>
  );
}

function DayChip({
  day,
  selected,
  onPress,
}: {
  day: DayForecast;
  selected: boolean;
  onPress: () => void;
}) {
  const tc = THERMAL[day.peakLevel];
  return (
    <TouchableOpacity
      style={[
        styles.dayChip,
        selected && styles.dayChipSelected,
        selected && { borderColor: tc.bg },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.dayChipDot, { backgroundColor: tc.bg }]} />
      <Text style={[styles.dayChipDay, selected && styles.dayChipDayActive]}>
        {day.dayLabel}
      </Text>
      <Text style={[styles.dayChipDate, selected && styles.dayChipDateActive]}>
        {day.dateLabel}
      </Text>
      <Text style={[styles.dayChipTemp, { color: tc.bg }]}>
        {day.highTemp}°
      </Text>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function ForecastScreen() {
  const router = useRouter();
  const [forecast,     setForecast]     = useState<DayForecast[]>([]);
  const [selectedDay,  setSelectedDay]  = useState(0);
  const [profileName,  setProfileName]  = useState('');
  const [loading,      setLoading]      = useState(true);

  const nowHour = new Date().getHours();

  // ── Load profile → generate forecast ────────────────────────────────────
  useEffect(() => {
    const raw = getHeatProfile();

    // Bridge HeatProfile (Phase 1) → ProfileInput (forecastEngine)
    const profile: ProfileInput = {
      name:          raw.name,
      age:           raw.age,
      activityLevel: raw.activityLevel as 'low' | 'moderate' | 'high',
      threshold:     raw.alertThreshold,
      conditions: [
        ...(raw.hasHeartDisease      ? ['heart disease'] : []),
        ...(raw.hasDiabetes          ? ['diabetes']      : []),
        ...(raw.hasRespiratoryIssues ? ['respiratory']   : []),
      ],
      medications: raw.takesMedications ? ['yes'] : [],
    };

    const multiplier = getRiskMultiplier(raw);
    if (profile.name) setProfileName(profile.name);

    const days = generateForecast(multiplier, profile);
    setForecast(days);

    const last = getLastViewedDay();
    setSelectedDay(last < days.length ? last : 0);
    setLoading(false);
  }, []);

  const selectDay = useCallback((i: number) => {
    setSelectedDay(i);
    saveLastViewedDay(i);
  }, []);

  // ── Guards ───────────────────────────────────────────────────────────────

  if (loading || forecast.length === 0) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Calculating your forecast…</Text>
          <Text style={styles.loadingSubText}>Personalising for your heat profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  const day = forecast[selectedDay];
  const tc  = THERMAL[day.peakLevel];

  // ── Render ───────────────────────────────────────────────────────────────

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
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Heat Forecast</Text>
          {profileName ? (
            <Text style={styles.headerSub}>for {profileName}</Text>
          ) : null}
        </View>
        <View style={styles.personalBadge}>
          <Text style={styles.personalBadgeText}>Personalised</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Day Selector ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayRow}
          style={styles.dayScroll}
        >
          {forecast.map((d, i) => (
            <DayChip
              key={i}
              day={d}
              selected={i === selectedDay}
              onPress={() => selectDay(i)}
            />
          ))}
        </ScrollView>

        {/* ── Directive Banner ── */}
        <View style={[styles.directive, { backgroundColor: tc.bg }]}>
          <View style={styles.directiveLeft}>
            <Text style={styles.directiveDayLabel}>{day.dayLabel.toUpperCase()}</Text>
            <Text style={styles.directiveText}>{day.directive}</Text>
          </View>
          <View style={styles.directiveRight}>
            <Text style={styles.directiveHighTemp}>{day.highTemp}°F</Text>
            <Text style={styles.directiveLevelText}>{tc.label}</Text>
          </View>
        </View>

        {/* ── Quick Stats Row ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Low</Text>
            <Text style={styles.statValue}>{day.lowTemp}°F</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>High</Text>
            <Text style={[styles.statValue, { color: tc.bg }]}>{day.highTemp}°F</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={[styles.statCard, { gap: 6 }]}>
            <Text style={styles.statLabel}>Peak Risk</Text>
            <ThermalBadge level={day.peakLevel} />
          </View>
        </View>

        {/* ── Hourly Risk Chart ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Hourly Risk</Text>
            <Text style={styles.sectionHint}>Effective felt temperature</Text>
          </View>

          <View style={styles.chartCard}>
            <HourlyChart
              hourly={day.hourly}
              currentHour={selectedDay === 0 ? nowHour : null}
            />
            {selectedDay === 0 && nowHour >= 5 && nowHour <= 22 && (
              <Text style={styles.nowLabel}>
                {hourToLabel(nowHour)} now
              </Text>
            )}
            {/* Legend */}
            <View style={styles.legend}>
              {(LEVEL_ORDER as ThermalLevel[]).map(lvl => (
                <View key={lvl} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: THERMAL[lvl].bg }]} />
                  <Text style={styles.legendText}>{THERMAL[lvl].label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Activity Windows ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Windows</Text>
          <View style={styles.windowsRow}>

            {/* Danger window */}
            <View style={styles.dangerWindow}>
              <View style={styles.windowHeader}>
                <View style={[styles.windowDot, { backgroundColor: '#DC2626' }]} />
                <Text style={styles.dangerWindowLabel}>AVOID OUTDOORS</Text>
              </View>
              <Text style={styles.windowTime}>
                {day.dangerStart !== null && day.dangerEnd !== null
                  ? `${hourToLabel(day.dangerStart)} – ${hourToLabel(day.dangerEnd)}`
                  : 'No extreme risk today'}
              </Text>
            </View>

            {/* Safe window */}
            <View style={styles.safeWindow}>
              <View style={styles.windowHeader}>
                <View style={[styles.windowDot, { backgroundColor: '#16A34A' }]} />
                <Text style={styles.safeWindowLabel}>BEST WINDOW</Text>
              </View>
              <Text style={styles.windowTime}>
                {day.safeStart !== null && day.safeEnd !== null
                  ? `${hourToLabel(day.safeStart)} – ${hourToLabel(day.safeEnd)}`
                  : 'Limited safe hours'}
              </Text>
            </View>

          </View>
        </View>

        {/* ── Personal Advisory ── */}
        <View style={styles.section}>
          <View style={styles.advisoryCard}>
            <View style={styles.advisoryHeader}>
              <View style={[styles.advisoryAccent, { backgroundColor: C.accent }]} />
              <Text style={styles.advisoryTitle}>
                {profileName ? `Advisory for ${profileName}` : 'Personal Advisory'}
              </Text>
            </View>
            <Text style={styles.advisoryText}>{day.personalizedTip}</Text>
          </View>
        </View>

        {/* ── Week Overview strip ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5-Day Overview</Text>
          <View style={styles.weekStrip}>
            {forecast.map((d, i) => {
              const levelIdx  = LEVEL_ORDER.indexOf(d.peakLevel);
              const isToday   = i === 0;
              const isSelected = i === selectedDay;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.weekDay, isSelected && styles.weekDaySelected]}
                  onPress={() => selectDay(i)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.weekDayLabel, isSelected && styles.weekDayLabelActive]}>
                    {isToday ? 'TODAY' : d.dayLabel.toUpperCase()}
                  </Text>
                  <View style={styles.weekBarTrack}>
                    <View
                      style={[
                        styles.weekBar,
                        {
                          height: `${20 + levelIdx * 20}%` as any,
                          backgroundColor: THERMAL[d.peakLevel].bg,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.weekTemp, { color: THERMAL[d.peakLevel].bg }]}>
                    {d.highTemp}°
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Footer ── */}
        <Text style={styles.footerNote}>
          Risk levels are personalised using your heat profile. Adjust your profile to improve accuracy.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.navy,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingSubText: {
    color: C.textMuted,
    fontSize: 13,
  },

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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.navyMid,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  backIcon: {
    color: C.text,
    fontSize: 20,
    lineHeight: 22,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSub: {
    color: C.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  personalBadge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
  },
  personalBadgeText: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '600',
  },

  // Scroll
  scroll: {
    paddingTop: 4,
  },

  // Day selector
  dayScroll: {
    maxHeight: 108,
  },
  dayRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 10,
  },
  dayChip: {
    alignItems: 'center',
    backgroundColor: C.navyMid,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    minWidth: 72,
    gap: 3,
  },
  dayChipSelected: {
    backgroundColor: C.navyLight,
    borderWidth: 2,
  },
  dayChipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginBottom: 2,
  },
  dayChipDay: {
    color: C.textSub,
    fontSize: 13,
    fontWeight: '600',
  },
  dayChipDayActive: {
    color: C.text,
  },
  dayChipDate: {
    color: C.textMuted,
    fontSize: 10,
  },
  dayChipDateActive: {
    color: C.textSub,
  },
  dayChipTemp: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },

  // Directive banner
  directive: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  directiveLeft: {
    flex: 1,
    gap: 4,
  },
  directiveDayLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  directiveText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    maxWidth: 200,
  },
  directiveRight: {
    alignItems: 'flex-end',
    gap: 2,
    paddingLeft: 12,
  },
  directiveHighTemp: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  directiveLevelText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: C.navyMid,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: C.border,
    marginVertical: 10,
  },
  statLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    color: C.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  thermalBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  thermalBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Section
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  sectionHint: {
    color: C.textMuted,
    fontSize: 11,
    marginBottom: 10,
  },

  // Chart
  chartCard: {
    backgroundColor: C.navyMid,
    borderRadius: 16,
    padding: CHART_CARD_PAD,
    borderWidth: 1,
    borderColor: C.border,
  },
  nowLabel: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 4,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 10,
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    color: C.textMuted,
    fontSize: 10,
  },

  // Windows
  windowsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dangerWindow: {
    flex: 1,
    backgroundColor: 'rgba(220,38,38,0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
    gap: 6,
  },
  safeWindow: {
    flex: 1,
    backgroundColor: 'rgba(22,163,74,0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.25)',
    gap: 6,
  },
  windowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  windowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dangerWindowLabel: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  safeWindowLabel: {
    color: '#4ADE80',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  windowTime: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // Advisory
  advisoryCard: {
    backgroundColor: C.navyMid,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  advisoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  advisoryAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  advisoryTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  advisoryText: {
    color: C.textSub,
    fontSize: 14,
    lineHeight: 22,
  },

  // Week strip
  weekStrip: {
    backgroundColor: C.navyMid,
    borderRadius: 16,
    flexDirection: 'row',
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    borderRadius: 10,
  },
  weekDaySelected: {
    backgroundColor: C.navyLight,
  },
  weekDayLabel: {
    color: C.textMuted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  weekDayLabelActive: {
    color: C.text,
  },
  weekBarTrack: {
    width: 10,
    height: 40,
    backgroundColor: C.border,
    borderRadius: 5,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weekBar: {
    width: '100%',
    borderRadius: 5,
  },
  weekTemp: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Footer
  footerNote: {
    color: C.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 36,
    marginTop: 20,
    lineHeight: 18,
  },
});
