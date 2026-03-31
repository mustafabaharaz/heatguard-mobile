import haptics from '../../src/utils/haptics';
import AnimatedEntrance from '../../src/components/ui/AnimatedEntrance';
import PressableScale from '../../src/components/ui/PressableScale';
// app/community/neighbor-network.tsx
// Neighbor Wellness Network — Phase 2: Community Network

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  loadNeighbors,
  addNeighbor,
  checkInNeighbor,
  removeNeighbor,
  getNeighborStats,
  formatLastChecked,
  type Neighbor,
  type WellnessStatus,
} from '../../src/features/community/storage/neighborStorage';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:           '#0A1628',
  surface:      '#1A2540',
  card:         '#1E2D4A',
  border:       '#2A3F5F',
  textPrimary:  '#F8FAFC',
  textSecondary:'#94A3B8',
  textMuted:    '#64748B',
  navy:         '#0A1628',
  accent:       '#3B82F6',

  status: {
    ok:      { bg: '#064E3B', text: '#10B981', label: 'Checked In' },
    unknown: { bg: '#1E2D4A', text: '#64748B', label: 'Unknown'    },
    concern: { bg: '#451A03', text: '#F97316', label: 'Concern'    },
    urgent:  { bg: '#3B0764', text: '#A855F7', label: 'Urgent'     },
  } as Record<WellnessStatus, { bg: string; text: string; label: string }>,
};

const FILTER_TABS = [
  { key: 'all',     label: 'All'         },
  { key: 'needs',   label: 'Needs Check' },
  { key: 'ok',      label: 'Checked In'  },
  { key: 'concern', label: 'Concern'     },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]['key'];

// ─── Check-in Modal ───────────────────────────────────────────────────────────

interface CheckInModalProps {
  neighbor: Neighbor | null;
  visible: boolean;
  onClose: () => void;
  onSubmit: (status: WellnessStatus, note: string) => void;
}

const STATUS_OPTIONS: { status: WellnessStatus; label: string; desc: string; icon: string }[] = [
  { status: 'ok',      label: 'All Good',    desc: 'Safe, comfortable, no concerns',   icon: 'checkmark-circle' },
  { status: 'concern', label: 'Some Concern',desc: 'Minor issue — monitor closely',    icon: 'warning'          },
  { status: 'urgent',  label: 'Needs Help',  desc: 'Immediate assistance required',    icon: 'alert-circle'     },
  { status: 'unknown', label: 'No Answer',   desc: 'Could not reach or make contact',  icon: 'help-circle'      },
];

function CheckInModal({ neighbor, visible, onClose, onSubmit }: CheckInModalProps) {
  const [selected, setSelected] = useState<WellnessStatus>('ok');
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    onSubmit(selected, note.trim());
    setNote('');
    setSelected('ok');
  };

  if (!neighbor) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.sheetHandle} />

          <Text style={s.sheetTitle}>Check In: {neighbor.name}</Text>
          <Text style={s.sheetSubtitle}>{neighbor.address}</Text>

          <Text style={s.sectionLabel}>Wellness Status</Text>
          {STATUS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.status}
              style={[s.statusOption, selected === opt.status && s.statusOptionSelected]}
              onPress={() => setSelected(opt.status)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected === opt.status }}
              accessibilityLabel={opt.label}
            >
              <Ionicons
                name={opt.icon as any}
                size={22}
                color={C.status[opt.status].text}
                style={s.statusIcon}
              />
              <View style={s.statusTextBlock}>
                <Text style={[s.statusLabel, { color: C.status[opt.status].text }]}>
                  {opt.label}
                </Text>
                <Text style={s.statusDesc}>{opt.desc}</Text>
              </View>
              {selected === opt.status && (
                <Ionicons name="checkmark" size={18} color={C.accent} />
              )}
            </Pressable>
          ))}

          <Text style={[s.sectionLabel, { marginTop: 20 }]}>Note (optional)</Text>
          <TextInput
            style={s.noteInput}
            placeholder="Add a note about this check-in..."
            placeholderTextColor={C.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            accessibilityLabel="Check-in note"
          />

          <View style={s.sheetActions}>
            <Pressable style={s.cancelBtn} onPress={onClose} accessibilityRole="button">
              <Text style={s.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={s.submitBtn}
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel="Submit check-in"
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={s.submitBtnText}>Submit Check-in</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Neighbor Modal ───────────────────────────────────────────────────────

interface AddNeighborModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; address: string; age?: number; phone?: string; conditions?: string[]; notes?: string }) => void;
}

function AddNeighborModal({ visible, onClose, onSubmit }: AddNeighborModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [conditionsText, setConditionsText] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!name.trim() || !address.trim()) {
      Alert.alert('Required Fields', 'Please enter a name and address.');
      return;
    }
    onSubmit({
      name: name.trim(),
      address: address.trim(),
      age: age ? parseInt(age, 10) : undefined,
      phone: phone.trim() || undefined,
      conditions: conditionsText.trim()
        ? conditionsText.split(',').map((c) => c.trim()).filter(Boolean)
        : undefined,
      notes: notes.trim() || undefined,
    });
    setName(''); setAddress(''); setAge(''); setPhone('');
    setConditionsText(''); setNotes('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <ScrollView contentContainerStyle={s.addSheet} keyboardShouldPersistTaps="handled">
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Register Neighbor</Text>
          <Text style={s.sheetSubtitle}>Add a vulnerable neighbor to your wellness network</Text>

          {[
            { label: 'Full Name *',       value: name,           setter: setName,           placeholder: 'e.g. Eleanor Voss',             keyboardType: 'default' as const },
            { label: 'Address *',          value: address,        setter: setAddress,        placeholder: 'Street address or apt',          keyboardType: 'default' as const },
            { label: 'Age',                value: age,            setter: setAge,            placeholder: 'Optional',                       keyboardType: 'numeric' as const },
            { label: 'Phone Number',       value: phone,          setter: setPhone,          placeholder: 'Optional',                       keyboardType: 'phone-pad' as const },
            { label: 'Health Conditions',  value: conditionsText, setter: setConditionsText, placeholder: 'Comma-separated (e.g. diabetes, no AC)', keyboardType: 'default' as const },
          ].map((field) => (
            <View key={field.label} style={s.fieldBlock}>
              <Text style={s.fieldLabel}>{field.label}</Text>
              <TextInput
                style={s.fieldInput}
                value={field.value}
                onChangeText={field.setter}
                placeholder={field.placeholder}
                placeholderTextColor={C.textMuted}
                keyboardType={field.keyboardType}
                accessibilityLabel={field.label}
              />
            </View>
          ))}

          <View style={s.fieldBlock}>
            <Text style={s.fieldLabel}>Notes</Text>
            <TextInput
              style={[s.fieldInput, { height: 72, paddingTop: 10 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything volunteers should know..."
              placeholderTextColor={C.textMuted}
              multiline
              accessibilityLabel="Notes about this neighbor"
            />
          </View>

          <View style={s.sheetActions}>
            <Pressable style={s.cancelBtn} onPress={onClose} accessibilityRole="button">
              <Text style={s.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={s.submitBtn}
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel="Add neighbor"
            >
              <Ionicons name="person-add" size={16} color="#fff" />
              <Text style={s.submitBtnText}>Add Neighbor</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Neighbor Card ────────────────────────────────────────────────────────────

interface NeighborCardProps {
  neighbor: Neighbor;
  onCheckIn: (n: Neighbor) => void;
  onRemove: (id: string) => void;
}

function NeighborCard({ neighbor, onCheckIn, onRemove }: NeighborCardProps) {
  const statusMeta = C.status[neighbor.checkInStatus];
  const initials = neighbor.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const needsAttention =
    neighbor.checkInStatus === 'concern' ||
    neighbor.checkInStatus === 'urgent' ||
    !neighbor.lastChecked ||
    (Date.now() - neighbor.lastChecked) > 12 * 60 * 60 * 1000;

  return (
    <View
      style={[s.neighborCard, needsAttention && s.neighborCardAttention]}
      accessibilityRole="none"
      accessibilityLabel={`${neighbor.name}, status ${statusMeta.label}`}
    >
      {/* Avatar + Status Row */}
      <View style={s.cardTopRow}>
        <View style={[s.avatar, { borderColor: statusMeta.text }]}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>

        <View style={s.cardInfo}>
          <View style={s.cardNameRow}>
            <Text style={s.neighborName}>{neighbor.name}</Text>
            {neighbor.age && (
              <Text style={s.neighborAge}>{neighbor.age} yrs</Text>
            )}
          </View>
          <Text style={s.neighborAddress} numberOfLines={1}>{neighbor.address}</Text>
          {neighbor.conditions && neighbor.conditions.length > 0 && (
            <View style={s.conditionRow}>
              {neighbor.conditions.slice(0, 2).map((c) => (
                <View key={c} style={s.conditionPill}>
                  <Text style={s.conditionText}>{c}</Text>
                </View>
              ))}
              {neighbor.conditions.length > 2 && (
                <Text style={s.conditionMore}>+{neighbor.conditions.length - 2}</Text>
              )}
            </View>
          )}
        </View>

        <View style={[s.statusBadge, { backgroundColor: statusMeta.bg }]}>
          <Text style={[s.statusBadgeText, { color: statusMeta.text }]}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      {/* Last Checked + Actions */}
      <View style={s.cardBottomRow}>
        <View style={s.lastCheckedRow}>
          <Ionicons name="time-outline" size={12} color={C.textMuted} />
          <Text style={s.lastCheckedText}>
            Last checked {formatLastChecked(neighbor.lastChecked)}
          </Text>
        </View>

        <View style={s.cardActions}>
          <Pressable
            style={s.removeBtn}
            onPress={() => onRemove(neighbor.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove neighbor"
          >
            <Ionicons name="trash-outline" size={14} color={C.textMuted} />
          </Pressable>
          <Pressable
            style={s.checkInBtn}
            onPress={() => onCheckIn(neighbor)}
            accessibilityRole="button"
            accessibilityLabel={`Check in on ${neighbor.name}`}
          >
            <Ionicons name="heart-outline" size={14} color={C.bg} />
            <Text style={s.checkInBtnText}>Check In</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NeighborNetworkScreen() {
  const [neighbors, setNeighbors] = useState<Neighbor[]>(() => loadNeighbors());
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [checkInTarget, setCheckInTarget] = useState<Neighbor | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const stats = useMemo(() => getNeighborStats(neighbors), [neighbors]);

  const filteredNeighbors = useMemo(() => {
    switch (activeFilter) {
      case 'needs': return neighbors.filter((n) => {
        if (n.checkInStatus === 'concern' || n.checkInStatus === 'urgent') return true;
        if (!n.lastChecked) return true;
        return (Date.now() - n.lastChecked) > 12 * 60 * 60 * 1000;
      });
      case 'ok':      return neighbors.filter((n) => n.checkInStatus === 'ok');
      case 'concern': return neighbors.filter((n) => n.checkInStatus === 'concern' || n.checkInStatus === 'urgent');
      default:        return neighbors;
    }
  }, [neighbors, activeFilter]);

  const handleCheckInSubmit = useCallback((status: WellnessStatus, note: string) => {
    if (!checkInTarget) return;
    const updated = checkInNeighbor(checkInTarget.id, status, note || undefined);
    setNeighbors(updated);
    setCheckInTarget(null);
  }, [checkInTarget]);

  const handleAddNeighbor = useCallback((data: Parameters<typeof addNeighbor>[0]) => {
    addNeighbor(data);
    setNeighbors(loadNeighbors());
    setShowAdd(false);
  }, []);

  const handleRemove = useCallback((id: string) => {
    Alert.alert(
      'Remove Neighbor',
      'Remove this neighbor from your wellness network?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setNeighbors(removeNeighbor(id)),
        },
      ]
    );
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Neighbor Network</Text>
          <Text style={s.headerSub}>{stats.total} registered</Text>
        </View>
        <Pressable
          style={s.addHeaderBtn}
          onPress={() => setShowAdd(true)}
          accessibilityRole="button"
          accessibilityLabel="Add neighbor"
        >
          <Ionicons name="person-add-outline" size={20} color={C.textPrimary} />
        </Pressable>
      </View>

      {/* Stats Row */}
      <View style={s.statsRow}>
        {[
          { value: stats.needsCheckIn, label: 'Needs Check', color: '#F97316' },
          { value: stats.ok,           label: 'All Good',    color: '#10B981' },
          { value: stats.concern,      label: 'Concern',     color: '#A855F7' },
        ].map((stat) => (
          <View key={stat.label} style={s.statCell}>
            <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Urgent Banner */}
      {stats.concern > 0 && (
        <View style={s.urgentBanner}>
          <Ionicons name="alert-circle" size={16} color="#A855F7" />
          <Text style={s.urgentBannerText}>
            {stats.concern} neighbor{stats.concern > 1 ? 's' : ''} need immediate attention
          </Text>
        </View>
      )}

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}
      >
        {FILTER_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[s.filterTab, activeFilter === tab.key && s.filterTabActive]}
            onPress={() => setActiveFilter(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeFilter === tab.key }}
          >
            <Text style={[s.filterTabText, activeFilter === tab.key && s.filterTabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Neighbor List */}
      <ScrollView
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredNeighbors.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="people-outline" size={48} color={C.textMuted} />
            <Text style={s.emptyTitle}>
              {activeFilter === 'all' ? 'No neighbors yet' : 'None in this category'}
            </Text>
            <Text style={s.emptyBody}>
              {activeFilter === 'all'
                ? 'Register vulnerable neighbors to track their wellness during extreme heat.'
                : 'Switch to "All" to see everyone.'}
            </Text>
            {activeFilter === 'all' && (
              <Pressable
                style={s.emptyAddBtn}
                onPress={() => setShowAdd(true)}
                accessibilityRole="button"
              >
                <Ionicons name="person-add-outline" size={16} color="#fff" />
                <Text style={s.emptyAddBtnText}>Add First Neighbor</Text>
              </Pressable>
            )}
          </View>
        ) : (
          filteredNeighbors.map((n) => (
            <NeighborCard
              key={n.id}
              neighbor={n}
              onCheckIn={setCheckInTarget}
              onRemove={handleRemove}
            />
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={s.fab}
        onPress={() => setShowAdd(true)}
        accessibilityRole="button"
        accessibilityLabel="Add a new neighbor"
      >
        <Ionicons name="person-add" size={22} color="#fff" />
      </Pressable>

      {/* Modals */}
      <CheckInModal
        neighbor={checkInTarget}
        visible={!!checkInTarget}
        onClose={() => setCheckInTarget(null)}
        onSubmit={handleCheckInSubmit}
      />
      <AddNeighborModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={handleAddNeighbor}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 12 : 4, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, color: C.textMuted, marginTop: 1 },
  addHeaderBtn: { padding: 8, borderRadius: 8, backgroundColor: C.surface },

  // Stats
  statsRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, color: C.textMuted, marginTop: 2, textAlign: 'center' },

  // Urgent banner
  urgentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1A0A2E', borderWidth: 1, borderColor: '#4C1D95',
    marginHorizontal: 16, marginTop: 12, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  urgentBannerText: { color: '#C4B5FD', fontSize: 13, fontWeight: '600', flex: 1 },

  // Filters
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignSelf: 'flex-start', height: 34, justifyContent: 'center',
  },
  filterTabActive: { backgroundColor: C.accent, borderColor: C.accent },
  filterTabText: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
  filterTabTextActive: { color: '#fff', fontWeight: '600' },

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Neighbor Card
  neighborCard: {
    backgroundColor: C.card, borderRadius: 14, marginBottom: 12,
    padding: 14, borderWidth: 1, borderColor: C.border,
  },
  neighborCardAttention: { borderColor: '#F97316', borderWidth: 1.5 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: C.textPrimary, fontFamily: 'Inter_700Bold' },
  cardInfo: { flex: 1 },
  cardNameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  neighborName: { fontSize: 15, fontWeight: '700', color: C.textPrimary, fontFamily: 'Inter_700Bold' },
  neighborAge: { fontSize: 12, color: C.textMuted },
  neighborAddress: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  conditionPill: {
    backgroundColor: '#1E3A5F', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
  },
  conditionText: { fontSize: 10, color: '#93C5FD', fontWeight: '500' },
  conditionMore: { fontSize: 10, color: C.textMuted, paddingTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  cardBottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  lastCheckedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lastCheckedText: { fontSize: 11, color: C.textMuted },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeBtn: { padding: 6 },
  checkInBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    minHeight: 32,
  },
  checkInBtnText: { fontSize: 12, fontWeight: '600', color: C.bg },

  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary, marginTop: 16, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: C.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, marginTop: 24,
  },
  emptyAddBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // FAB
  fab: {
    position: 'absolute', bottom: 28, right: 20, width: 56, height: 56,
    borderRadius: 28, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },

  // Overlay / Sheets
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  addSheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: C.textPrimary, fontFamily: 'Inter_700Bold' },
  sheetSubtitle: { fontSize: 13, color: C.textMuted, marginTop: 3, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },

  // Status Options
  statusOption: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: C.border,
  },
  statusOptionSelected: { borderColor: C.accent, backgroundColor: '#0F1E3A' },
  statusIcon: { marginRight: 12 },
  statusTextBlock: { flex: 1 },
  statusLabel: { fontSize: 15, fontWeight: '600' },
  statusDesc: { fontSize: 12, color: C.textMuted, marginTop: 1 },

  // Note Input
  noteInput: {
    backgroundColor: C.card, borderRadius: 12, padding: 14,
    color: C.textPrimary, fontSize: 14, borderWidth: 1, borderColor: C.border,
    textAlignVertical: 'top', minHeight: 80,
  },

  // Field
  fieldBlock: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textSecondary, marginBottom: 6, letterSpacing: 0.3 },
  fieldInput: {
    backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    color: C.textPrimary, fontSize: 14, borderWidth: 1, borderColor: C.border,
  },

  // Sheet Actions
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.card, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: C.textSecondary },
  submitBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: C.accent,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
