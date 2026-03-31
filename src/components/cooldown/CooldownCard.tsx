/**
 * src/components/cooldown/CooldownCard.tsx
 *
 * Compact home screen card that launches the cool-down timer.
 * Shows urgency based on current temperature.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const C = {
  surface:  '#FFFFFF',
  text:     '#1D3557',
  textSec:  '#6B7280',
  border:   '#E5E7EB',
  cool:     '#3B82F6',
  coolBg:   '#EFF6FF',
  caution:  '#F4A261',
  extreme:  '#DC2626',
  crisis:   '#7C2D12',
};

function getUrgency(tempC: number): { color: string; label: string; sub: string } {
  if (tempC >= 40) return { color: C.crisis,  label: 'Cool down now',      sub: 'Crisis heat — immediate recovery needed' };
  if (tempC >= 35) return { color: C.extreme, label: 'Cool-down timer',    sub: 'Start a recovery session' };
  if (tempC >= 30) return { color: C.caution, label: 'Cool-down timer',    sub: 'Take a heat recovery break' };
  return             { color: C.cool,    label: 'Cool-down timer',    sub: 'Time your heat recovery' };
}

interface Props {
  tempC: number;
}

export default function CooldownCard({ tempC }: Props) {
  const { color, label, sub } = getUrgency(tempC);

  return (
    <Pressable
      onPress={() => router.push('/cooldown/timer')}
      accessibilityRole="button"
      accessibilityLabel="Open cool-down timer"
    >
      <View style={[styles.card, tempC >= 35 && { borderColor: color, borderWidth: 1 }]}>
        <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
          <Ionicons name="snow-outline" size={20} color={color} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.label, { color }]}>{label}</Text>
          <Text style={styles.sub}>{sub}</Text>
        </View>
        <View style={[styles.startPill, { backgroundColor: color }]}>
          <Text style={styles.startText}>Start</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: C.border },
  iconWrap:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  info:      { flex: 1, gap: 2 },
  label:     { fontSize: 14, fontWeight: '600' },
  sub:       { fontSize: 12, color: C.textSec },
  startPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  startText: { fontSize: 13, fontWeight: '600', color: '#fff' },
});
