// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/components/profile/HouseholdQuestions.tsx
// HeatGuard · "Home & lifestyle" questions
// Used by onboarding and by app/profile/household.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check, Baby, PawPrint, Sun, Home, AirVent, Fan } from 'lucide-react-native';
import type { HouseholdAnswers } from '../../features/profile/storage/profileStorage';

export interface HouseholdColors {
  text: string;
  muted: string;
  card: string;
  border: string;
  accent: string;
  onAccent: string;
  selectedBg: string;
}

const QUESTIONS: {
  key: keyof HouseholdAnswers;
  label: string;
  hint: string;
  Icon: typeof Baby;
}[] = [
  { key: 'drivesWithKids', label: 'Kids ride in my car', hint: 'Back-seat checks and reminders on hot days', Icon: Baby },
  { key: 'drivesWithPets', label: 'Pets ride in my car', hint: 'Back-seat checks and reminders on hot days', Icon: PawPrint },
  { key: 'worksOutdoors', label: 'I work or exercise outdoors', hint: 'Safer hours and activity prep', Icon: Sun },
  { key: 'livesAlone', label: 'I live alone', hint: 'A daily check-in so someone knows you are OK', Icon: Home },
  { key: 'noAC', label: 'No AC at home', hint: 'Cooling centers near you, front and center', Icon: AirVent },
  { key: 'acUnreliable', label: 'My AC is old or unreliable', hint: 'A plan for when it stops working', Icon: Fan },
];

interface Props {
  value: HouseholdAnswers;
  onChange: (next: HouseholdAnswers) => void;
  colors: HouseholdColors;
}

export default function HouseholdQuestions({ value, onChange, colors }: Props) {
  const toggle = (key: keyof HouseholdAnswers) => {
    const next = { ...value, [key]: !value[key] };
    // "No AC" and "unreliable AC" can't both be true
    if (key === 'noAC' && next.noAC) next.acUnreliable = false;
    if (key === 'acUnreliable' && next.acUnreliable) next.noAC = false;
    onChange(next);
  };

  return (
    <View style={styles.list}>
      {QUESTIONS.map(({ key, label, hint, Icon }) => {
        const checked = value[key];
        return (
          <Pressable
            key={key}
            onPress={() => toggle(key)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={`${label}. ${hint}`}
            style={[
              styles.row,
              {
                backgroundColor: checked ? colors.selectedBg : colors.card,
                borderColor: checked ? colors.accent : colors.border,
              },
            ]}
          >
            <Icon size={26} color={checked ? colors.accent : colors.muted} />
            <View style={styles.text}>
              <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
              <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text>
            </View>
            <View
              style={[
                styles.box,
                {
                  borderColor: checked ? colors.accent : colors.border,
                  backgroundColor: checked ? colors.accent : 'transparent',
                },
              ]}
            >
              {checked && <Check size={18} color={colors.onAccent} strokeWidth={3} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 72,
  },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 14, lineHeight: 19 },
  box: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
