import haptics from '../../src/utils/haptics';
import AnimatedEntrance from '../../src/components/ui/AnimatedEntrance';
import PressableScale from '../../src/components/ui/PressableScale';
// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Activity Safety Planner
// Pick an activity and duration — the engine scores every 30-min window
// across today and tomorrow and surfaces the safest times to go outside.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback } from 'react';
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
import {
  ACTIVITIES,
  DURATIONS_MIN,
  ActivityType,
  DurationMin,
  ActivityWindow,
  WindowVerdict,
  planActivity,
  formatWindowRange,
  getNowSlot,
} from '../../src/features/intelligence/activityPlannerEngine';
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

const VERDICT_CONFIG: Record<WindowVerdict, {
  bg: string; border: string; label: string; labelColor: string; dotColor: string;
}> = {
  recommended: {
    bg: 'rgba(22,163,74,0.10)',  border: 'rgba(22,163,74,0.30)',
    label: 'Recommended', labelColor: '#4ADE80', dotColor: '#16A34A',
  },
  acceptable: {
    bg: 'rgba(217,119,6,0.10)',  border: 'rgba(217,119,6,0.30)',
    label: 'Acceptable',  labelColor: '#FCD34D', dotColor: '#D97706',
  },
  caution: {
    bg: 'rgba(234,88,12,0.10)',  border: 'rgba(234,88,12,0.30)',
    label: 'Caution',     labelColor: '#FB923C', dotColor: '#EA580C',
  },
  avoid: {
    bg: 'rgba(220,38,38,0.10)',  border: 'rgba(220,38,38,0.25)',
    label: 'Avoid',       labelColor: '#F87171', dotColor: '#DC2626',
  },
};

const { width: SCREEN_W } = Dimensions.get('window');

// ── Best window banner ─────────────────────────────────────────────────────

function BestWindowBanner({ window: w }: { window: ActivityWindow }) {
  const vc = VERDICT_CONFIG[w.verdict];
  return (
    <View style={[styles.bestBanner, { backgroundColor: vc.dotColor }]}>
      <View style={styles.bestBannerLeft}>
        <Text style={styles.bestBannerEyebrow}>BEST TIME TO GO OUT</Text>
        <Text style={styles.bestBannerTime}>
          {w.dayLabel} · {formatWindowRange(w.startHour, w.startMin, w.endHour, w.endMin)}
        </Text>
        <Text style={styles.bestBannerSub}>
          {w.peakEffectiveTemp}°F peak · {w.waterNeeded} oz water
          {w.breaksNeeded > 0 ? ` · ${w.breaksNeeded} break${w.breaksNeeded > 1 ? 's' : ''}` : ''}
        </Text>
      </View>
      <Text style={styles.bestBannerBigTemp}>{w.peakEffectiveTemp}°</Text>
    </View>
  );
}

// ── Window row ─────────────────────────────────────────────────────────────

function WindowRow({
  window: w,
  isNow,
  isFirst,
}: {
  window: ActivityWindow;
  isNow: boolean;
  isFirst: boolean;
}) {
  const vc = VERDICT_CONFIG[w.verdict];

  return (
    <View style={[
      styles.windowRow,
      { backgroundColor: vc.bg, borderColor: vc.border },
      isNow && styles.windowRowNow,
    ]}>
      {/* Left: time */}
      <View style={styles.windowLeft}>
        <View style={styles.windowDayRow}>
          <Text style={styles.windowDay}>{w.dayLabel}</Text>
          {isNow && (
            <View style={styles.nowPill}>
              <Text style={styles.nowPillText}>NOW</Text>
            </View>
          )}
          {isFirst && !isNow && (
            <View style={styles.topPickPill}>
              <Text style={styles.topPickText}>TOP PICK</Text>
            </View>
          )}
        </View>
        <Text style={styles.windowTime}>
          {formatWindowRange(w.startHour, w.startMin, w.endHour, w.endMin)}
        </Text>
      </View>

      {/* Centre: verdict */}
      <View style={styles.windowCentre}>
        <View style={styles.verdictRow}>
          <View style={[styles.verdictDot, { backgroundColor: vc.dotColor }]} />
          <Text style={[styles.verdictLabel, { color: vc.labelColor }]}>{vc.label}</Text>
        </View>
        <Text style={styles.windowTemp}>{w.peakEffectiveTemp}°F felt</Text>
      </View>

      {/* Right: water + breaks */}
      <View style={styles.windowRight}>
        <Text style={styles.windowMeta}>💧 {w.waterNeeded} oz</Text>
        {w.breaksNeeded > 0 && (
          <Text style={styles.windowMeta}>🌿 {w.breaksNeeded} break{w.breaksNeeded > 1 ? 's' : ''}</Text>
        )}
      </View>
    </View>
  );
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({
  verdict,
  count,
}: {
  verdict: WindowVerdict;
  count: number;
}) {
  const vc = VERDICT_CONFIG[verdict];
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionDot, { backgroundColor: vc.dotColor }]} />
      <Text style={[styles.sectionLabel, { color: vc.labelColor }]}>
        {vc.label}
      </Text>
      <Text style={styles.sectionCount}>{count} window{count !== 1 ? 's' : ''}</Text>
    </View>
  );
}

// ── No safe windows card ───────────────────────────────────────────────────

function NoDaytimeSafeCard() {
  return (
    <View style={styles.noSafeCard}>
      <Text style={styles.noSafeIcon}>⚠️</Text>
      <Text style={styles.noSafeTitle}>No safe windows found</Text>
      <Text style={styles.noSafeSub}>
        Conditions across today and tomorrow are too dangerous for outdoor activity given your health profile. Consider indoor alternatives.
      </Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function ActivityPlannerScreen() {
  const router = useRouter();

  const raw         = getHeatProfile();
  const multiplier  = getRiskMultiplier(raw);

  const [activityId, setActivityId] = useState<ActivityType>('walking');
  const [duration,   setDuration]   = useState<DurationMin>(60);

  // Only show the first 3 avoid windows to avoid overwhelming the list
  const [showAllAvoid, setShowAllAvoid] = useState(false);

  const nowSlot = getNowSlot();

  // ── Plan ────────────────────────────────────────────────────────────────
  const windows = useMemo(
    () => planActivity(activityId, duration, multiplier),
    [activityId, duration, multiplier],
  );

  const groups = useMemo(() => ({
    recommended: windows.filter(w => w.verdict === 'recommended'),
    acceptable:  windows.filter(w => w.verdict === 'acceptable'),
    caution:     windows.filter(w => w.verdict === 'caution'),
    avoid:       windows.filter(w => w.verdict === 'avoid'),
  }), [windows]);

  const bestWindow = windows.find(w => w.verdict === 'recommended' || w.verdict === 'acceptable');
  const hasSafe    = groups.recommended.length + groups.acceptable.length > 0;

  const isNowWindow = useCallback((w: ActivityWindow) =>
    w.dayLabel === 'Today' &&
    w.startHour === nowSlot.hour &&
    w.startMin  === nowSlot.min,
  [nowSlot]);

  const isFirstOverall = useCallback((w: ActivityWindow) =>
    windows.indexOf(w) === 0,
  [windows]);

  const selectedActivity = ACTIVITIES.find(a => a.id === activityId)!;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>

      {/* Header */}
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
          <Text style={styles.headerTitle}>Activity Planner</Text>
          <Text style={styles.headerSub}>Find your safest outdoor window</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Activity Picker ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>
          <View style={styles.activityGrid}>
            {ACTIVITIES.map(act => {
              const selected = act.id === activityId;
              return (
                <TouchableOpacity
                  key={act.id}
                  style={[styles.activityChip, selected && styles.activityChipSelected]}
                  onPress={() => setActivityId(act.id)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={act.label}
                >
                  <Text style={styles.activityChipIcon}>{act.icon}</Text>
                  <Text style={[styles.activityChipLabel, selected && styles.activityChipLabelSelected]}>
                    {act.label}
                  </Text>
                  {selected && (
                    <View style={styles.activityIntensityBadge}>
                      <Text style={styles.activityIntensityText}>
                        +{Math.round((selectedActivity.intensityMultiplier - 1) * 100)}% heat
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Duration Picker ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration</Text>
          <View style={styles.durationRow}>
            {DURATIONS_MIN.map(d => {
              const selected = d === duration;
              const label = d < 60 ? `${d}m` : d === 60 ? '1 hr' : `${d / 60 % 1 === 0 ? d / 60 : (d / 60).toFixed(1)} hr`;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.durationChip, selected && styles.durationChipSelected]}
                  onPress={() => setDuration(d)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${d} minutes`}
                >
                  <Text style={[styles.durationLabel, selected && styles.durationLabelSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Profile info strip ── */}
        {raw.profileComplete && (
          <View style={styles.profileStrip}>
            <Text style={styles.profileStripText}>
              Risk multiplier for {raw.name}: ×{multiplier.toFixed(2)} — windows scored accordingly
            </Text>
          </View>
        )}

        {/* ── Best Window Banner ── */}
        {bestWindow ? (
          <View style={styles.section}>
            <BestWindowBanner window={bestWindow} />
          </View>
        ) : (
          <View style={styles.section}>
            <NoDaytimeSafeCard />
          </View>
        )}

        {/* ── Window list by verdict ── */}
        {((['recommended', 'acceptable', 'caution'] as WindowVerdict[]).map(verdict => {
          const group = groups[verdict];
          if (group.length === 0) return null;
          return (
            <View key={verdict} style={styles.section}>
              <SectionHeader verdict={verdict} count={group.length} />
              <View style={styles.windowList}>
                {group.map((w, i) => (
                  <WindowRow
                    key={`${w.dayLabel}-${w.startHour}-${w.startMin}`}
                    window={w}
                    isNow={isNowWindow(w)}
                    isFirst={isFirstOverall(w)}
                  />
                ))}
              </View>
            </View>
          );
        }))}

        {/* ── Avoid section — collapsed by default ── */}
        {groups.avoid.length > 0 && (
          <View style={styles.section}>
            <SectionHeader verdict="avoid" count={groups.avoid.length} />
            <View style={styles.windowList}>
              {(showAllAvoid ? groups.avoid : groups.avoid.slice(0, 3)).map(w => (
                <WindowRow
                  key={`${w.dayLabel}-${w.startHour}-${w.startMin}`}
                  window={w}
                  isNow={isNowWindow(w)}
                  isFirst={false}
                />
              ))}
            </View>
            {!showAllAvoid && groups.avoid.length > 3 && (
              <TouchableOpacity
                style={styles.showMoreBtn}
                onPress={() => setShowAllAvoid(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.showMoreText}>
                  Show {groups.avoid.length - 3} more dangerous windows
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Safety tips for chosen activity ── */}
        <View style={styles.section}>
          <View style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <View style={styles.tipsAccent} />
              <Text style={styles.tipsTitle}>{selectedActivity.icon} {selectedActivity.label} Safety Tips</Text>
            </View>
            <View style={styles.tipsList}>
              <Text style={styles.tipItem}>
                • Drink {selectedActivity.waterOzPerHour} oz of water per hour — start hydrating 30 min before heading out.
              </Text>
              <Text style={styles.tipItem}>
                • Take a shade break every {selectedActivity.breakInterval} minutes, even if you feel fine.
              </Text>
              <Text style={styles.tipItem}>
                • Wear light-coloured, loose-fitting, moisture-wicking clothing.
              </Text>
              <Text style={styles.tipItem}>
                • Stop immediately if you experience dizziness, nausea, or stop sweating.
              </Text>
              {selectedActivity.id === 'running' || selectedActivity.id === 'cycling' ? (
                <Text style={styles.tipItem}>
                  • Reduce your target pace by 20–30% — heat significantly increases cardiovascular load.
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <Text style={styles.footerNote}>
          Windows scored using your heat profile risk multiplier and a Phoenix-area temperature model. Actual conditions may vary.
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
  headerTextWrap: {
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

  // Scroll
  scroll: {
    paddingTop: 8,
  },

  // Section
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },

  // Activity picker
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.navyMid,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: C.border,
    gap: 7,
    minWidth: (SCREEN_W - 40 - 10) / 2 - 2,
  },
  activityChipSelected: {
    backgroundColor: C.navyLight,
    borderColor: C.accent,
  },
  activityChipIcon: {
    fontSize: 18,
  },
  activityChipLabel: {
    color: C.textSub,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  activityChipLabelSelected: {
    color: C.text,
  },
  activityIntensityBadge: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activityIntensityText: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '700',
  },

  // Duration picker
  durationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  durationChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.navyMid,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  durationChipSelected: {
    backgroundColor: C.navyLight,
    borderColor: C.accent,
  },
  durationLabel: {
    color: C.textSub,
    fontSize: 14,
    fontWeight: '600',
  },
  durationLabelSelected: {
    color: C.text,
  },

  // Profile strip
  profileStrip: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  profileStripText: {
    color: C.textSub,
    fontSize: 12,
  },

  // Best banner
  bestBanner: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bestBannerLeft: {
    flex: 1,
    gap: 4,
  },
  bestBannerEyebrow: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bestBannerTime: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  bestBannerSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  bestBannerBigTemp: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    paddingLeft: 12,
  },

  // No safe card
  noSafeCard: {
    backgroundColor: 'rgba(220,38,38,0.10)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
    alignItems: 'center',
    gap: 8,
  },
  noSafeIcon: {
    fontSize: 32,
  },
  noSafeTitle: {
    color: '#F87171',
    fontSize: 16,
    fontWeight: '700',
  },
  noSafeSub: {
    color: C.textSub,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  sectionCount: {
    color: C.textMuted,
    fontSize: 12,
  },

  // Window list
  windowList: {
    gap: 8,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  windowRowNow: {
    borderWidth: 2,
  },
  windowLeft: {
    flex: 1.2,
    gap: 2,
  },
  windowDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  windowDay: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  nowPill: {
    backgroundColor: C.accent,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  nowPillText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  topPickPill: {
    backgroundColor: 'rgba(22,163,74,0.25)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  topPickText: {
    color: '#4ADE80',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  windowTime: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  windowCentre: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verdictDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  verdictLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  windowTemp: {
    color: C.textMuted,
    fontSize: 11,
  },
  windowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  windowMeta: {
    color: C.textSub,
    fontSize: 11,
  },

  // Show more
  showMoreBtn: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: C.navyMid,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  showMoreText: {
    color: C.textMuted,
    fontSize: 13,
  },

  // Tips
  tipsCard: {
    backgroundColor: C.navyMid,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tipsAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: C.accent,
  },
  tipsTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    color: C.textSub,
    fontSize: 13,
    lineHeight: 21,
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
