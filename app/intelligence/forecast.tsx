// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/intelligence/forecast.tsx
// HeatGuard · Hour-by-hour forecast
//  - 5-day picker, each day's level from the shared risk engine (same as Home)
//  - Hour-by-hour list: temperature, feels-like, and your level for that hour
//  - Avoid / best windows, one calm tip
// Skins: High Sun (light) / Night Shift (dark). Respects °F / °C.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useWeather } from '../../src/services/weather/useWeather';
import { fToC } from '../../src/services/weather/weatherStore';
import { getHeatProfile } from '../../src/features/profile/storage/profileStorage';
import { RISK_LABEL, type RiskLevel } from '../../src/features/risk/riskEngine';
import {
  generateForecast, hourToLabel, windowLabel, type DayForecast,
} from '../../src/features/intelligence/forecastEngine';
import { getLastViewedDay, saveLastViewedDay } from '../../src/features/intelligence/storage/forecastStorage';

const SKIN = {
  light: {
    bg: '#F4F4F0', card: '#FFFFFF', border: '#0A0A0A', divider: '#E2E2DC',
    text: '#0A0A0A', muted: '#3F3F3A', accent: '#0B4FD6', pressed: '#ECECE6',
    nowBg: '#FFF4CC',
    level: { low: '#15803D', moderate: '#CA8A04', high: '#EA580C', veryHigh: '#B91C1C' } as Record<RiskLevel, string>,
    onLevel: { low: '#FFFFFF', moderate: '#0A0A0A', high: '#0A0A0A', veryHigh: '#FFFFFF' } as Record<RiskLevel, string>,
  },
  dark: {
    bg: '#0B1220', card: '#131C2E', border: '#24314F', divider: '#24314F',
    text: '#F1F5F9', muted: '#A3B1C9', accent: '#38BDF8', pressed: '#1A2540',
    nowBg: '#1A2540',
    level: { low: '#4ADE80', moderate: '#FACC15', high: '#FB923C', veryHigh: '#F87171' } as Record<RiskLevel, string>,
    onLevel: { low: '#04121F', moderate: '#04121F', high: '#04121F', veryHigh: '#04121F' } as Record<RiskLevel, string>,
  },
};
type Skin = typeof SKIN.light;

export default function ForecastScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, formatTemp } = useSettings();
  const c: Skin = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;
  const { snapshot } = useWeather();

  const [profile, setProfile] = useState(getHeatProfile());
  useFocusEffect(useCallback(() => { setProfile(getHeatProfile()); }, []));

  const days = useMemo(() => generateForecast(profile, snapshot), [snapshot?.fetchedAt, profile]);
  const [selected, setSelected] = useState(getLastViewedDay());
  const idx = Math.min(selected, Math.max(days.length - 1, 0));
  const day: DayForecast | undefined = days[idx];

  const t = (f: number, unit = true) => formatTemp(Math.round(fToC(f)), unit);
  const nowHour = new Date().getHours();

  const pick = (i: number) => { setSelected(i); saveLastViewedDay(i); };

  return (
    <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to Plan" style={styles.back}>
        <ChevronLeft size={24} color={c.accent} />
        <Text style={[styles.backText, { color: c.accent }]}>Plan</Text>
      </Pressable>

      {!day ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={[styles.muted, { color: c.muted }]}>Loading the forecast…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Hour by hour</Text>
          <Text style={[styles.subtitle, { color: c.muted }]}>Levels use your heat profile, same as Home.</Text>

          {/* Day picker */}
          <View style={styles.days}>
            {days.map((d, i) => {
              const active = i === idx;
              return (
                <Pressable
                  key={d.dateKey}
                  onPress={() => pick(i)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${d.dayLabel}, high ${t(d.highF)}, heat risk ${RISK_LABEL[d.level]}`}
                  style={[styles.day, {
                    backgroundColor: c.card,
                    borderColor: active ? c.accent : c.border,
                    borderWidth: active ? 3 : borderWidth,
                  }]}
                >
                  <View style={[styles.dayBar, { backgroundColor: c.level[d.level] }]} />
                  <Text style={[styles.dayName, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>{d.dayLabel}</Text>
                  <Text style={[styles.dayHigh, { color: c.text }]}>{t(d.highF, false)}</Text>
                  <Text style={[styles.dayLevel, { color: c.muted }]} numberOfLines={1} adjustsFontSizeToFit>{RISK_LABEL[d.level]}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Summary */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
            <View style={styles.summaryTop}>
              <View style={[styles.levelPill, { backgroundColor: c.level[day.level] }]}>
                <Text style={[styles.levelPillText, { color: c.onLevel[day.level] }]}>{RISK_LABEL[day.level]}</Text>
              </View>
              <Text style={[styles.summaryTemps, { color: c.muted }]}>
                {t(day.lowF, false)} / {t(day.highF)} · feels {t(day.peakFeelsF)}
              </Text>
            </View>
            <Text style={[styles.directive, { color: c.text }]}>{day.directive}</Text>
            <View style={styles.windows}>
              <View style={styles.flex1}>
                <Text style={[styles.windowLabel, { color: c.muted }]}>Avoid outside</Text>
                <Text style={[styles.windowValue, { color: c.text }]}>
                  {day.avoidStart !== null && day.avoidEnd !== null ? windowLabel(day.avoidStart, day.avoidEnd) : 'No Very high hours'}
                </Text>
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.windowLabel, { color: c.muted }]}>{day.bestIsSafer ? 'Best outside' : 'Coolest hours'}</Text>
                <Text style={[styles.windowValue, { color: c.text }]}>
                  {day.bestStart !== null && day.bestEnd !== null ? windowLabel(day.bestStart, day.bestEnd) : '—'}
                </Text>
              </View>
            </View>
            <Text style={[styles.tip, { color: c.muted }]}>{day.tip}</Text>
          </View>

          {/* Hourly list */}
          <View style={[styles.card, styles.noPad, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
            <View style={[styles.hourHead, { borderBottomColor: c.divider }]}>
              <Text style={[styles.hcTime, styles.headText, { color: c.muted }]}>Time</Text>
              <Text style={[styles.hcTemp, styles.headText, { color: c.muted }]}>Temp</Text>
              <Text style={[styles.hcTemp, styles.headText, { color: c.muted }]}>Feels</Text>
              <Text style={[styles.hcLevel, styles.headText, { color: c.muted }]}>Your level</Text>
            </View>
            {day.hourly.map((h, i) => {
              const isNow = idx === 0 && h.hour === nowHour;
              return (
                <View
                  key={h.hour}
                  accessible
                  accessibilityLabel={`${hourToLabel(h.hour)}${isNow ? ', now' : ''}. ${t(h.tempF)}, feels like ${t(h.feelsF)}. ${RISK_LABEL[h.level]}.`}
                  style={[styles.hourRow, {
                    backgroundColor: isNow ? c.nowBg : 'transparent',
                    borderBottomColor: c.divider,
                    borderBottomWidth: i === day.hourly.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  }]}
                >
                  <Text style={[styles.hcTime, styles.cell, { color: c.text, fontWeight: isNow ? '800' : '600' }]}>
                    {isNow ? 'Now' : hourToLabel(h.hour)}
                  </Text>
                  <Text style={[styles.hcTemp, styles.cell, { color: c.text }]}>{t(h.tempF, false)}</Text>
                  <Text style={[styles.hcTemp, styles.cell, { color: c.text }]}>{t(h.feelsF, false)}</Text>
                  <View style={[styles.hcLevel, styles.levelCell]}>
                    <View style={[styles.dot, { backgroundColor: c.level[h.level] }]} />
                    <Text style={[styles.cell, { color: c.text }]}>{RISK_LABEL[h.level]}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <Pressable
            onPress={() => router.push('/risk')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.link, { backgroundColor: pressed ? c.pressed : c.card, borderColor: c.border, borderWidth }]}
          >
            <View style={styles.flex1}>
              <Text style={[styles.linkTitle, { color: c.text }]}>How your level is measured</Text>
              <Text style={[styles.linkSub, { color: c.muted }]}>National Weather Service heat categories, with sources</Text>
            </View>
            <ChevronRight size={22} color={c.muted} />
          </Pressable>

          <Text style={[styles.footer, { color: c.muted }]}>
            Weather data by Open-Meteo.com. HeatGuard is not a medical device.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { fontSize: 16 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 20, gap: 14 },
  flex1: { flex: 1 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 16, marginTop: -8 },

  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12, minHeight: 96 },
  dayBar: { width: '100%', height: 6, borderRadius: 3 },
  dayName: { fontSize: 13, fontWeight: '800' },
  dayHigh: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  dayLevel: { fontSize: 11, fontWeight: '700' },

  card: { borderRadius: 16, padding: 16, gap: 10 },
  noPad: { padding: 0, gap: 0, overflow: 'hidden' },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  levelPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  levelPillText: { fontSize: 14, fontWeight: '800' },
  summaryTemps: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  directive: { fontSize: 18, fontWeight: '800', lineHeight: 24 },
  windows: { flexDirection: 'row', gap: 12 },
  windowLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  windowValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  tip: { fontSize: 15, lineHeight: 21 },

  hourHead: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  headText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  hourRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 44 },
  cell: { fontSize: 16, fontVariant: ['tabular-nums'] },
  hcTime: { width: 64 },
  hcTemp: { width: 56 },
  hcLevel: { flex: 1 },
  levelCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },

  link: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, minHeight: 64 },
  linkTitle: { fontSize: 17, fontWeight: '800' },
  linkSub: { fontSize: 14, lineHeight: 19 },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
