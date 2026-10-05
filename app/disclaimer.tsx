// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Safety & medical disclaimer (Settings → About)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DISCLAIMER_POINTS } from '../src/content/disclaimer';

const C = { text: '#1D3557', secondary: '#4B5563', border: '#E5E7EB', surface: '#FFFFFF', bg: '#F9FAFB' };
type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function DisclaimerScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safety & medical</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {DISCLAIMER_POINTS.map(p => (
          <View key={p.text} style={styles.point}>
            <Ionicons name={p.icon as IconName} size={22} color={C.text} style={{ marginRight: 12, marginTop: 1 }} />
            <Text style={styles.pointText}>{p.text}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: C.text },
  point: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    padding: 14, marginBottom: 10,
  },
  pointText: { flex: 1, fontSize: 15, lineHeight: 22, color: C.text },
});
