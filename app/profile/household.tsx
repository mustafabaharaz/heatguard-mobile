// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/profile/household.tsx   (NEW FILE)
// HeatGuard · "Who are you protecting?" screen
// For people who finished onboarding before this step existed, and for
// changing answers later. Home links here until it has been answered.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';
import HouseholdQuestions from '../../src/components/profile/HouseholdQuestions';
import {
  getHeatProfile,
  saveHouseholdAnswers,
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
  },
};

export default function HouseholdScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const c = isDark ? SKIN.dark : SKIN.light;

  const [answers, setAnswers] = useState<HouseholdAnswers>(() => {
    const p = getHeatProfile();
    return {
      drivesWithKids: p.drivesWithKids,
      drivesWithPets: p.drivesWithPets,
      worksOutdoors: p.worksOutdoors,
      livesAlone: p.livesAlone,
    };
  });

  const handleSave = () => {
    saveHouseholdAnswers(answers);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Pressable
        onPress={() => router.back()}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={24} color={c.accent} />
        <Text style={[styles.backText, { color: c.accent }]}>Back</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          Who are you protecting?
        </Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>
          Tap everything that fits. HeatGuard puts the right tools on your home screen. Your answers stay on this phone.
        </Text>

        <HouseholdQuestions value={answers} onChange={setAnswers} colors={c} />
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
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.3, marginTop: 8 },
  subtitle: { fontSize: 16, lineHeight: 23, marginTop: 6, marginBottom: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 8 },
  saveBtn: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 18, fontWeight: '800' },
});
