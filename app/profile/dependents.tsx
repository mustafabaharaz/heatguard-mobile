// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/profile/dependents.tsx   (NEW FILE)
// HeatGuard · Who I'm protecting
// Add the kids, pets and older adults you look after. Names are used in
// hot-day vehicle reminders and on Home. Stored only on this phone.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Switch, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Baby, PawPrint, HeartHandshake, Trash2, Plus } from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';
import {
  getDependents, addDependent, updateDependent, removeDependent, KIND_LABEL,
  type Dependent, type DependentKind,
} from '../../src/features/profile/storage/dependentsStorage';

const SKIN = {
  light: {
    bg: '#F4F4F0',
    card: '#FFFFFF',
    border: '#0A0A0A',
    divider: '#E2E2DC',
    text: '#0A0A0A',
    muted: '#3F3F3A',
    accent: '#0B4FD6',
    onAccent: '#FFFFFF',
    danger: '#B91C1C',
    inputBg: '#FFFFFF',
    segActiveBg: '#0A0A0A',
    segActiveText: '#FFFFFF',
    switchTrack: '#0B4FD6',
  },
  dark: {
    bg: '#0B1220',
    card: '#131C2E',
    border: '#24314F',
    divider: '#24314F',
    text: '#F1F5F9',
    muted: '#A3B1C9',
    accent: '#38BDF8',
    onAccent: '#04121F',
    danger: '#F87171',
    inputBg: '#0F1829',
    segActiveBg: '#38BDF8',
    segActiveText: '#04121F',
    switchTrack: '#38BDF8',
  },
};

const KIND_ICON: Record<DependentKind, typeof Baby> = {
  child: Baby,
  pet: PawPrint,
  adult: HeartHandshake,
};

const KINDS: DependentKind[] = ['child', 'pet', 'adult'];

export default function DependentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const c = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  const [list, setList] = useState<Dependent[]>(() => getDependents());
  const [name, setName] = useState('');
  const [kind, setKind] = useState<DependentKind>('child');
  const [rides, setRides] = useState(true);

  const handleAdd = () => {
    if (!name.trim()) {
      Alert.alert('Add a name', 'A first name or nickname is enough.');
      return;
    }
    setList(addDependent(name, kind, rides));
    setName('');
    setRides(true);
  };

  const handleRemove = (d: Dependent) => {
    Alert.alert(`Remove ${d.name}?`, 'They will no longer appear in reminders.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setList(removeDependent(d.id)) },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
        <ChevronLeft size={24} color={c.accent} />
        <Text style={[styles.backText, { color: c.accent }]}>Profile</Text>
      </Pressable>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Who I'm protecting</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>
          Add the kids, pets and family you look after. HeatGuard uses their names in hot-day car reminders. Stored only on this phone.
        </Text>

        {/* ── List ─────────────────────────────────────────────────────────── */}
        {list.length > 0 && (
          <View style={[styles.list, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
            {list.map((d, i) => {
              const Icon = KIND_ICON[d.kind];
              return (
                <View
                  key={d.id}
                  style={[styles.row, { borderBottomColor: c.divider, borderBottomWidth: i < list.length - 1 ? 1 : 0 }]}
                >
                  <Icon size={24} color={c.text} />
                  <View style={styles.flex1}>
                    <Text style={[styles.rowName, { color: c.text }]}>{d.name}</Text>
                    <Text style={[styles.rowKind, { color: c.muted }]}>{KIND_LABEL[d.kind]}</Text>
                  </View>
                  <View style={styles.rideCol}>
                    <Text style={[styles.rideLabel, { color: c.muted }]}>Rides in car</Text>
                    <Switch
                      value={d.ridesInCar}
                      onValueChange={v => setList(updateDependent(d.id, { ridesInCar: v }))}
                      trackColor={{ true: c.switchTrack, false: c.divider }}
                      accessibilityLabel={`${d.name} rides in my car`}
                    />
                  </View>
                  <Pressable
                    onPress={() => handleRemove(d)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${d.name}`}
                    style={styles.iconBtn}
                    hitSlop={6}
                  >
                    <Trash2 size={20} color={c.danger} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Add ──────────────────────────────────────────────────────────── */}
        <View style={[styles.addCard, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
          <Text style={[styles.addTitle, { color: c.text }]}>{list.length ? 'Add another' : 'Add someone'}</Text>

          <View style={styles.segment}>
            {KINDS.map(k => {
              const active = k === kind;
              const Icon = KIND_ICON[k];
              return (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[
                    styles.segBtn,
                    {
                      backgroundColor: active ? c.segActiveBg : 'transparent',
                      borderColor: active ? c.segActiveBg : c.border,
                      borderWidth,
                    },
                  ]}
                >
                  <Icon size={18} color={active ? c.segActiveText : c.text} />
                  <Text style={[styles.segText, { color: active ? c.segActiveText : c.text }]}>{KIND_LABEL[k]}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: c.muted }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={kind === 'pet' ? 'e.g. Max' : kind === 'adult' ? 'e.g. Mom' : 'e.g. Ayla'}
            placeholderTextColor={c.muted}
            style={[styles.input, { color: c.text, backgroundColor: c.inputBg, borderColor: c.border, borderWidth }]}
            accessibilityLabel="Name"
            returnKeyType="done"
            onSubmitEditing={handleAdd}
            maxLength={30}
          />

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleText, { color: c.text }]}>Rides in my car</Text>
            <Switch
              value={rides}
              onValueChange={setRides}
              trackColor={{ true: c.switchTrack, false: c.divider }}
              accessibilityLabel="Rides in my car"
            />
          </View>

          <Pressable
            onPress={handleAdd}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addBtn, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <Plus size={20} color={c.onAccent} strokeWidth={3} />
            <Text style={[styles.addBtnText, { color: c.onAccent }]}>Add</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 17, fontWeight: '600' },
  content: { paddingHorizontal: 20, gap: 14 },
  flex1: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.3, marginTop: 8 },
  subtitle: { fontSize: 16, lineHeight: 23, marginTop: -6 },

  list: { borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 68 },
  rowName: { fontSize: 17, fontWeight: '800' },
  rowKind: { fontSize: 14 },
  rideCol: { alignItems: 'center', gap: 2 },
  rideLabel: { fontSize: 11, fontWeight: '700' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  addCard: { borderRadius: 16, padding: 16, gap: 10 },
  addTitle: { fontSize: 18, fontWeight: '800' },
  segment: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  input: { minHeight: 50, borderRadius: 12, paddingHorizontal: 14, fontSize: 17 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  toggleText: { fontSize: 16, fontWeight: '700' },
  addBtn: { flexDirection: 'row', gap: 8, minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 17, fontWeight: '800' },
});
