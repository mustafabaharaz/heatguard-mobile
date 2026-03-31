/**
 * src/components/medications/MedicationWarningCard.tsx
 *
 * Home screen medication warning card.
 *
 * States:
 *  1. takesMedications=false       → hidden (returns null)
 *  2. takesMedications=true,
 *     no categories selected       → setup prompt
 *  3. Categories selected,
 *     tempC < 25                   → collapsed "medications noted" pill
 *  4. Categories selected,
 *     tempC >= 25                  → full warning with top severity,
 *                                    expandable to all warnings
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  getMedicationWarnings,
  shouldPromptMedSetup,
  severityColor,
  severityBg,
  type MedWarning,
} from '../../features/medications/medicationEngine';
import { getSelectedMedCategories } from '../../features/medications/medicationStorage';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const C = {
  surface:  '#FFFFFF',
  text:     '#1D3557',
  textSec:  '#6B7280',
  textTer:  '#9CA3AF',
  border:   '#E5E7EB',
  primary:  '#1D3557',
  caution:  '#D97706',
};

interface Props {
  tempC: number;
  takesMedications: boolean;
}

export default function MedicationWarningCard({ tempC, takesMedications }: Props) {
  const [categories, setCategories]   = useState<string[]>([]);
  const [warnings, setWarnings]       = useState<MedWarning[]>([]);
  const [expanded, setExpanded]       = useState(false);
  const [showAllWarnings, setShowAll] = useState(false);

  // Reload categories whenever the screen is focused (user may have just saved)
  useEffect(() => {
    const cats = getSelectedMedCategories();
    setCategories(cats);
    setWarnings(getMedicationWarnings(cats, tempC));
  }, [tempC]);

  // ── Hidden ──────────────────────────────────────────────────────────────

  if (!takesMedications) return null;

  // ── Setup prompt ─────────────────────────────────────────────────────────

  if (shouldPromptMedSetup(takesMedications, categories)) {
    return (
      <Pressable
        onPress={() => router.push('/profile/medications')}
        accessibilityRole="button"
        accessibilityLabel="Set up medication warnings"
      >
        <View style={s.setupCard}>
          <View style={s.setupLeft}>
            <Ionicons name="medkit-outline" size={20} color={C.caution} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.setupTitle}>Medication heat warnings</Text>
              <Text style={s.setupSub}>
                You take heat-sensitive medications. Tap to identify which ones
                for specific safety guidance.
              </Text>
            </View>
          </View>
          <View style={s.setupPill}>
            <Text style={s.setupPillText}>Set up</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  // ── No warnings at current temp (below 25°C) ───────────────────────────

  if (warnings.length === 0 || tempC < 25) {
    return (
      <Pressable
        onPress={() => router.push('/profile/medications')}
        accessibilityRole="button"
        accessibilityLabel="View medication settings"
      >
        <View style={s.quietCard}>
          <Ionicons name="medkit-outline" size={15} color={C.textSec} />
          <Text style={s.quietText}>
            {categories.length} medication {categories.length === 1 ? 'category' : 'categories'} noted
          </Text>
          <Ionicons name="chevron-forward" size={14} color={C.textTer} />
        </View>
      </Pressable>
    );
  }

  // ── Active warnings ───────────────────────────────────────────────────────

  const topWarning  = warnings[0];
  const moreCount   = warnings.length - 1;
  const color       = severityColor(topWarning.severity);
  const bg          = severityBg(topWarning.severity);

  const handleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(e => !e);
  };

  const handleShowAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAll(v => !v);
  };

  const displayedWarnings = showAllWarnings ? warnings : [topWarning];

  return (
    <View style={[s.card, { borderColor: color, borderWidth: 1 }]}>

      {/* Header row */}
      <Pressable
        onPress={handleExpand}
        style={[s.cardHeader, { backgroundColor: bg }]}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse medication warning' : 'Expand medication warning'}
      >
        <Ionicons name="medkit" size={16} color={color} />
        <Text style={[s.cardHeaderText, { color }]}>{topWarning.headline}</Text>
        {moreCount > 0 && (
          <View style={[s.morePill, { backgroundColor: color + '22' }]}>
            <Text style={[s.moreText, { color }]}>+{moreCount} more</Text>
          </View>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={color}
        />
      </Pressable>

      {/* Collapsed summary */}
      {!expanded && (
        <View style={s.summary}>
          <Text style={s.summaryText} numberOfLines={2}>
            {topWarning.body}
          </Text>
        </View>
      )}

      {/* Expanded detail */}
      {expanded && (
        <View style={s.detail}>
          {displayedWarnings.map((w, i) => (
            <View key={w.categoryId} style={[s.warningBlock, i > 0 && s.warningBorder]}>
              <Text style={[s.warningCategory, { color: severityColor(w.severity) }]}>
                {w.categoryName}
              </Text>
              <Text style={s.warningBody}>{w.body}</Text>

              {/* Actions */}
              <View style={s.actions}>
                {w.actions.slice(0, 3).map((action, j) => (
                  <View key={j} style={s.actionRow}>
                    <View style={[s.actionDot, { backgroundColor: severityColor(w.severity) }]} />
                    <Text style={s.actionText}>{action}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* Show all / less toggle */}
          {moreCount > 0 && (
            <Pressable
              onPress={handleShowAll}
              style={s.showAllBtn}
              accessibilityRole="button"
            >
              <Text style={[s.showAllText, { color }]}>
                {showAllWarnings
                  ? 'Show less'
                  : `Show ${moreCount} more warning${moreCount > 1 ? 's' : ''}`}
              </Text>
              <Ionicons
                name={showAllWarnings ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={color}
              />
            </Pressable>
          )}

          {/* Edit link */}
          <Pressable
            onPress={() => router.push('/profile/medications')}
            style={s.editLink}
            accessibilityRole="button"
            accessibilityLabel="Edit medication categories"
          >
            <Ionicons name="pencil-outline" size={13} color={C.textSec} />
            <Text style={s.editLinkText}>Edit medications</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  // Setup prompt
  setupCard:     { backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: C.border, gap: 10 },
  setupLeft:     { flexDirection: 'row', gap: 10, alignItems: 'flex-start', flex: 1 },
  setupTitle:    { fontSize: 14, fontWeight: '600', color: C.text },
  setupSub:      { fontSize: 12, color: C.textSec, lineHeight: 18 },
  setupPill:     { backgroundColor: C.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-end' },
  setupPillText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  // Quiet state
  quietCard:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 0.5, borderColor: C.border },
  quietText:  { flex: 1, fontSize: 13, color: C.textSec },

  // Active warning card
  card:       { backgroundColor: C.surface, borderRadius: 14, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  cardHeaderText: { flex: 1, fontSize: 14, fontWeight: '600' },
  morePill:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  moreText:   { fontSize: 11, fontWeight: '600' },

  summary:     { paddingHorizontal: 14, paddingVertical: 10 },
  summaryText: { fontSize: 13, color: C.textSec, lineHeight: 20 },

  detail:       { paddingBottom: 4 },
  warningBlock: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  warningBorder:{ borderTopWidth: 0.5, borderTopColor: C.border },
  warningCategory: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  warningBody: { fontSize: 13, color: C.textSec, lineHeight: 20 },

  actions:    { gap: 6, marginTop: 4 },
  actionRow:  { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  actionDot:  { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  actionText: { flex: 1, fontSize: 12, color: C.textSec, lineHeight: 18 },

  showAllBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: C.border },
  showAllText: { fontSize: 13, fontWeight: '600' },

  editLink:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: C.border },
  editLinkText: { fontSize: 12, color: C.textSec },
});
