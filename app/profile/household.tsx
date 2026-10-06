// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/profile/household.tsx
// HeatGuard · Home & lifestyle
//  - Car riders, outdoor work, living alone, age 65+, health condition
//  - Home AC moved to Profile → Home surroundings (app/profile/home.tsx)
//  - Daily check-in moved to Profile → Daily check-in (app/checkin/settings.tsx)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, AirVent } from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';
import HouseholdQuestions from '../../src/components/profile/HouseholdQuestions';
import {
  getHeatProfile,
  getHouseholdAnswers,
  saveHouseholdAnswers,
  isHomeVulnerable,
  type HouseholdAnswers,
} from '../../src/features/profile/storage/profileStorage';

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
    pressed: '#ECECE6',
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
    pressed: '#1A2540',
  },
};

export default function HouseholdScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const c = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  const [answers, setAnswers] = useState<HouseholdAnswers>(() => getHouseholdAnswers());
  const homeAnswered = getHeatProfile().homeAnswered;
  const suggestHome = !homeAnswered && isHomeVulnerable({ ...getHeatProfile(), ...answers });

  const handleSave = () => {
    saveHouseholdAnswers(answers);
    if (suggestHome) router.replace('/profile/home');
    else router.back();
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

        <Pressable
          onPress={() => { saveHouseholdAnswers(answers); router.replace('/profile/home'); }}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.linkRow,
            { backgroundColor: pressed ? c.pressed : c.card, borderColor: c.border, borderWidth },
          ]}
        >
          <AirVent size={24} color={c.text} />
          <View style={styles.flex1}>
            <Text style={[styles.linkTitle, { color: c.text }]}>Home surroundings</Text>
            <Text style={[styles.linkSub, { color: c.muted }]}>Your AC at home, free cooling tips, and bill help</Text>
          </View>
          {suggestHome && (
            <View style={[styles.badge, { backgroundColor: c.recBg }]}>
              <Text style={[styles.badgeText, { color: c.recText }]}>Next</Text>
            </View>
          )}
          <ChevronRight size={20} color={c.muted} />
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleSave}
          accessibilityRole="button"
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.saveText, { color: c.onAccent }]}>{suggestHome ? 'Save & continue' : 'Save'}</Text>
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

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, minHeight: 72, marginTop: 6 },
  linkTitle: { fontSize: 17, fontWeight: '800' },
  linkSub: { fontSize: 14, lineHeight: 19, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: '800' },

  footer: { paddingHorizontal: 20, paddingTop: 8 },
  saveBtn: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 18, fontWeight: '800' },
});
