// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/emergency/contacts.tsx
// HeatGuard · Emergency contacts & heat buddies
//  - Add / edit / delete contacts, set the primary (used first by SOS)
//  - "Heat buddy" switch per contact: buddies can get check-in results
// Skins: High Sun (light) / Night Shift (dark).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Alert, TextInput, Modal, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Trash2, Phone, Star, X, Users } from 'lucide-react-native';
import haptics from '../../src/utils/haptics';
import { useSettings } from '../../src/context/SettingsContext';
import type { EmergencyContact } from '../../src/features/emergency/types/contact.types';
import {
  getContacts, addContact, deleteContact, updateContact, setPrimaryContact, setBuddy,
} from '../../src/features/emergency/storage/contactStorage';

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
    star: '#B45309',
    starBg: '#FFF4CC',
    danger: '#B91C1C',
    inputBg: '#FFFFFF',
    pressed: '#ECECE6',
    placeholder: '#6B6B66',
  },
  dark: {
    bg: '#0B1220',
    card: '#131C2E',
    border: '#2D3B5E',
    divider: '#24314F',
    text: '#F1F5F9',
    muted: '#A3B1C9',
    accent: '#38BDF8',
    onAccent: '#04121F',
    star: '#FBBF24',
    starBg: '#2A2410',
    danger: '#F87171',
    inputBg: '#0B1220',
    pressed: '#1A2540',
    placeholder: '#7C8BA6',
  },
};

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const c = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmergencyContact | null>(null);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [relationship, setRelationship] = useState('');
  const [isBuddy, setIsBuddy] = useState(false);

  const load = () => setContacts(getContacts());
  useFocusEffect(useCallback(() => { load(); }, []));

  const openAdd = () => {
    setEditing(null);
    setName(''); setPhoneNumber(''); setRelationship('');
    setIsBuddy(contacts.length === 0);
    setShowModal(true);
  };

  const openEdit = (ct: EmergencyContact) => {
    setEditing(ct);
    setName(ct.name); setPhoneNumber(ct.phoneNumber); setRelationship(ct.relationship);
    setIsBuddy(!!ct.isBuddy);
    setShowModal(true);
  };

  const close = () => setShowModal(false);

  const save = () => {
    if (!name.trim() || !phoneNumber.trim()) {
      Alert.alert('Name and phone needed', 'Add a name and a phone number so HeatGuard can reach them.');
      return;
    }
    const fields = {
      name: name.trim(),
      phoneNumber: phoneNumber.trim(),
      relationship: relationship.trim() || 'Emergency contact',
      isBuddy,
    };
    if (editing) updateContact(editing.id, fields);
    else addContact({ id: Date.now().toString(), isPrimary: contacts.length === 0, ...fields });
    haptics.success();
    load();
    close();
  };

  const remove = (ct: EmergencyContact) => {
    Alert.alert('Remove contact?', `${ct.name} won't be reached by SOS or check-ins.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { deleteContact(ct.id); load(); } },
    ]);
  };

  const toggleBuddy = (ct: EmergencyContact, v: boolean) => {
    setBuddy(ct.id, v);
    haptics.selection();
    load();
  };

  const buddyCount = contacts.filter(ct => ct.isBuddy).length;

  return (
    <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
        <ChevronLeft size={24} color={c.accent} />
        <Text style={[styles.backText, { color: c.accent }]}>Back</Text>
      </Pressable>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Emergency contacts</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>
          SOS texts all of them your location. Turn on "Heat buddy" for anyone who should get your daily check-in results.
        </Text>

        {contacts.length > 0 && buddyCount === 0 && (
          <View style={[styles.note, { backgroundColor: c.starBg }]}>
            <Users size={18} color={c.star} />
            <Text style={[styles.noteText, { color: c.text }]}>No heat buddy yet. Pick someone who would check on you.</Text>
          </View>
        )}

        {contacts.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
            <Phone size={40} color={c.muted} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>No contacts yet</Text>
            <Text style={[styles.emptyText, { color: c.muted }]}>
              Add someone who can help if the heat gets to you. They'll be your first heat buddy.
            </Text>
          </View>
        ) : (
          contacts.map(ct => (
            <View key={ct.id} style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
              <Pressable
                onPress={() => openEdit(ct)}
                accessibilityRole="button"
                accessibilityLabel={`${ct.name}, ${ct.relationship}, ${ct.phoneNumber}. Edit`}
                style={styles.cardMain}
              >
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{ct.name}</Text>
                  {ct.isPrimary && (
                    <View style={[styles.pill, { backgroundColor: c.starBg }]}>
                      <Star size={13} color={c.star} fill={c.star} />
                      <Text style={[styles.pillText, { color: c.star }]}>Primary</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.meta, { color: c.muted }]}>{ct.relationship} · {ct.phoneNumber}</Text>
              </Pressable>

              <View style={[styles.buddyRow, { borderTopColor: c.divider }]}>
                <Users size={20} color={c.text} />
                <Text style={[styles.buddyLabel, { color: c.text }]}>Heat buddy</Text>
                <Switch
                  value={!!ct.isBuddy}
                  onValueChange={v => toggleBuddy(ct, v)}
                  trackColor={{ true: c.accent, false: c.divider }}
                  accessibilityLabel={`${ct.name} is a heat buddy`}
                />
              </View>

              <View style={[styles.actions, { borderTopColor: c.divider }]}>
                {!ct.isPrimary && (
                  <Pressable
                    onPress={() => { setPrimaryContact(ct.id); haptics.selection(); load(); }}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.action, { backgroundColor: pressed ? c.pressed : 'transparent' }]}
                  >
                    <Star size={18} color={c.star} />
                    <Text style={[styles.actionText, { color: c.text }]}>Make primary</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => openEdit(ct)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.action, { backgroundColor: pressed ? c.pressed : 'transparent' }]}
                >
                  <Text style={[styles.actionText, { color: c.accent }]}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={() => remove(ct)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${ct.name}`}
                  style={({ pressed }) => [styles.action, styles.actionIcon, { backgroundColor: pressed ? c.pressed : 'transparent' }]}
                >
                  <Trash2 size={20} color={c.danger} />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: c.bg }]}>
        <Pressable
          onPress={openAdd}
          accessibilityRole="button"
          style={({ pressed }) => [styles.addBtn, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Plus size={22} color={c.onAccent} strokeWidth={3} />
          <Text style={[styles.addText, { color: c.onAccent }]}>Add contact</Text>
        </Pressable>
      </View>

      {/* ── Add / edit sheet ─────────────────────────────────────────────── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modal, { backgroundColor: c.bg }]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: c.divider }]}>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8} style={styles.iconBtn}>
              <X size={24} color={c.text} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: c.text }]}>{editing ? 'Edit contact' : 'Add contact'}</Text>
            <View style={styles.iconBtn} />
          </View>

          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: c.text }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, borderWidth, color: c.text }]}
              placeholder="e.g. Maria Lopez"
              placeholderTextColor={c.placeholder}
              value={name}
              onChangeText={setName}
              autoFocus
              textContentType="name"
              autoComplete="name"
            />

            <Text style={[styles.label, { color: c.text }]}>Phone number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, borderWidth, color: c.text }]}
              placeholder="(480) 555-0123"
              placeholderTextColor={c.placeholder}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
            />

            <Text style={[styles.label, { color: c.text }]}>Relationship (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.border, borderWidth, color: c.text }]}
              placeholder="Daughter, neighbor, friend…"
              placeholderTextColor={c.placeholder}
              value={relationship}
              onChangeText={setRelationship}
            />

            <View style={[styles.buddyCard, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
              <Users size={22} color={c.text} />
              <View style={styles.flex1}>
                <Text style={[styles.buddyTitle, { color: c.text }]}>Heat buddy</Text>
                <Text style={[styles.buddySub, { color: c.muted }]}>Can get your check-in results by text.</Text>
              </View>
              <Switch
                value={isBuddy}
                onValueChange={setIsBuddy}
                trackColor={{ true: c.accent, false: c.divider }}
                accessibilityLabel="Heat buddy"
              />
            </View>

            <Pressable
              onPress={save}
              accessibilityRole="button"
              style={({ pressed }) => [styles.addBtn, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1, marginTop: 12 }]}
            >
              <Text style={[styles.addText, { color: c.onAccent }]}>{editing ? 'Save changes' : 'Add contact'}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 17, fontWeight: '600' },
  content: { paddingHorizontal: 20, gap: 12 },
  flex1: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.3, marginTop: 8 },
  subtitle: { fontSize: 16, lineHeight: 23, marginTop: -4, marginBottom: 4 },

  note: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  noteText: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '700' },

  empty: { borderRadius: 16, padding: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 19, fontWeight: '800' },
  emptyText: { fontSize: 15, lineHeight: 21, textAlign: 'center' },

  card: { borderRadius: 16, overflow: 'hidden' },
  cardMain: { padding: 16, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 18, fontWeight: '800', flexShrink: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '800' },
  meta: { fontSize: 15 },
  buddyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, minHeight: 56, borderTopWidth: 1 },
  buddyLabel: { flex: 1, fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', borderTopWidth: 1 },
  action: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  actionIcon: { flex: 0, width: 60 },
  actionText: { fontSize: 15, fontWeight: '800' },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10 },
  addBtn: { minHeight: 56, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 18, fontWeight: '800' },

  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  form: { padding: 20, gap: 8 },
  label: { fontSize: 15, fontWeight: '800', marginTop: 8 },
  input: { borderRadius: 12, paddingHorizontal: 14, minHeight: 52, fontSize: 17 },
  buddyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14, marginTop: 14 },
  buddyTitle: { fontSize: 17, fontWeight: '800' },
  buddySub: { fontSize: 14, lineHeight: 19, marginTop: 2 },
});
