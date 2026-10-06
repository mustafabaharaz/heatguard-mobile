// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/checkin/settings.tsx   (NEW FILE + NEW FOLDER)
// HeatGuard · Daily check-in settings
//  - On/off
//  - Pick 1–3 check-in times
//  - Safety check (water, medicine, home cool, phone) — auto for flagged users
//  - Heat buddies (emergency contacts marked as buddies)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Switch } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, BellRing, ShieldCheck, Users, Check } from 'lucide-react-native';
import haptics from '../../src/utils/haptics';
import { useSettings } from '../../src/context/SettingsContext';
import {
  getDailyCheckIn, setDailyCheckIn, isSafetyCheckOn, formatHour,
  MAX_TIMES, TIME_CHOICES, type DailyCheckInSettings,
} from '../../src/features/checkin/dailyCheckIn';
import { getBuddies } from '../../src/features/emergency/storage/contactStorage';
import { getHeatProfile, needsSafetyCheck } from '../../src/features/profile/storage/profileStorage';
import { registerForPushNotifications } from '../../src/services/notifications/push';
import { joinNames } from '../../src/features/profile/storage/dependentsStorage';

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
    chipActiveBg: '#0A0A0A',
    chipActiveText: '#FFFFFF',
    chipDisabled: '#B8B8B0',
    recBg: '#FFF4CC',
    recText: '#5C4300',
    pressed: '#ECECE6',
  },
  dark: {
    bg: '#0B1220',
    card: '#131C2E',
    border: '#2D3B5E',
    divider: '#24314F',
    text: '#F1F5F9',
    muted: '#A3B1C9',
    accent: '#38BDF8',
    onAccent: '#04121F',
    chipActiveBg: '#38BDF8',
    chipActiveText: '#04121F',
    chipDisabled: '#4A5878',
    recBg: '#2A2410',
    recText: '#FBBF24',
    pressed: '#1A2540',
  },
};

export default function CheckInSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const c = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  const [s, setS] = useState<DailyCheckInSettings>(() => getDailyCheckIn());
  const [buddyNames, setBuddyNames] = useState<string[]>([]);
  const flagged = needsSafetyCheck(getHeatProfile());
  const safetyOn = isSafetyCheckOn(s);

  useFocusEffect(useCallback(() => {
    try { setBuddyNames(getBuddies().map(b => b.name)); } catch { setBuddyNames([]); }
  }, []));

  const update = async (next: DailyCheckInSettings) => {
    setS(next);
    if (next.enabled) await registerForPushNotifications().catch(() => null);
    await setDailyCheckIn(next);
  };

  const toggleHour = (hour: number) => {
    const has = s.times.some(t => t.hour === hour);
    if (has) {
      if (s.times.length === 1) return; // keep at least one
      update({ ...s, times: s.times.filter(t => t.hour !== hour) });
    } else {
      if (s.times.length >= MAX_TIMES) return;
      update({ ...s, times: [...s.times, { hour, minute: 0 }] });
    }
    haptics.selection();
  };

  const full = s.times.length >= MAX_TIMES;

  return (
    <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
        <ChevronLeft size={24} color={c.accent} />
        <Text style={[styles.backText, { color: c.accent }]}>Back</Text>
      </Pressable>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Daily check-in</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>
          HeatGuard asks "Are you OK?" at the times you pick. If you don't answer, it reminds you again 30 minutes later and makes texting your contacts one tap.
        </Text>

        {/* ── On / off ───────────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
          <View style={styles.rowTop}>
            <BellRing size={24} color={c.text} />
            <Text style={[styles.cardTitle, { color: c.text, flex: 1 }]}>Check-in reminders</Text>
            <Switch
              value={s.enabled}
              onValueChange={v => update({ ...s, enabled: v })}
              trackColor={{ true: c.accent, false: c.divider }}
              accessibilityLabel="Check-in reminders"
            />
          </View>
          {flagged && !s.enabled && (
            <View style={[styles.rec, { backgroundColor: c.recBg }]}>
              <Text style={[styles.recText, { color: c.recText }]}>Recommended for you based on your profile.</Text>
            </View>
          )}

          {s.enabled && (
            <>
              <Text style={[styles.label, { color: c.muted }]}>
                Check in at · pick up to {MAX_TIMES}
              </Text>
              <View style={styles.grid}>
                {TIME_CHOICES.map(h => {
                  const active = s.times.some(t => t.hour === h);
                  const disabled = !active && full;
                  return (
                    <Pressable
                      key={h}
                      onPress={() => toggleHour(h)}
                      disabled={disabled}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active, disabled }}
                      accessibilityLabel={`Check in at ${formatHour(h)}`}
                      style={({ pressed }) => [
                        styles.hourChip,
                        {
                          backgroundColor: active ? c.chipActiveBg : c.card,
                          borderColor: active ? c.chipActiveBg : disabled ? c.chipDisabled : c.border,
                          borderWidth,
                          opacity: pressed ? 0.85 : disabled ? 0.5 : 1,
                        },
                      ]}
                    >
                      {active && <Check size={16} color={c.chipActiveText} strokeWidth={3} />}
                      <Text style={[styles.hourText, { color: active ? c.chipActiveText : c.text }]}>{formatHour(h)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.note, { color: c.muted }]}>
                {full
                  ? `That's ${MAX_TIMES} a day. Tap a time to remove it.`
                  : 'Morning plus mid-afternoon covers the hottest part of the day.'}
              </Text>
            </>
          )}
        </View>

        {/* ── Safety check ───────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
          <View style={styles.rowTop}>
            <ShieldCheck size={24} color={c.text} />
            <View style={styles.flex1}>
              <Text style={[styles.cardTitle, { color: c.text }]}>Home safety check</Text>
              <Text style={[styles.cardSub, { color: c.muted }]}>
                Four quick yes/no questions: water, medicine, a cool home, a charged phone. A "no" gets one clear tip.
              </Text>
            </View>
            <Switch
              value={safetyOn}
              onValueChange={v => update({ ...s, safetyCheck: v })}
              trackColor={{ true: c.accent, false: c.divider }}
              accessibilityLabel="Home safety check"
            />
          </View>
          {flagged && !safetyOn && (
            <View style={[styles.rec, { backgroundColor: c.recBg }]}>
              <Text style={[styles.recText, { color: c.recText }]}>Recommended for you based on your profile.</Text>
            </View>
          )}
        </View>

        {/* ── Heat buddy ─────────────────────────────────────────────────── */}
        <Pressable
          onPress={() => router.push('/emergency/contacts')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            styles.rowTop,
            { backgroundColor: pressed ? c.pressed : c.card, borderColor: c.border, borderWidth },
          ]}
        >
          <Users size={24} color={c.text} />
          <View style={styles.flex1}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Heat buddy</Text>
            <Text style={[styles.cardSub, { color: c.muted }]}>
              {buddyNames.length
                ? `${joinNames(buddyNames)} can get your check-in results by text.`
                : 'Pick someone from your emergency contacts to share your check-in results with.'}
            </Text>
          </View>
          {!buddyNames.length && (
            <View style={[styles.badge, { backgroundColor: c.recBg }]}>
              <Text style={[styles.badgeText, { color: c.recText }]}>Add</Text>
            </View>
          )}
          <ChevronRight size={20} color={c.muted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/checkin')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.outlineBtn, { borderColor: c.border, borderWidth, backgroundColor: pressed ? c.pressed : c.card }]}
        >
          <Text style={[styles.outlineBtnText, { color: c.text }]}>Check in now</Text>
        </Pressable>

        <Text style={[styles.note, { color: c.muted }]}>
          Tell your buddy you use HeatGuard check-ins. For now, HeatGuard can't text anyone on its own; you tap Send. Automatic buddy alerts are coming in a later version.
        </Text>
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
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.3, marginTop: 8 },
  subtitle: { fontSize: 16, lineHeight: 23, marginTop: -6, marginBottom: 4 },

  card: { borderRadius: 16, padding: 16, gap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  cardSub: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  rec: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  recText: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hourChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    minHeight: 46, minWidth: 82, paddingHorizontal: 12, borderRadius: 999,
  },
  hourText: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  note: { fontSize: 13, lineHeight: 19 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: '800' },

  outlineBtn: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText: { fontSize: 17, fontWeight: '800' },
});
