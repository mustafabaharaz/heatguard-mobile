// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/(tabs)/plan.tsx
// HeatGuard · Plan
//  - 5-day heat strip (tap a day), each day's level from the shared risk
//    engine (same level Home shows for today)
//  - Safer-hours bar for that day from the real hourly forecast
//  - "What are you planning?" → activity prep screen
//  - Active trip check-in, if one is running
// Skins: High Sun (light) / Night Shift (dark).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, CalendarDays, ShieldCheck, Timer } from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useWeather } from '../../src/services/weather/useWeather';
import { getUpcomingDateKeys, getTodayKey, fToC } from '../../src/services/weather/weatherStore';
import {
  ACTIVITIES, dayBands, saferWindowText, getActivity, type HourBand,
} from '../../src/features/plan/activityPrep';
import { getHeatProfile } from '../../src/features/profile/storage/profileStorage';
import { assessRisk, RISK_LABEL, type RiskLevel } from '../../src/features/risk/riskEngine';
import { getActiveTrip, endTrip, formatClock, isTripOverdue, type Trip } from '../../src/features/plan/tripCheckIn';

const SKIN = {
  light: {
    bg: '#F4F4F0',
    card: '#FFFFFF',
    border: '#0A0A0A',
    text: '#0A0A0A',
    muted: '#3F3F3A',
    accent: '#0B4FD6',
    onAccent: '#FFFFFF',
    chipActiveBg: '#0A0A0A',
    chipActiveText: '#FFFFFF',
    pressed: '#ECECE6',
    band: { good: '#15803D', caution: '#FACC15', danger: '#B91C1C' } as Record<HourBand, string>,
    level: { low: '#15803D', moderate: '#FACC15', high: '#EA580C', veryHigh: '#B91C1C' } as Record<RiskLevel, string>,
    tripBg: '#0A0A0A',
    tripText: '#FFFFFF',
    tripMuted: '#D4D4CF',
  },
  dark: {
    bg: '#0B1220',
    card: '#131C2E',
    border: '#24314F',
    text: '#F1F5F9',
    muted: '#A3B1C9',
    accent: '#38BDF8',
    onAccent: '#04121F',
    chipActiveBg: '#38BDF8',
    chipActiveText: '#04121F',
    pressed: '#1A2540',
    band: { good: '#4ADE80', caution: '#FACC15', danger: '#F87171' } as Record<HourBand, string>,
    level: { low: '#4ADE80', moderate: '#FACC15', high: '#FB923C', veryHigh: '#F87171' } as Record<RiskLevel, string>,
    tripBg: '#1A2540',
    tripText: '#F1F5F9',
    tripMuted: '#A3B1C9',
  },
};

type Skin = typeof SKIN.light;

function dayName(dateKey: string, todayKey: string): { short: string; full: string } {
  if (dateKey === todayKey) return { short: 'Today', full: 'Today' };
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    short: date.toLocaleDateString([], { weekday: 'short' }),
    full: date.toLocaleDateString([], { weekday: 'long' }),
  };
}

export default function PlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, formatTemp } = useSettings();
  const c: Skin = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  const { snapshot } = useWeather();
  const [selected, setSelected] = useState(0);
  const [trip, setTrip] = useState<Trip | null>(null);

  useFocusEffect(useCallback(() => {
    setTrip(getActiveTrip());
  }, []));

  // Re-read on focus so profile edits show up right away
  const [profile, setProfile] = useState(getHeatProfile());
  useFocusEffect(useCallback(() => { setProfile(getHeatProfile()); }, []));

  const days = useMemo(() => {
    if (!snapshot) return [];
    const todayKey = getTodayKey(snapshot);
    return getUpcomingDateKeys(snapshot, 5)
      .map(k => snapshot.daily.find(d => d.dateKey === k))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map(d => ({
        ...d,
        name: dayName(d.dateKey, todayKey),
        level: assessRisk(Math.max(d.feelsLikeMaxF, d.highF), profile).level,
      }));
  }, [snapshot?.fetchedAt, profile]);

  const sel = days[Math.min(selected, Math.max(days.length - 1, 0))];
  const bands = useMemo(
    () => (snapshot && sel ? dayBands(snapshot, sel.dateKey, getActivity('other'), profile) : []),
    [snapshot?.fetchedAt, sel?.dateKey, profile],
  );

  const handleEndTrip = async () => {
    await endTrip();
    setTrip(null);
  };

  if (!snapshot) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
        <Text style={[styles.loadingText, { color: c.muted }]}>Loading the forecast…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Plan</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>Get ready before you head out.</Text>

        {/* ── Active trip ──────────────────────────────────────────────────── */}
        {trip && (
          <View style={[styles.trip, { backgroundColor: c.tripBg, borderColor: c.border, borderWidth: isDark ? 1 : 0 }]}>
            <Timer size={22} color={c.tripText} />
            <View style={styles.flex1}>
              <Text style={[styles.tripTitle, { color: c.tripText }]}>
                {trip.activityLabel} · check-in {formatClock(trip.checkAt)}
              </Text>
              <Text style={[styles.tripSub, { color: c.tripMuted }]}>
                {isTripOverdue(trip) ? 'Check-in time has passed. Let HeatGuard know you are OK.' : 'HeatGuard will check on you then.'}
              </Text>
            </View>
            <Pressable
              onPress={handleEndTrip}
              accessibilityRole="button"
              accessibilityLabel="I'm back safe. End trip check-in"
              style={({ pressed }) => [styles.tripBtn, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.tripBtnText, { color: c.onAccent }]}>I'm back</Text>
            </Pressable>
          </View>
        )}

        {/* ── 5-day strip ──────────────────────────────────────────────────── */}
        <View style={styles.days}>
          {days.map((d, i) => {
            const active = i === selected;
            const bar = c.level[d.level];
            return (
              <Pressable
                key={d.dateKey}
                onPress={() => setSelected(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${d.name.full}, high ${formatTemp(Math.round(fToC(d.highF)))}, heat risk ${RISK_LABEL[d.level]}`}
                style={[
                  styles.day,
                  {
                    backgroundColor: c.card,
                    borderColor: active ? c.accent : c.border,
                    borderWidth: active ? 3 : borderWidth,
                  },
                ]}
              >
                <View style={[styles.dayBar, { backgroundColor: bar }]} />
                <Text style={[styles.dayName, { color: c.text }]}>{d.name.short}</Text>
                <Text style={[styles.dayHigh, { color: c.text }]}>{formatTemp(Math.round(fToC(d.highF)), false)}</Text>
                <Text style={[styles.dayLevel, { color: c.muted }]} numberOfLines={1} adjustsFontSizeToFit>{RISK_LABEL[d.level]}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Safer hours ──────────────────────────────────────────────────── */}
        {sel && (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
            <Text style={[styles.cardLabel, { color: c.muted }]}>{sel.name.full} · safer hours</Text>
            <View style={styles.bandBar} accessibilityElementsHidden>
              {bands.map(b => (
                <View key={b.hour} style={[styles.bandSeg, { backgroundColor: c.band[b.band] }]} />
              ))}
            </View>
            <View style={styles.bandLabels} accessibilityElementsHidden>
              <Text style={[styles.bandLabel, { color: c.muted }]}>5 AM</Text>
              <Text style={[styles.bandLabel, { color: c.muted }]}>1 PM</Text>
              <Text style={[styles.bandLabel, { color: c.muted }]}>9 PM</Text>
            </View>
            <Text style={[styles.saferText, { color: c.text }]}>{saferWindowText(bands)}</Text>
            <Text style={[styles.saferNote, { color: c.muted }]}>Based on your heat profile, same as your risk level on Home.</Text>
          </View>
        )}

        {/* ── Activities ───────────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: c.text }]}>What are you planning?</Text>
        <View style={styles.chips}>
          {ACTIVITIES.map(a => (
            <Pressable
              key={a.id}
              onPress={() => router.push({ pathname: '/activity/[id]', params: { id: a.id, date: sel?.dateKey ?? '' } } as any)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: pressed ? c.pressed : c.card,
                  borderColor: c.border,
                  borderWidth,
                  borderStyle: a.id === 'other' ? 'dashed' : 'solid',
                },
              ]}
            >
              <Text style={[styles.chipText, { color: c.text }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── More ─────────────────────────────────────────────────────────── */}
        {[
          { label: 'Hour-by-hour forecast', sub: 'Temperature and feels-like for the week', Icon: CalendarDays, href: '/intelligence/forecast' },
          { label: 'Be prepared', sub: 'Checklists for extreme heat days', Icon: ShieldCheck, href: '/preparedness' },
        ].map(row => (
          <Pressable
            key={row.href}
            onPress={() => router.push(row.href as any)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: pressed ? c.pressed : c.card, borderColor: c.border, borderWidth },
            ]}
          >
            <row.Icon size={24} color={c.text} />
            <View style={styles.flex1}>
              <Text style={[styles.rowTitle, { color: c.text }]}>{row.label}</Text>
              <Text style={[styles.rowSub, { color: c.muted }]}>{row.sub}</Text>
            </View>
            <ChevronRight size={22} color={c.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  flex1: { flex: 1 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 16, marginTop: -8 },

  trip: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14 },
  tripTitle: { fontSize: 16, fontWeight: '800' },
  tripSub: { fontSize: 14, marginTop: 2, lineHeight: 19 },
  tripBtn: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tripBtnText: { fontSize: 15, fontWeight: '800' },

  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12, minHeight: 96 },
  dayBar: { width: '100%', height: 6, borderRadius: 3 },
  dayName: { fontSize: 13, fontWeight: '800' },
  dayHigh: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  dayLevel: { fontSize: 11, fontWeight: '700' },

  card: { borderRadius: 16, padding: 14, gap: 8 },
  cardLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  bandBar: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden' },
  bandSeg: { flex: 1 },
  bandLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  bandLabel: { fontSize: 12, fontWeight: '700' },
  saferText: { fontSize: 17, fontWeight: '800', lineHeight: 23 },
  saferNote: { fontSize: 13, lineHeight: 18 },

  sectionTitle: { fontSize: 19, fontWeight: '800', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 46, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 16, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, minHeight: 72 },
  rowTitle: { fontSize: 17, fontWeight: '800' },
  rowSub: { fontSize: 14, lineHeight: 19 },
});
