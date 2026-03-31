/**
 * app/profile/medications.tsx
 *
 * Medication category picker.
 * Users select which categories of heat-sensitive medications they take.
 * No specific drug names are stored — only category IDs.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  MED_CATEGORIES,
  severityColor,
  severityBg,
  type MedSeverity,
} from '../../src/features/medications/medicationEngine';
import {
  getSelectedMedCategories,
  saveSelectedMedCategories,
} from '../../src/features/medications/medicationStorage';

const COLORS = {
  background: '#F8F9FA',
  surface:    '#FFFFFF',
  text:       '#1D3557',
  textSec:    '#6B7280',
  textTer:    '#9CA3AF',
  border:     '#E5E7EB',
  primary:    '#1D3557',
  safe:       '#2D9B6F',
};

const SEVERITY_LABEL: Record<MedSeverity, string> = {
  moderate: 'Moderate risk',
  high:     'High risk',
  critical: 'Critical risk',
};

export default function MedicationsScreen() {
  const [selected, setSelected] = useState<string[]>(getSelectedMedCategories());
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    saveSelectedMedCategories(selected);
    router.back();
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={s.headerTitle}>Heat-Sensitive Medications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Explainer */}
        <View style={s.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.textSec} />
          <Text style={s.infoText}>
            Select the categories that match your medications. HeatGuard will
            show you specific warnings and actions for each one based on the
            current temperature. No drug names are stored.
          </Text>
        </View>

        {/* Category cards */}
        {MED_CATEGORIES.map(cat => {
          const isSelected = selected.includes(cat.id);
          const isExpanded = expanded === cat.id;
          const color      = severityColor(cat.severity);
          const bg         = severityBg(cat.severity);

          return (
            <View
              key={cat.id}
              style={[
                s.card,
                isSelected && { borderColor: color, borderWidth: 1.5 },
              ]}
            >
              {/* Main row */}
              <Pressable
                onPress={() => toggle(cat.id)}
                style={s.cardMain}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={cat.name}
              >
                {/* Checkbox */}
                <View style={[
                  s.checkbox,
                  isSelected && { backgroundColor: color, borderColor: color },
                ]}>
                  {isSelected && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>

                {/* Name + severity */}
                <View style={s.cardInfo}>
                  <Text style={[s.cardName, isSelected && { color }]}>
                    {cat.name}
                  </Text>
                  <View style={[s.severityPill, { backgroundColor: bg }]}>
                    <Text style={[s.severityText, { color }]}>
                      {SEVERITY_LABEL[cat.severity]}
                    </Text>
                  </View>
                </View>

                {/* Expand toggle */}
                <Pressable
                  onPress={() => setExpanded(isExpanded ? null : cat.id)}
                  style={s.expandBtn}
                  accessibilityRole="button"
                  accessibilityLabel={isExpanded ? 'Collapse details' : 'Show details'}
                >
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={COLORS.textSec}
                  />
                </Pressable>
              </Pressable>

              {/* Examples */}
              <Text style={s.examples}>{cat.examples}</Text>

              {/* Expanded detail */}
              {isExpanded && (
                <View style={[s.detail, { borderTopColor: COLORS.border }]}>
                  <Text style={s.mechanism}>{cat.mechanism}</Text>
                  <Text style={s.actionsTitle}>Key precautions:</Text>
                  {cat.actions.map((action, i) => (
                    <View key={i} style={s.actionRow}>
                      <View style={[s.actionDot, { backgroundColor: color }]} />
                      <Text style={s.actionText}>{action}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* "None of these" note */}
        <View style={s.noneNote}>
          <Text style={s.noneNoteText}>
            If none of these apply, leave them all unselected. You will still
            receive general heat safety guidance.
          </Text>
        </View>

      </ScrollView>

      {/* Save button */}
      <View style={s.footer}>
        <Pressable
          onPress={handleSave}
          style={s.saveBtn}
          accessibilityRole="button"
          accessibilityLabel="Save medication selections"
        >
          <Text style={s.saveBtnText}>
            Save{selected.length > 0 ? ` (${selected.length} selected)` : ''}
          </Text>
        </Pressable>
      </View>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '600', color: COLORS.text, flex: 1, textAlign: 'center' },
  scroll:       { flex: 1 },
  scrollContent:{ padding: 16, gap: 10, paddingBottom: 24 },

  infoCard:   { flexDirection: 'row', gap: 10, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: COLORS.border, alignItems: 'flex-start' },
  infoText:   { flex: 1, fontSize: 13, color: COLORS.textSec, lineHeight: 20 },

  card:       { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 0.5, borderColor: COLORS.border, overflow: 'hidden' },
  cardMain:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  checkbox:   { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  cardInfo:   { flex: 1, gap: 4 },
  cardName:   { fontSize: 14, fontWeight: '600', color: COLORS.text },
  severityPill:{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  severityText:{ fontSize: 11, fontWeight: '600' },
  expandBtn:  { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  examples:   { fontSize: 12, color: COLORS.textTer, paddingHorizontal: 14, paddingBottom: 12, marginTop: -6 },

  detail:       { borderTopWidth: 0.5, padding: 14, gap: 10 },
  mechanism:    { fontSize: 13, color: COLORS.textSec, lineHeight: 20, fontStyle: 'italic' },
  actionsTitle: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginTop: 4 },
  actionRow:    { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  actionDot:    { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  actionText:   { flex: 1, fontSize: 13, color: COLORS.textSec, lineHeight: 20 },

  noneNote:     { paddingVertical: 8 },
  noneNoteText: { fontSize: 12, color: COLORS.textTer, textAlign: 'center', lineHeight: 18 },

  footer:   { padding: 16, borderTopWidth: 0.5, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  saveBtn:  { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
