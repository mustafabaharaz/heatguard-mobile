// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/preparedness/index.tsx
// HeatGuard · Be prepared
//  - What the next 5 days look like for you (shared risk engine levels)
//  - Checklist by category, saved on this phone
//  - Day-by-day plan and supply list
// Skins: High Sun (light) / Night Shift (dark).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check, CircleAlert } from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useWeather } from '../../src/services/weather/useWeather';
import { fToC } from '../../src/services/weather/weatherStore';
import { getHeatProfile } from '../../src/features/profile/storage/profileStorage';
import { RISK_LABEL, type RiskLevel } from '../../src/features/risk/riskEngine';
import { generateForecast } from '../../src/features/intelligence/forecastEngine';
import {
  generatePreparednessPlan, categoryLabel, CATEGORY_ORDER,
  type HeatwaveSeverity, type PrepAction,
} from '../../src/features/preparedness/preparednessEngine';
import { getCompletedActions, toggleActionCompleted } from '../../src/features/preparedness/preparednessStorage';
import haptics from '../../src/utils/haptics';

const SKIN = {
  light: {
    bg: '#F4F4F0', card: '#FFFFFF', border: '#0A0A0A', divider: '#E2E2DC',
    text: '#0A0A0A', muted: '#3F3F3A', accent: '#0B4FD6', onAccent: '#FFFFFF', pressed: '#ECECE6',
    checkBg: '#0A0A0A', checkIcon: '#FFFFFF', critical: '#B91C1C',
    level: { low: '#15803D', moderate: '#CA8A04', high: '#EA580C', veryHigh: '#B91C1C' } as Record<RiskLevel, string>,
    severity: { none: '#15803D', mild: '#CA8A04', moderate: '#EA580C', severe: '#B91C1C', extreme: '#7F1D1D' } as Record<HeatwaveSeverity, string>,
  },
  dark: {
    bg: '#0B1220', card: '#131C2E', border: '#24314F', divider: '#24314F',
    text: '#F1F5F9', muted: '#A3B1C9', accent: '#38BDF8', onAccent: '#04121F', pressed: '#1A2540',
    checkBg: '#38BDF8', checkIcon: '#04121F', critical: '#F87171',
    level: { low: '#4ADE80', moderate: '#FACC15', high: '#FB923C', veryHigh: '#F87171' } as Record<RiskLevel, string>,
    severity: { none: '#4ADE80', mild: '#FACC15', moderate: '#FB923C', severe: '#F87171', extreme: '#F87171' } as Record<HeatwaveSeverity, string>,
  },
};
type Skin = typeof SKIN.light;

function ActionRow({ action, done, onToggle, c, last }: {
  action: PrepAction; done: boolean; onToggle: () => void; c: Skin; last: boolean;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`${action.title}. ${action.detail}${action.priority === 'critical' ? '. Important' : ''}`}
      style={({ pressed }) => [styles.actionRow, {
        backgroundColor: pressed ? c.pressed : 'transparent',
        borderBottomColor: c.divider,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
      }]}
    >
      <View style={[styles.checkbox, {
        borderColor: done ? c.checkBg : c.muted,
        backgroundColor: done ? c.checkBg : 'transparent',
      }]}>
        {done && <Check size={18} color={c.checkIcon} strokeWidth={3} />}
      </View>
      <View style={styles.flex1}>
        <View style={styles.actionTitleRow}>
          <Text style={[styles.actionTitle, { color: c.text, textDecorationLine: done ? 'line-through' : 'none' }]}>
            {action.title}
          </Text>
          {action.priority === 'critical' && !done && (
            <CircleAlert size={16} color={c.critical} accessibilityElementsHidden />
          )}
        </View>
        <Text style={[styles.actionDetail, { color: c.muted }]}>{action.detail}</Text>
      </View>
    </Pressable>
  );
}

export default function PreparednessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, formatTemp } = useSettings();
  const c: Skin = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;
  const { snapshot } = useWeather();

  const [profile, setProfile] = useState(getHeatProfile());
  useFocusEffect(useCallback(() => { setProfile(getHeatProfile()); }, []));

  const plan = useMemo(
    () => (snapshot ? generatePreparednessPlan(generateForecast(profile, snapshot), profile) : null),
    [snapshot?.fetchedAt, profile],
  );

  const [completed, setCompleted] = useState<string[]>(getCompletedActions());
  const toggle = (id: string) => {
    haptics.selection();
    setCompleted(toggleActionCompleted(id));
  };

  const t = (f: number) => formatTemp(Math.round(fToC(f)), false);

  return (
    <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to Plan" style={styles.back}>
        <ChevronLeft size={24} color={c.accent} />
        <Text style={[styles.backText, { color: c.accent }]}>Plan</Text>
      </Pressable>

      {!plan ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={[styles.loading, { color: c.muted }]}>Loading the forecast…</Text>
        </View>
      ) : (() => {
        const total = plan.actions.length;
        const done = plan.actions.filter(a => completed.includes(a.id)).length;
        const sevColor = c.severity[plan.severity];
        return (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
            <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Be prepared</Text>

            {/* Outlook */}
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
              <View style={[styles.sevBar, { backgroundColor: sevColor }]} />
              <Text style={[styles.headline, { color: c.text }]}>{plan.headline}</Text>
              <Text style={[styles.body, { color: c.muted }]}>{plan.summary}</Text>
              <View style={[styles.progressTrack, { backgroundColor: c.divider }]}>
                <View style={[styles.progressFill, { backgroundColor: c.accent, width: `${total ? (done / total) * 100 : 0}%` }]} />
              </View>
              <Text style={[styles.progressText, { color: c.text }]}>
                {done === total && total > 0 ? 'All done. You’re ready.' : `${done} of ${total} done`}
              </Text>
            </View>

            {/* Checklist */}
            {CATEGORY_ORDER.map(cat => {
              const items = plan.actions.filter(a => a.category === cat);
              if (!items.length) return null;
              return (
                <View key={cat} style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: c.muted }]}>{categoryLabel(cat)}</Text>
                  <View style={[styles.card, styles.noPad, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
                    {items.map((a, i) => (
                      <ActionRow
                        key={a.id}
                        action={a}
                        done={completed.includes(a.id)}
                        onToggle={() => toggle(a.id)}
                        c={c}
                        last={i === items.length - 1}
                      />
                    ))}
                  </View>
                </View>
              );
            })}

            {/* Day by day */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.muted }]}>Next 5 days</Text>
              <View style={[styles.card, styles.noPad, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
                {plan.dayPlans.map((d, i) => (
                  <View
                    key={d.dateKey}
                    accessible
                    accessibilityLabel={`${d.dayLabel}, high ${t(d.highF)}, ${RISK_LABEL[d.level]}. ${d.bestWindow}. ${d.focusAction}`}
                    style={[styles.dayRow, {
                      borderBottomColor: c.divider,
                      borderBottomWidth: i === plan.dayPlans.length - 1 ? 0 : StyleSheet.hairlineWidth,
                    }]}
                  >
                    <View style={[styles.dayStripe, { backgroundColor: c.level[d.level] }]} />
                    <View style={styles.dayCol}>
                      <Text style={[styles.dayName, { color: c.text }]}>{d.dayLabel}</Text>
                      <Text style={[styles.dayHigh, { color: c.muted }]}>{t(d.highF)}°</Text>
                    </View>
                    <View style={styles.flex1}>
                      <Text style={[styles.dayLevel, { color: c.text }]}>{RISK_LABEL[d.level]}</Text>
                      <Text style={[styles.dayText, { color: c.muted }]}>{d.bestWindow}</Text>
                      <Text style={[styles.dayText, { color: c.text }]}>{d.focusAction}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Supplies */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.muted }]}>Supplies</Text>
              <View style={[styles.card, styles.noPad, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
                {plan.supplies.map((s, i) => (
                  <View
                    key={s.name}
                    style={[styles.supplyRow, {
                      borderBottomColor: c.divider,
                      borderBottomWidth: i === plan.supplies.length - 1 ? 0 : StyleSheet.hairlineWidth,
                    }]}
                  >
                    <Text style={[styles.supplyName, { color: c.text, fontWeight: s.critical ? '800' : '600' }]}>{s.name}</Text>
                    <Text style={[styles.supplyQty, { color: c.muted }]}>{s.quantity}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={[styles.footer, { color: c.muted }]}>
              General guidance, not medical advice. Ask your doctor how heat affects you.
            </Text>
          </ScrollView>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loading: { fontSize: 16 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 20, gap: 14 },
  flex1: { flex: 1 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.3 },

  card: { borderRadius: 16, padding: 16, gap: 8, overflow: 'hidden' },
  noPad: { padding: 0, gap: 0 },
  sevBar: { height: 6, borderRadius: 3, marginBottom: 4 },
  headline: { fontSize: 20, fontWeight: '800', lineHeight: 26 },
  body: { fontSize: 15, lineHeight: 21 },
  progressTrack: { height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 5 },
  progressText: { fontSize: 15, fontWeight: '700' },

  section: { gap: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 },

  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 16, paddingVertical: 14, minHeight: 56 },
  checkbox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionTitle: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  actionDetail: { fontSize: 14, lineHeight: 19, marginTop: 2 },

  dayRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12, paddingRight: 16, paddingVertical: 12 },
  dayStripe: { width: 6 },
  dayCol: { width: 72 },
  dayName: { fontSize: 16, fontWeight: '800' },
  dayHigh: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dayLevel: { fontSize: 15, fontWeight: '800' },
  dayText: { fontSize: 14, lineHeight: 19 },

  supplyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 48 },
  supplyName: { flex: 1, fontSize: 16 },
  supplyQty: { fontSize: 14, textAlign: 'right' },

  footer: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
