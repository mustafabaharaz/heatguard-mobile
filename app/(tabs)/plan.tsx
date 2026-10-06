// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Plan tab (interim)
// Links to the existing Forecast, Activity Planner and Preparedness screens.
// Replaced by the full Plan screen (forecast strip + activity prep) in Part 3.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Footprints, ShieldCheck, ChevronRight } from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';

const SKIN = {
  light: {
    bg: '#F4F4F0',
    card: '#FFFFFF',
    border: '#0A0A0A',
    text: '#0A0A0A',
    muted: '#3F3F3A',
    accent: '#0B4FD6',
    pressed: '#E8E8E2',
  },
  dark: {
    bg: '#0B1220',
    card: '#131C2E',
    border: '#24314F',
    text: '#F1F5F9',
    muted: '#A3B1C9',
    accent: '#38BDF8',
    pressed: '#1A2540',
  },
};

type RowProps = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
  colors: typeof SKIN.light;
  borderWidth: number;
};

function PlanRow({ title, subtitle, icon, onPress, colors, borderWidth }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.pressed : colors.card,
          borderColor: colors.border,
          borderWidth,
        },
      ]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.muted }]}>{subtitle}</Text>
      </View>
      <ChevronRight size={22} color={colors.muted} />
    </Pressable>
  );
}

export default function PlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Plan
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Get ready before you head out.
        </Text>

        <PlanRow
          title="5-day forecast"
          subtitle="Heat levels and safer hours"
          icon={<CalendarDays size={26} color={colors.accent} />}
          onPress={() => router.push('/intelligence/forecast')}
          colors={colors}
          borderWidth={borderWidth}
        />
        <PlanRow
          title="Plan an activity"
          subtitle="Best time to go and when to turn back"
          icon={<Footprints size={26} color={colors.accent} />}
          onPress={() => router.push('/intelligence/activity-planner')}
          colors={colors}
          borderWidth={borderWidth}
        />
        <PlanRow
          title="Be prepared"
          subtitle="Checklists for extreme heat days"
          icon={<ShieldCheck size={26} color={colors.accent} />}
          onPress={() => router.push('/preparedness')}
          colors={colors}
          borderWidth={borderWidth}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 16, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 16,
    minHeight: 76,
  },
  rowIcon: { width: 32, alignItems: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17, fontWeight: '700' },
  rowSub: { fontSize: 14, lineHeight: 20 },
});
