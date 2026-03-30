// app/community/resources.tsx
// Community Resource Exchange — Phase 2: Community Network

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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  loadResources,
  postResource,
  claimResource,
  removeResource,
  filterResources,
  isExpired,
  formatAvailability,
  formatResourceTime,
  RESOURCE_META,
  type Resource,
  type ResourceType,
} from '../../src/features/community/storage/resourceStorage';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:           '#0A1628',
  surface:      '#1A2540',
  card:         '#1E2D4A',
  border:       '#2A3F5F',
  textPrimary:  '#F8FAFC',
  textSecondary:'#94A3B8',
  textMuted:    '#64748B',
  accent:       '#3B82F6',
  danger:       '#EF4444',
  success:      '#10B981',
  warning:      '#F59E0B',
};

// ─── Category Filters ─────────────────────────────────────────────────────────

const CATEGORY_FILTERS: { key: ResourceType | 'all'; label: string; icon: string }[] = [
  { key: 'all',      label: 'All',       icon: 'apps-outline'       },
  { key: 'water',    label: 'Water',     icon: 'water-outline'       },
  { key: 'cooling',  label: 'Cooling',   icon: 'snow-outline'        },
  { key: 'transport',label: 'Transport', icon: 'car-outline'         },
  { key: 'supplies', label: 'Supplies',  icon: 'cube-outline'        },
  { key: 'shelter',  label: 'Shelter',   icon: 'home-outline'        },
];

// ─── Post Resource Modal ──────────────────────────────────────────────────────

interface PostResourceModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Resource, 'id' | 'timestamp' | 'claimed' | 'claimedCount'>) => void;
}

function PostResourceModal({ visible, onClose, onSubmit }: PostResourceModalProps) {
  const [type, setType] = useState<ResourceType>('water');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [quantityText, setQuantityText] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryHours, setExpiryHours] = useState('4');

  const handleSubmit = () => {
    if (!title.trim() || !description.trim() || !location.trim()) {
      Alert.alert('Required Fields', 'Please fill in title, description, and location.');
      return;
    }
    onSubmit({
      type,
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      postedBy: 'You',
      quantity: quantityText ? parseInt(quantityText, 10) : undefined,
      availableUntil: hasExpiry
        ? Date.now() + parseInt(expiryHours, 10) * 3600000
        : undefined,
      urgent,
    });
    // Reset
    setTitle(''); setDescription(''); setLocation('');
    setQuantityText(''); setUrgent(false); setHasExpiry(false); setExpiryHours('4');
    setType('water');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <ScrollView
          contentContainerStyle={s.sheet}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Post a Resource</Text>
          <Text style={s.sheetSub}>Share what you have with the community</Text>

          {/* Type selector */}
          <Text style={s.fieldLabel}>Resource Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.typeRow}
          >
            {(Object.keys(RESOURCE_META) as ResourceType[]).map((t) => {
              const meta = RESOURCE_META[t];
              const selected = type === t;
              return (
                <Pressable
                  key={t}
                  style={[s.typePill, selected && { backgroundColor: meta.color, borderColor: meta.color }]}
                  onPress={() => setType(t)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={[s.typePillText, selected && s.typePillTextSelected]}>
                    {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Fields */}
          {[
            { label: 'Title *',       value: title,       setter: setTitle,       placeholder: 'e.g. 3 cases of water available' },
            { label: 'Description *', value: description, setter: setDescription, placeholder: 'Details, instructions, conditions...' },
            { label: 'Location *',    value: location,    setter: setLocation,    placeholder: 'Address or landmark' },
            { label: 'Quantity',      value: quantityText,setter: setQuantityText,placeholder: 'Leave blank if unlimited' },
          ].map((f) => (
            <View key={f.label} style={s.fieldBlock}>
              <Text style={s.fieldLabel}>{f.label}</Text>
              <TextInput
                style={[s.fieldInput, f.label === 'Description *' && { height: 72, paddingTop: 10 }]}
                value={f.value}
                onChangeText={f.setter}
                placeholder={f.placeholder}
                placeholderTextColor={C.textMuted}
                multiline={f.label === 'Description *'}
                keyboardType={f.label === 'Quantity' ? 'numeric' : 'default'}
                accessibilityLabel={f.label}
              />
            </View>
          ))}

          {/* Expiry toggle */}
          <View style={s.toggleRow}>
            <View style={s.toggleInfo}>
              <Text style={s.toggleLabel}>Set Expiry Time</Text>
              <Text style={s.toggleSub}>Resource becomes unavailable after a set time</Text>
            </View>
            <Switch
              value={hasExpiry}
              onValueChange={setHasExpiry}
              trackColor={{ false: C.border, true: C.accent }}
              thumbColor="#fff"
            />
          </View>
          {hasExpiry && (
            <View style={s.fieldBlock}>
              <Text style={s.fieldLabel}>Available For (hours)</Text>
              <TextInput
                style={s.fieldInput}
                value={expiryHours}
                onChangeText={setExpiryHours}
                keyboardType="numeric"
                placeholder="e.g. 4"
                placeholderTextColor={C.textMuted}
                accessibilityLabel="Expiry hours"
              />
            </View>
          )}

          {/* Urgent toggle */}
          <View style={[s.toggleRow, { marginBottom: 20 }]}>
            <View style={s.toggleInfo}>
              <Text style={s.toggleLabel}>Mark as Urgent</Text>
              <Text style={s.toggleSub}>Urgent resources appear highlighted at the top</Text>
            </View>
            <Switch
              value={urgent}
              onValueChange={setUrgent}
              trackColor={{ false: C.border, true: C.danger }}
              thumbColor="#fff"
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
              accessibilityLabel="Post resource"
            >
              <Ionicons name="add-circle-outline" size={17} color="#fff" />
              <Text style={s.submitBtnText}>Post Resource</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Resource Card ────────────────────────────────────────────────────────────

interface ResourceCardProps {
  resource: Resource;
  onClaim: (id: string) => void;
  onRemove: (id: string) => void;
}

function ResourceCard({ resource, onClaim, onRemove }: ResourceCardProps) {
  const meta = RESOURCE_META[resource.type];
  const expired = isExpired(resource);
  const availability = formatAvailability(resource);
  const postedTime = formatResourceTime(resource.timestamp);

  return (
    <View
      style={[
        s.resourceCard,
        resource.urgent && s.urgentCard,
        expired && s.expiredCard,
      ]}
      accessibilityRole="article"
      accessibilityLabel={`${resource.title}, ${meta.label}, posted ${postedTime}`}
    >
      {/* Urgent Badge */}
      {resource.urgent && (
        <View style={s.urgentBadge}>
          <Ionicons name="alert-circle" size={12} color="#fff" />
          <Text style={s.urgentBadgeText}>URGENT</Text>
        </View>
      )}

      {/* Type + Header */}
      <View style={s.cardHeader}>
        <View style={[s.typeBadge, { backgroundColor: meta.color + '22', borderColor: meta.color + '66' }]}>
          <Text style={[s.typeBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        {expired && (
          <View style={s.expiredBadge}>
            <Text style={s.expiredBadgeText}>Expired</Text>
          </View>
        )}
        {resource.availableUntil && !expired && (
          <View style={s.timerBadge}>
            <Ionicons name="time-outline" size={11} color={C.warning} />
            <Text style={s.timerBadgeText}>{availability}</Text>
          </View>
        )}
      </View>

      <Text style={s.cardTitle}>{resource.title}</Text>
      <Text style={s.cardDescription} numberOfLines={2}>{resource.description}</Text>

      {/* Location */}
      <View style={s.locationRow}>
        <Ionicons name="location-outline" size={13} color={C.textMuted} />
        <Text style={s.locationText} numberOfLines={1}>{resource.location}</Text>
      </View>

      {/* Footer */}
      <View style={s.cardFooter}>
        <View style={s.footerLeft}>
          <Text style={s.postedBy}>
            {resource.postedBy} · {postedTime}
          </Text>
          {resource.quantity !== undefined && (
            <Text style={s.quantityText}>
              {resource.quantity - resource.claimedCount > 0
                ? `${resource.quantity - resource.claimedCount} remaining`
                : 'None left'}
            </Text>
          )}
          {resource.claimedCount > 0 && (
            <Text style={s.claimedText}>{resource.claimedCount} claimed</Text>
          )}
        </View>

        <View style={s.cardActions}>
          {resource.postedBy === 'You' && (
            <Pressable
              style={s.removeBtn}
              onPress={() => onRemove(resource.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Remove resource"
            >
              <Ionicons name="trash-outline" size={14} color={C.textMuted} />
            </Pressable>
          )}
          <Pressable
            style={[
              s.claimBtn,
              (resource.claimed || expired) && s.claimBtnDisabled,
            ]}
            onPress={() => !resource.claimed && !expired && onClaim(resource.id)}
            disabled={resource.claimed || expired}
            accessibilityRole="button"
            accessibilityLabel={resource.claimed ? 'Resource claimed' : 'Claim this resource'}
            accessibilityState={{ disabled: resource.claimed || expired }}
          >
            <Ionicons
              name={resource.claimed ? 'checkmark' : 'hand-right-outline'}
              size={13}
              color={resource.claimed || expired ? C.textMuted : '#fff'}
            />
            <Text style={[s.claimBtnText, (resource.claimed || expired) && s.claimBtnTextDisabled]}>
              {resource.claimed ? 'Claimed' : 'I Need This'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ResourcesScreen() {
  const [resources, setResources] = useState<Resource[]>(() => loadResources());
  const [activeCategory, setActiveCategory] = useState<ResourceType | 'all'>('all');
  const [showPost, setShowPost] = useState(false);

  const displayed = useMemo(() => {
    const filtered = filterResources(resources, activeCategory);
    // urgent first, then chronological
    return [...filtered].sort((a, b) => {
      if (a.urgent && !b.urgent) return -1;
      if (!a.urgent && b.urgent) return 1;
      return b.timestamp - a.timestamp;
    });
  }, [resources, activeCategory]);

  const urgentCount = useMemo(
    () => resources.filter((r) => r.urgent && !isExpired(r)).length,
    [resources]
  );

  const handleClaim = useCallback((id: string) => {
    Alert.alert(
      'Claim Resource',
      'Mark yourself as needing this resource?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, I Need It',
          onPress: () => setResources(claimResource(id)),
        },
      ]
    );
  }, []);

  const handleRemove = useCallback((id: string) => {
    Alert.alert(
      'Remove Resource',
      'Remove this resource from the board?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setResources(removeResource(id)),
        },
      ]
    );
  }, []);

  const handlePost = useCallback(
    (data: Parameters<typeof postResource>[0]) => {
      postResource(data);
      setResources(loadResources());
      setShowPost(false);
    },
    []
  );

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Resource Board</Text>
          <Text style={s.headerSub}>{resources.length} posted · {urgentCount > 0 ? `${urgentCount} urgent` : 'community exchange'}</Text>
        </View>
        <Pressable
          style={s.postHeaderBtn}
          onPress={() => setShowPost(true)}
          accessibilityRole="button"
          accessibilityLabel="Post a resource"
        >
          <Ionicons name="add" size={20} color={C.textPrimary} />
        </Pressable>
      </View>

      {/* Urgent Banner */}
      {urgentCount > 0 && (
        <View style={s.urgentBanner}>
          <Ionicons name="flame" size={15} color={C.danger} />
          <Text style={s.urgentBannerText}>
            {urgentCount} urgent resource{urgentCount > 1 ? 's' : ''} need attention right now
          </Text>
        </View>
      )}

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}
      >
        {CATEGORY_FILTERS.map((cat) => (
          <Pressable
            key={cat.key}
            style={[s.filterPill, activeCategory === cat.key && s.filterPillActive]}
            onPress={() => setActiveCategory(cat.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeCategory === cat.key }}
          >
            <Ionicons
              name={cat.icon as any}
              size={14}
              color={activeCategory === cat.key ? '#fff' : C.textMuted}
            />
            <Text style={[s.filterPillText, activeCategory === cat.key && s.filterPillTextActive]}>
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Resource List */}
      <ScrollView
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      >
        {displayed.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="cube-outline" size={48} color={C.textMuted} />
            <Text style={s.emptyTitle}>No resources posted</Text>
            <Text style={s.emptyBody}>
              {activeCategory === 'all'
                ? 'Be the first to share water, cooling space, or supplies with your neighbors.'
                : `No ${activeCategory} resources right now. Post one to help.`}
            </Text>
            <Pressable
              style={s.emptyPostBtn}
              onPress={() => setShowPost(true)}
              accessibilityRole="button"
            >
              <Ionicons name="add-circle-outline" size={16} color="#fff" />
              <Text style={s.emptyPostBtnText}>Post a Resource</Text>
            </Pressable>
          </View>
        ) : (
          displayed.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onClaim={handleClaim}
              onRemove={handleRemove}
            />
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={s.fab}
        onPress={() => setShowPost(true)}
        accessibilityRole="button"
        accessibilityLabel="Post a resource"
      >
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>

      {/* Post Modal */}
      <PostResourceModal
        visible={showPost}
        onClose={() => setShowPost(false)}
        onSubmit={handlePost}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 12 : 4, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, color: C.textMuted, marginTop: 1 },
  postHeaderBtn: { padding: 8, borderRadius: 8, backgroundColor: C.surface },

  urgentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1C0A0A', borderWidth: 1, borderColor: '#7F1D1D',
    marginHorizontal: 16, marginTop: 12, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  urgentBannerText: { color: '#FCA5A5', fontSize: 13, fontWeight: '600', flex: 1 },

  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignSelf: 'flex-start', height: 34,
  },
  filterPillActive: { backgroundColor: C.accent, borderColor: C.accent },
  filterPillText: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  filterPillTextActive: { color: '#fff', fontWeight: '600' },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Resource Card
  resourceCard: {
    backgroundColor: C.card, borderRadius: 14, marginBottom: 12,
    padding: 14, borderWidth: 1, borderColor: C.border,
  },
  urgentCard: { borderColor: C.danger, borderWidth: 1.5 },
  expiredCard: { opacity: 0.5 },

  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.danger, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8,
  },
  urgentBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  expiredBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: C.surface,
  },
  expiredBadgeText: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  timerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: '#1C1400', borderWidth: 1, borderColor: '#78350F',
  },
  timerBadgeText: { fontSize: 11, color: C.warning, fontWeight: '600' },

  cardTitle: { fontSize: 15, fontWeight: '700', color: C.textPrimary, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  cardDescription: { fontSize: 13, color: C.textSecondary, lineHeight: 19, marginBottom: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  locationText: { fontSize: 12, color: C.textMuted, flex: 1 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  footerLeft: { flex: 1, gap: 2 },
  postedBy: { fontSize: 11, color: C.textMuted },
  quantityText: { fontSize: 11, color: C.accent },
  claimedText: { fontSize: 11, color: C.textMuted },

  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeBtn: { padding: 6 },
  claimBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.accent, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, minHeight: 32,
  },
  claimBtnDisabled: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  claimBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  claimBtnTextDisabled: { color: C.textMuted },

  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary, marginTop: 16, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: C.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  emptyPostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, marginTop: 24,
  },
  emptyPostBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // FAB
  fab: {
    position: 'absolute', bottom: 28, right: 20, width: 56, height: 56,
    borderRadius: 28, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },

  // Modal / Sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: C.textPrimary, fontFamily: 'Inter_700Bold' },
  sheetSub: { fontSize: 13, color: C.textMuted, marginTop: 3, marginBottom: 20 },

  typeRow: { gap: 8, marginBottom: 20 },
  typePill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  typePillText: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
  typePillTextSelected: { color: '#fff', fontWeight: '700' },

  fieldBlock: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textSecondary, marginBottom: 6, letterSpacing: 0.3 },
  fieldInput: {
    backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    color: C.textPrimary, fontSize: 14, borderWidth: 1, borderColor: C.border,
    textAlignVertical: 'top',
  },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, marginBottom: 14,
  },
  toggleInfo: { flex: 1, marginRight: 16 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: C.textPrimary },
  toggleSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
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
