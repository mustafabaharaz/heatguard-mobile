/**
 * src/components/preparedness/PreparednessCard.tsx
 * Home screen entry point for heatwave preparedness mode.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { generatePreparednessPlan, getSeverityColor } from '../../features/preparedness/preparednessEngine';
import { getCompletedActions } from '../../features/preparedness/preparednessStorage';
import { getHeatProfile } from '../../features/profile/storage/profileStorage';
import { generateForecast } from '../../features/intelligence/forecastEngine';
import { getRiskMultiplier } from '../../features/profile/storage/profileStorage';

const C = {
  surface: '#FFFFFF',
  text:    '#1D3557',
  textSec: '#6B7280',
  border:  '#E5E7EB',
  safe:    '#2D9B6F',
};

export default function PreparednessCard() {
  const plan = useMemo(() => {
    const profile = getHeatProfile();
    const profileInput = {
      name: profile.name,
      age: parseInt(profile.age) || 35,
      activityLevel: profile.activityLevel === 'medium' ? 'moderate' : profile.activityLevel,
      threshold: profile.alertThreshold,
      conditions: [
        profile.hasDiabetes && 'diabetes',
        profile.hasHeartDisease && 'heartDisease',
        profile.hasRespiratoryIssues && 'respiratory',
        profile.isElderly && 'elderly',
      ].filter(Boolean) as string[],
      takesMedications: profile.takesMedications,
    };
    const forecast = generateForecast(getRiskMultiplier(profile), profile);
    return generatePreparednessPlan(forecast, profile);
  }, []);

  const completedIds  = getCompletedActions();
  const totalActions  = plan.actions.length;
  const doneCount     = plan.actions.filter(a => completedIds.includes(a.id)).length;
  const criticalLeft  = plan.actions.filter(a => a.priority === 'critical' && !completedIds.includes(a.id)).length;
  const color         = getSeverityColor(plan.severity);
  const allDone       = doneCount === totalActions;

  if (plan.severity === 'none') return null;

  return (
    <Pressable
      onPress={() => router.push('/preparedness')}
      accessibilityRole="button"
      accessibilityLabel="Open heatwave preparedness plan"
    >
      <View style={[s.card, { borderColor: color + '60', borderWidth: 1 }]}>
        <View style={s.row}>
          <View style={[s.iconWrap, { backgroundColor: color + '18' }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={color} />
          </View>
          <View style={s.info}>
            <Text style={[s.title, { color }]}>{plan.severityLabel}</Text>
            <Text style={s.sub}>
              {allDone
                ? 'All preparations complete'
                : criticalLeft > 0
                ? `${criticalLeft} critical action${criticalLeft > 1 ? 's' : ''} remaining`
                : `${totalActions - doneCount} of ${totalActions} actions remaining`}
            </Text>
          </View>
          <View style={s.progressWrap}>
            <Text style={[s.progressPct, { color }]}>
              {Math.round((doneCount / totalActions) * 100)}%
            </Text>
            <Text style={s.progressLabel}>ready</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={color} />
        </View>

        {/* Mini progress bar */}
        <View style={s.barTrack}>
          <View style={[s.barFill, {
            width: `${Math.round((doneCount / totalActions) * 100)}%` as any,
            backgroundColor: allDone ? C.safe : color,
          }]} />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card:         { backgroundColor: C.surface, borderRadius: 14, padding: 14, gap: 10 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  info:         { flex: 1, gap: 2 },
  title:        { fontSize: 14, fontWeight: '700' },
  sub:          { fontSize: 12, color: C.textSec },
  progressWrap: { alignItems: 'center' },
  progressPct:  { fontSize: 16, fontWeight: '800' },
  progressLabel:{ fontSize: 10, color: C.textSec },
  barTrack:     { height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 2 },
});
