// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/components/profile/HouseholdQuestions.tsx
// HeatGuard · "Home & lifestyle" questions (tap-to-check rows)
// Used by onboarding and by app/profile/household.tsx.
// Home AC questions moved to HomeSurroundingsQuestions.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check, Baby, PawPrint, Sun, Home, Armchair, HeartPulse } from 'lucide-react-native';
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
  { key: 'livesAlone', label: 'I live alone', hint: 'Check-ins so someone knows you are OK', Icon: Home },
  { key: 'isElderly', label: "I'm 65 or older", hint: 'Heat hits harder with age; extra safeguards', Icon: Armchair },
  { key: 'healthConcern', label: 'Heart, lung, or diabetes condition', hint: 'These raise heat risk; extra safeguards', Icon: HeartPulse },
];

interface Props {
  value: HouseholdAnswers;
  onChange: (next: HouseholdAnswers) => void;
  colors: HouseholdColors;
}

export function CheckRow({
  label, hint, Icon, checked, onPress, colors,
}: {
  label: string;
  hint: string;
  Icon: typeof Baby;
  checked: boolean;
  onPress: () => void;
  colors: HouseholdColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${label}. ${hint}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: checked ? colors.selectedBg : colors.card,
          borderColor: checked ? colors.accent : colors.border,
          opacity: pressed ? 0.9 : 1,
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
}

export default function HouseholdQuestions({ value, onChange, colors }: Props) {
  return (
    <View style={styles.list}>
      {QUESTIONS.map(({ key, label, hint, Icon }) => (
        <CheckRow
          key={key}
          label={label}
          hint={hint}
          Icon={Icon}
          checked={value[key]}
          onPress={() => onChange({ ...value, [key]: !value[key] })}
          colors={colors}
        />
      ))}
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
