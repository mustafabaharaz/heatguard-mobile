// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/components/profile/HomeSurroundingsQuestions.tsx   (NEW FILE)
// HeatGuard · "Home surroundings" questions
//  1. AC at home?            Yes / No
//  2. Does it work reliably? Yes / Not always      (only if Yes)
//  3. Ever turn it off to save on bills?  Yes / No (only if Yes)
// Used by onboarding (older adults, living alone, health conditions) and by
// app/profile/home.tsx. `value` fields are null until answered.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { HouseholdColors } from './HouseholdQuestions';
import type { HomeAnswers } from '../../features/profile/storage/profileStorage';

export interface HomeDraft {
  hasAC: boolean | null;
  reliable: boolean | null;
  offToSave: boolean | null;
}

export function draftFromAnswers(a: HomeAnswers, answered: boolean): HomeDraft {
  if (!answered) return { hasAC: null, reliable: null, offToSave: null };
  if (a.noAC) return { hasAC: false, reliable: null, offToSave: null };
  return { hasAC: true, reliable: !a.acUnreliable, offToSave: a.acOffToSave };
}

export function answersFromDraft(d: HomeDraft): HomeAnswers {
  return {
    noAC: d.hasAC === false,
    acUnreliable: d.hasAC === true && d.reliable === false,
    acOffToSave: d.hasAC === true && d.offToSave === true,
  };
}

/** True once every question that applies has an answer. */
export function isDraftComplete(d: HomeDraft): boolean {
  if (d.hasAC === null) return false;
  if (d.hasAC === false) return true;
  return d.reliable !== null && d.offToSave !== null;
}

interface Props {
  value: HomeDraft;
  onChange: (next: HomeDraft) => void;
  colors: HouseholdColors;
}

function Choice({
  question, options, selected, onSelect, colors,
}: {
  question: string;
  options: { label: string; value: boolean }[];
  selected: boolean | null;
  onSelect: (v: boolean) => void;
  colors: HouseholdColors;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.question, { color: colors.text }]}>{question}</Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        {options.map(o => {
          const active = selected === o.value;
          return (
            <Pressable
              key={o.label}
              onPress={() => onSelect(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${question} ${o.label}`}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: active ? colors.accent : colors.card,
                  borderColor: active ? colors.accent : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.optionText, { color: active ? colors.onAccent : colors.text }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function HomeSurroundingsQuestions({ value, onChange, colors }: Props) {
  return (
    <View style={styles.list}>
      <Choice
        question="Do you have AC at home?"
        options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]}
        selected={value.hasAC}
        onSelect={v => onChange(v ? { ...value, hasAC: true } : { hasAC: false, reliable: null, offToSave: null })}
        colors={colors}
      />
      {value.hasAC === true && (
        <>
          <Choice
            question="Does it keep your home cool on the hottest days?"
            options={[{ label: 'Yes', value: true }, { label: 'Not always', value: false }]}
            selected={value.reliable}
            onSelect={v => onChange({ ...value, reliable: v })}
            colors={colors}
          />
          <Choice
            question="Do you sometimes turn it off to save on bills?"
            options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]}
            selected={value.offToSave}
            onSelect={v => onChange({ ...value, offToSave: v })}
            colors={colors}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: { borderRadius: 16, borderWidth: 2, padding: 16, gap: 12 },
  question: { fontSize: 17, fontWeight: '700', lineHeight: 23 },
  options: { flexDirection: 'row', gap: 10 },
  option: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  optionText: { fontSize: 17, fontWeight: '800' },
});
