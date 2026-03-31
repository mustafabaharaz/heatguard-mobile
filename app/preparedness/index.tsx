// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Heatwave Preparedness Mode
// Full preparedness plan: severity banner, interactive checklist,
// 5-day plan summary, and supply list.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  generatePreparednessPlan,
  categoryLabel,
  categoryIcon,
  thermalLevelColor,
  getSeverityColor,
  type PrepAction,
  type PreparednessPlan,
} from '../../src/features/preparedness/preparednessEngine';
import {
  getCompletedActions,
  toggleActionCompleted,
} from '../../src/features/preparedness/preparednessStorage';
import { getHeatProfile } from '../../src/features/profile/storage/profileStorage';
import { generateForecast } from '../../src/features/intelligence/forecastEngine';

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:       '#F8F9FA',
  surface:  '#FFFFFF',
  text:     '#1D3557',
  textSec:  '#6B7280',
  textTer:  '#9CA3AF',
  border:   '#E5E7EB',
  safe:     '#2D9B6F',
  safeBg:   '#F0FDF4',
};

// ── Progress ring (simple arc using border trick) ─────────────────────────────

function ProgressRing({ completed, total, color }: { completed: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <View style={[pr.ring, { borderColor: color }]}>
      <Text style={[pr.pct, { color }]}>{pct}%</Text>
      <Text style={pr.label}>done</Text>
    </View>
  );
}

const pr = StyleSheet.create({
  ring:  { width: 64, height: 64, borderRadius: 32, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  pct:   { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 10, color: '#9CA3AF' },
});

// ── Action row ────────────────────────────────────────────────────────────────

function ActionRow({
  action,
  isCompleted,
  onToggle,
}: {
  action: PrepAction;
  isCompleted: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const priorityColor = action.priority === 'critical' ? '#DC2626'
    : action.priority === 'high' ? '#EA580C' : '#D97706';

  return (
    <View style={[ar.row, isCompleted && ar.rowDone]}>
      <Pressable
        onPress={onToggle}
        style={[ar.checkbox, isCompleted && { backgroundColor: C.safe, borderColor: C.safe }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isCompleted }}
        accessibilityLabel={action.title}
        hitSlop={8}
      >
        {isCompleted && <Ionicons name="checkmark" size={14} color="#fff" />}
      </Pressable>

      <View style={{ flex: 1, gap: 4 }}>
        <Pressable
          onPress={() => setExpanded(e => !e)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse' : 'Expand detail'}
        >
          <View style={ar.titleRow}>
            <Text style={[ar.title, isCompleted && ar.titleDone]}>{action.title}</Text>
            <View style={[ar.priorityPill, { backgroundColor: priorityColor + '18' }]}>
              <Text style={[ar.priorityText, { color: priorityColor }]}>{action.priority}</Text>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={C.textTer}
            />
          </View>
        </Pressable>
        {expanded && (
          <Text style={ar.detail}>{action.detail}</Text>
        )}
      </View>
    </View>
  );
}

const ar = StyleSheet.create({
  row:          { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6', alignItems: 'flex-start' },
  rowDone:      { opacity: 0.55 },
  checkbox:     { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  titleRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title:        { fontSize: 14, fontWeight: '600', color: '#1D3557', flex: 1 },
  titleDone:    { textDecorationLine: 'line-through', color: '#9CA3AF' },
  priorityPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  priorityText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  detail:       { fontSize: 13, color: '#6B7280', lineHeight: 20, paddingRight: 8 },
});

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({
  category,
  actions,
  completedIds,
  onToggle,
}: {
  category: PrepAction['category'];
  actions: PrepAction[];
  completedIds: string[];
  onToggle: (id: string) => void;
}) {
  if (actions.length === 0) return null;
  const doneCount = actions.filter(a => completedIds.includes(a.id)).length;

  return (
    <View style={cs.section}>
      <View style={cs.header}>
        <Ionicons name={categoryIcon(category) as any} size={16} color={C.textSec} />
        <Text style={cs.headerText}>{categoryLabel(category)}</Text>
        <Text style={cs.count}>{doneCount}/{actions.length}</Text>
      </View>
      {actions.map(a => (
        <ActionRow
          key={a.id}
          action={a}
          isCompleted={completedIds.includes(a.id)}
          onToggle={() => onToggle(a.id)}
        />
      ))}
    </View>
  );
}

const cs = StyleSheet.create({
  section:    { backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 16, paddingBottom: 4, borderWidth: 0.5, borderColor: C.border },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: C.border },
  headerText: { flex: 1, fontSize: 14, fontWeight: '700', color: C.text },
  count:      { fontSize: 13, color: C.textSec },
});

// ── Day plan row ──────────────────────────────────────────────────────────────

function DayPlanRow({ plan }: { plan: PreparednessPlan['dayPlans'][0] }) {
  const color = thermalLevelColor(plan.peakLevel);
  return (
    <View style={dp.row}>
      <View style={dp.dayCol}>
        <Text style={dp.dayLabel}>{plan.dayLabel}</Text>
        <Text style={dp.dateLabel}>{plan.dateLabel}</Text>
      </View>
      <View style={[dp.levelPill, { backgroundColor: color + '18', borderColor: color + '50' }]}>
        <Text style={[dp.levelText, { color }]}>{Math.round(plan.peakTemp)}°F</Text>
      </View>
      <View style={dp.planCol}>
        <Text style={dp.bestWindow}>
          <Text style={{ color: C.safe, fontWeight: '600' }}>✓ </Text>
          {plan.bestWindow}
        </Text>
        <Text style={dp.focusAction}>{plan.focusAction}</Text>
      </View>
    </View>
  );
}

const dp = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  dayCol:     { width: 52 },
  dayLabel:   { fontSize: 13, fontWeight: '700', color: C.text },
  dateLabel:  { fontSize: 11, color: C.textSec },
  levelPill:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  levelText:  { fontSize: 12, fontWeight: '700' },
  planCol:    { flex: 1, gap: 2 },
  bestWindow: { fontSize: 12, color: C.textSec },
  focusAction:{ fontSize: 12, color: C.text, fontWeight: '500' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PreparednessScreen() {
  const router = useRouter();

  const profile  = getHeatProfile();
  // Bridge HeatProfile → ProfileInput for forecastEngine
  const profileInput = {
    name:          profile.name,
    age:           parseInt(profile.age) || 35,
    activityLevel: profile.activityLevel === 'medium' ? 'moderate' : profile.activityLevel,
    threshold:     profile.alertThreshold,
    conditions:    [
      profile.hasDiabetes       && 'diabetes',
      profile.hasHeartDisease   && 'heartDisease',
      profile.hasRespiratoryIssues && 'respiratory',
      profile.isElderly         && 'elderly',
    ].filter(Boolean) as string[],
    takesMedications: profile.takesMedications,
  };

  const forecast = generateForecast(profileInput);
  const plan     = generatePreparednessPlan(forecast, profile);

  const [completedIds, setCompleted] = useState<string[]>(getCompletedActions());

  const handleToggle = useCallback((id: string) => {
    const updated = toggleActionCompleted(id);
    setCompleted(updated);
  }, []);

  const severityColor = getSeverityColor(plan.severity);
  const totalActions  = plan.actions.length;
  const doneCount     = plan.actions.filter(a => completedIds.includes(a.id)).length;

  // Group actions by category
  const categories: PrepAction['category'][] = ['water', 'shelter', 'medical', 'supplies', 'social', 'planning'];
  const byCategory = (cat: PrepAction['category']) => plan.actions.filter(a => a.category === cat);

  return (
    <SafeAreaView style={s.container} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>Preparedness</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Severity banner */}
        <View style={[s.severityCard, { borderColor: severityColor, backgroundColor: severityColor + '10' }]}>
          <View style={s.severityTop}>
            <Ionicons name="warning" size={22} color={severityColor} />
            <View style={{ flex: 1 }}>
              <Text style={[s.severityTitle, { color: severityColor }]}>{plan.headline}</Text>
              <Text style={s.severitySub}>{plan.summary}</Text>
            </View>
            <ProgressRing completed={doneCount} total={totalActions} color={severityColor} />
          </View>
          {doneCount === totalActions && totalActions > 0 && (
            <View style={s.allDoneBanner}>
              <Ionicons name="checkmark-circle" size={16} color={C.safe} />
              <Text style={s.allDoneText}>All actions complete — you're prepared</Text>
            </View>
          )}
        </View>

        {/* Checklist */}
        <Text style={s.sectionTitle}>Preparation checklist</Text>
        {categories.map(cat => (
          <CategorySection
            key={cat}
            category={cat}
            actions={byCategory(cat)}
            completedIds={completedIds}
            onToggle={handleToggle}
          />
        ))}

        {/* 5-day plan */}
        <Text style={s.sectionTitle}>5-day plan</Text>
        <View style={s.card}>
          {plan.dayPlans.map((dp, i) => (
            <DayPlanRow key={i} plan={dp} />
          ))}
        </View>

        {/* Supply list */}
        <Text style={s.sectionTitle}>Supply checklist</Text>
        <View style={s.card}>
          {plan.supplies.map((item, i) => (
            <View key={i} style={[s.supplyRow, i === 0 && { borderTopWidth: 0 }]}>
              <Ionicons
                name={item.critical ? 'alert-circle' : 'checkmark-circle-outline'}
                size={16}
                color={item.critical ? '#DC2626' : C.textSec}
              />
              <Text style={[s.supplyName, item.critical && { fontWeight: '600' }]}>{item.name}</Text>
              <Text style={s.supplyQty}>{item.quantity}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '600', color: C.text },
  scroll:       { flex: 1 },
  content:      { padding: 16, gap: 12, paddingBottom: 48 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginTop: 4 },

  severityCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 12 },
  severityTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  severityTitle:{ fontSize: 17, fontWeight: '700', marginBottom: 4 },
  severitySub:  { fontSize: 13, color: C.textSec, lineHeight: 20 },
  allDoneBanner:{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.safeBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  allDoneText:  { fontSize: 13, color: C.safe, fontWeight: '600' },

  card:         { backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 16, paddingBottom: 4, borderWidth: 0.5, borderColor: C.border },
  supplyRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: '#F3F4F6' },
  supplyName:   { flex: 1, fontSize: 13, color: C.text },
  supplyQty:    { fontSize: 12, color: C.textSec },
});
