// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/profile/household.tsx
// HeatGuard · Home & lifestyle
//  - Car riders, outdoor work, living alone, home AC
//  - Daily check-in ("Are you OK today?") on/off + time
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Switch } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, BellRing } from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';
import HouseholdQuestions from '../../src/components/profile/HouseholdQuestions';
import {
  getHouseholdAnswers,
  saveHouseholdAnswers,
  type HouseholdAnswers,
} from '../../src/features/profile/storage/profileStorage';
import {
  getDailyCheckIn, setDailyCheckIn, type DailyCheckInSettings,
} from '../../src/features/checkin/dailyCheckIn';
import { registerForPushNotifications } from '../../src/services/notifications/push';

const SKIN = {
  light: {
    bg: '#F4F4F0',
    card: '#FFFFFF',
    border: '#0A0A0A',
    text: '#0A0A0A',
    muted: '#3F3F3A',
    accent: '#0B4FD6',
    onAccent: '#FFFFFF',
    selectedBg: '#EAF0FF',
    recBg: '#FFF4CC',
    recText: '#5C4300',
    chipActiveBg: '#0A0A0A',
    chipActiveText: '#FFFFFF',
    divider: '#E2E2DC',
  },
  dark: {
    bg: '#0B1220',
    card: '#131C2E',
    border: '#2D3B5E',
    text: '#F1F5F9',
    muted: '#A3B1C9',
    accent: '#38BDF8',
    onAccent: '#04121F',
    selectedBg: '#13263D',
    recBg: '#2A2410',
    recText: '#FBBF24',
    chipActiveBg: '#38BDF8',
    chipActiveText: '#04121F',
    divider: '#24314F',
  },
};

const HOURS = [7, 8, 9, 10, 12, 15, 18, 20];

function hourLabel(h: number): string {
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

export default function HouseholdScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const c = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  const [answers, setAnswers] = useState<HouseholdAnswers>(() => getHouseholdAnswers());
  const [checkIn, setCheckIn] = useState<DailyCheckInSettings>(() => getDailyCheckIn());

  const recommended = answers.livesAlone || answers.noAC || answers.acUnreliable;

  const updateCheckIn = async (next: DailyCheckInSettings) => {
    setCheckIn(next);
    if (next.enabled) await registerForPushNotifications().catch(() => null);
    await setDailyCheckIn(next);
  };

  const handleSave = () => {
    saveHouseholdAnswers(answers);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
        <ChevronLeft size={24} color={c.accent} />
        <Text style={[styles.backText, { color: c.accent }]}>Back</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Home & lifestyle</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>
          Tap everything that fits. HeatGuard puts the right tools on your home screen. Your answers stay on this phone.
        </Text>

        <HouseholdQuestions value={answers} onChange={setAnswers} colors={c} />

        {/* ── Daily check-in ───────────────────────────────────────────────── */}
        <View style={[styles.checkCard, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
          <View style={styles.checkHeader}>
            <BellRing size={24} color={c.text} />
            <View style={styles.flex1}>
              <Text style={[styles.checkTitle, { color: c.text }]}>Daily check-in</Text>
              <Text style={[styles.checkSub, { color: c.muted }]}>
                Each day HeatGuard asks "Are you OK today?" If you don't answer, it reminds you again and makes texting your contacts one tap.
              </Text>
            </View>
            <Switch
              value={checkIn.enabled}
              onValueChange={v => updateCheckIn({ ...checkIn, enabled: v })}
              trackColor={{ true: c.accent, false: c.divider }}
              accessibilityLabel="Daily check-in"
            />
          </View>

          {recommended && !checkIn.enabled && (
            <View style={[styles.rec, { backgroundColor: c.recBg }]}>
              <Text style={[styles.recText, { color: c.recText }]}>
                Recommended for you based on your answers above.
              </Text>
            </View>
          )}

          {checkIn.enabled && (
            <>
              <Text style={[styles.label, { color: c.muted }]}>Check in at</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourRow}>
                {HOURS.map(h => {
                  const active = h === checkIn.hour;
                  return (
                    <Pressable
                      key={h}
                      onPress={() => updateCheckIn({ ...checkIn, hour: h, minute: 0 })}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      style={[
                        styles.hourChip,
                        {
                          backgroundColor: active ? c.chipActiveBg : c.card,
                          borderColor: active ? c.chipActiveBg : c.border,
                          borderWidth,
                        },
                      ]}
                    >
                      <Text style={[styles.hourText, { color: active ? c.chipActiveText : c.text }]}>{hourLabel(h)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={[styles.note, { color: c.muted }]}>
                Tip: tell your emergency contacts you use HeatGuard check-ins, so a call from you or a missed one gets attention.
              </Text>
            </>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleSave}
          accessibilityRole="button"
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.saveText, { color: c.onAccent }]}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 17, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  flex1: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.3, marginTop: 8 },
  subtitle: { fontSize: 16, lineHeight: 23, marginTop: -6, marginBottom: 6 },

  checkCard: { borderRadius: 16, padding: 16, gap: 10, marginTop: 6 },
  checkHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkTitle: { fontSize: 18, fontWeight: '800' },
  checkSub: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  rec: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  recText: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  hourRow: { gap: 8, paddingRight: 8 },
  hourChip: { minHeight: 46, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  hourText: { fontSize: 16, fontWeight: '800' },
  note: { fontSize: 13, lineHeight: 19 },

  footer: { paddingHorizontal: 20, paddingTop: 8 },
  saveBtn: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 18, fontWeight: '800' },
});
