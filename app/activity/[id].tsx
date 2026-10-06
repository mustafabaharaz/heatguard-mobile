// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/activity/[id].tsx
// HeatGuard · Activity prep
//  - Safer start times for the chosen day (real hourly forecast, judged by
//    the shared risk engine with this user's profile)
//  - "Be back by" time for the chosen start
//  - Activity checklist
//  - Start trip check-in (today only)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check } from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useWeather } from '../../src/services/weather/useWeather';
import { getTodayKey } from '../../src/services/weather/weatherStore';
import { registerForPushNotifications } from '../../src/services/notifications/push';
import { getHeatProfile } from '../../src/features/profile/storage/profileStorage';
import {
  getActivity, dayBands, backByHour, formatHour,
} from '../../src/features/plan/activityPrep';
import {
  getActiveTrip, startTrip, endTrip, formatClock, type Trip,
} from '../../src/features/plan/tripCheckIn';

const SKIN = {
  light: {
    bg: '#F4F4F0',
    card: '#FFFFFF',
    border: '#0A0A0A',
    divider: '#E2E2DC',
    text: '#0A0A0A',
    muted: '#3F3F3A',
    accent: '#0B4FD6',
    onAccent: '#FFFFFF',
    hero: '#0A0A0A',
    heroText: '#FFFFFF',
    heroLabel: '#FACC15',
    heroMuted: '#D4D4CF',
    done: '#15803D',
    chipActiveBg: '#0A0A0A',
    chipActiveText: '#FFFFFF',
  },
  dark: {
    bg: '#0B1220',
    card: '#131C2E',
    border: '#24314F',
    divider: '#24314F',
    text: '#F1F5F9',
    muted: '#A3B1C9',
    accent: '#38BDF8',
    onAccent: '#04121F',
    hero: '#1A2540',
    heroText: '#F1F5F9',
    heroLabel: '#FBBF24',
    heroMuted: '#A3B1C9',
    done: '#4ADE80',
    chipActiveBg: '#38BDF8',
    chipActiveText: '#04121F',
  },
};

type Skin = typeof SKIN.light;

const DEFAULT_TRIP_MS = 2 * 60 * 60 * 1000; // when no heat limit applies later
const TOO_HOT_TRIP_MS = 60 * 60 * 1000;     // already over the limit: check soon

function atHour(base: Date, hour: number): number {
  const d = new Date(base);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

export default function ActivityPrepScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const c: Skin = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const activity = getActivity(params.id);
  const { snapshot } = useWeather();

  const todayKey = snapshot ? getTodayKey(snapshot) : '';
  const dateKey = params.date || todayKey;
  const isToday = dateKey === todayKey;

  const bands = useMemo(
    () => (snapshot && dateKey ? dayBands(snapshot, dateKey, activity, getHeatProfile()) : []),
    [snapshot?.fetchedAt, dateKey, activity.id],
  );

  const nowHour = new Date().getHours();
  const startOptions = bands
    .filter(b => b.band !== 'danger')
    .filter(b => !isToday || b.hour >= nowHour)
    .map(b => b.hour);

  const [startHour, setStartHour] = useState<number | null>(null);
  const chosenStart = startHour ?? startOptions[0] ?? null;
  const backBy = chosenStart !== null ? backByHour(bands, chosenStart) : null;

  const [done, setDone] = useState<boolean[]>(() => activity.items.map(() => false));
  const doneCount = done.filter(Boolean).length;

  const [trip, setTrip] = useState<Trip | null>(null);
  useFocusEffect(useCallback(() => { setTrip(getActiveTrip()); }, []));

  // Check-in time if the user heads out right now
  const nowBackBy = isToday ? backByHour(bands, nowHour) : null;
  const checkAtIfNow =
    nowBackBy === 'tooHot'
      ? Date.now() + TOO_HOT_TRIP_MS
      : typeof nowBackBy === 'number'
        ? atHour(new Date(), nowBackBy)
        : Date.now() + DEFAULT_TRIP_MS;

  const handleStart = async () => {
    await registerForPushNotifications().catch(() => null);
    const t = await startTrip(activity.id, activity.label, checkAtIfNow);
    setTrip(t);
  };

  const handleEnd = async () => {
    await endTrip();
    setTrip(null);
  };

  const dayLabel = (() => {
    if (isToday) return 'Today';
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'long' });
  })();

  return (
    <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back to Plan"
        style={styles.back}
      >
        <ChevronLeft size={24} color={c.accent} />
        <Text style={[styles.backText, { color: c.accent }]}>Plan</Text>
      </Pressable>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">{activity.label}</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>{dayLabel}</Text>

        {/* ── Start time ───────────────────────────────────────────────────── */}
        {startOptions.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Start at</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourRow}>
              {startOptions.map(h => {
                const active = h === chosenStart;
                return (
                  <Pressable
                    key={h}
                    onPress={() => setStartHour(h)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.hourChip,
                      {
                        backgroundColor: active ? c.chipActiveBg : c.card,
                        borderColor: active ? c.chipActiveBg : c.border,
                        borderWidth,
                      },
                    ]}
                  >
                    <Text style={[styles.hourChipText, { color: active ? c.chipActiveText : c.text }]}>{formatHour(h)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.hero, { backgroundColor: c.hero, borderColor: c.border, borderWidth: isDark ? 1 : 0 }]}>
              <Text style={[styles.heroLabel, { color: c.heroLabel }]}>
                {typeof backBy === 'number' ? 'Be back by' : 'Good news'}
              </Text>
              <Text style={[styles.heroValue, { color: c.heroText }]}>
                {typeof backBy === 'number' ? formatHour(backBy) : 'No heat cutoff'}
              </Text>
              <Text style={[styles.heroSub, { color: c.heroMuted }]}>
                {typeof backBy === 'number'
                  ? `After that, your heat risk ${activity.strenuous ? 'for hard activity' : 'outside'} is Very high.`
                  : 'It stays below Very high the rest of the day. Still take breaks and drink water.'}
              </Text>
            </View>
          </>
        ) : (
          <View style={[styles.hero, { backgroundColor: c.hero, borderColor: c.border, borderWidth: isDark ? 1 : 0 }]}>
            <Text style={[styles.heroLabel, { color: c.heroLabel }]}>Not a good day</Text>
            <Text style={[styles.heroValue, { color: c.heroText, fontSize: 26 }]}>
              {isToday ? 'No safer hours left today' : 'Too hot all day'}
            </Text>
            <Text style={[styles.heroSub, { color: c.heroMuted }]}>
              Try another day, go before 5 AM, or choose something indoors.
            </Text>
          </View>
        )}

        {/* ── Checklist ────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: c.text }]}>
          Get ready <Text style={{ color: c.muted, fontWeight: '600' }}>· {doneCount} of {activity.items.length}</Text>
        </Text>
        <View style={[styles.list, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
          {activity.items.map((item, i) => (
            <Pressable
              key={item.label}
              onPress={() => setDone(prev => prev.map((v, j) => (j === i ? !v : v)))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done[i] }}
              accessibilityLabel={`${item.label}. ${item.hint}`}
              style={[
                styles.item,
                { borderBottomColor: c.divider, borderBottomWidth: i < activity.items.length - 1 ? 1 : 0 },
              ]}
            >
              <View
                style={[
                  styles.box,
                  done[i]
                    ? { backgroundColor: c.done, borderColor: c.done }
                    : { backgroundColor: 'transparent', borderColor: c.text },
                ]}
              >
                {done[i] && <Check size={16} color="#FFFFFF" strokeWidth={3.5} />}
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.itemLabel, { color: c.text }]}>{item.label}</Text>
                <Text style={[styles.itemHint, { color: c.muted }]}>{item.hint}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* ── Trip check-in ────────────────────────────────────────────────── */}
        {trip ? (
          <View style={[styles.checkCard, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
            <Text style={[styles.checkTitle, { color: c.text }]}>
              Check-in set for {formatClock(trip.checkAt)}
            </Text>
            <Text style={[styles.checkSub, { color: c.muted }]}>
              {trip.activityLabel}. HeatGuard will ask if you are OK at that time.
            </Text>
            <Pressable
              onPress={handleEnd}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.primaryBtnText, { color: c.onAccent }]}>I'm back safe</Text>
            </Pressable>
          </View>
        ) : isToday ? (
          <View style={styles.startWrap}>
            <Pressable
              onPress={handleStart}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.primaryBtnText, { color: c.onAccent }]}>I'm heading out now</Text>
            </Pressable>
            <Text style={[styles.startNote, { color: c.muted }]}>
              HeatGuard will check on you at {formatClock(checkAtIfNow)}. If you don't answer, you'll get a second alert, and Home will let you text your emergency contacts your location in one tap.
            </Text>
          </View>
        ) : (
          <Text style={[styles.startNote, { color: c.muted }]}>
            On {dayLabel}, open this screen when you head out to start a trip check-in.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 17, fontWeight: '600' },
  content: { paddingHorizontal: 20, gap: 14 },
  flex1: { flex: 1 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 16, marginTop: -8 },
  sectionTitle: { fontSize: 19, fontWeight: '800', marginTop: 4 },

  hourRow: { gap: 8, paddingRight: 8 },
  hourChip: { minHeight: 46, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  hourChipText: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },

  hero: { borderRadius: 16, padding: 16, gap: 4 },
  heroLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroValue: { fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroSub: { fontSize: 15, lineHeight: 21 },

  list: { borderRadius: 16, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 60 },
  box: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { fontSize: 16, fontWeight: '800' },
  itemHint: { fontSize: 14, lineHeight: 19 },

  startWrap: { gap: 8, marginTop: 4 },
  startNote: { fontSize: 14, lineHeight: 20 },
  checkCard: { borderRadius: 16, padding: 16, gap: 8 },
  checkTitle: { fontSize: 18, fontWeight: '800' },
  checkSub: { fontSize: 15, lineHeight: 21 },
  primaryBtn: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 18, fontWeight: '800' },
});
