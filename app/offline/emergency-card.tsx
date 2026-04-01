// ─────────────────────────────────────────────
// Emergency Offline Card
// All life-critical safety info in one screen.
// Works with zero network. Loads from cache.
// ─────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  cacheGet,
  CACHE_KEYS,
} from '../../src/features/offline/offlineCache';
import {
  HEAT_SYMPTOMS_DATA,
  SOS_INSTRUCTIONS_DATA,
  runFullSync,
  getSyncStatus,
  type SyncStatus,
} from '../../src/features/offline/offlineSync';
import { useNetworkStatus } from '../../src/utils/networkStatus';

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  BG:      '#0F172A',
  CARD:    '#1E293B',
  BORDER:  '#334155',
  TEXT:    '#F1F5F9',
  TEXT_DIM:'#94A3B8',
  TEXT_MUTED: '#64748B',
  ACCENT:  '#3B82F6',
  SUCCESS: '#22C55E',
  WARNING: '#F59E0B',
  DANGER:  '#EF4444',
  PURPLE:  '#A855F7',
  CRISIS:  '#7C3AED',
} as const;

const SEVERITY_COLORS: Record<string, string> = {
  moderate: C.WARNING,
  high:     C.DANGER,
  crisis:   C.PURPLE,
};

// ─── Components ───────────────────────────────────────────────────────────────

function SectionHeader({ title, color = C.TEXT }: { title: string; color?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionBar, { backgroundColor: color }]} />
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
    </View>
  );
}

function EmergencyCallButton({ label, number, color }: { label: string; number: string; color: string }) {
  return (
    <TouchableOpacity
      style={[styles.callButton, { backgroundColor: color + '18', borderColor: color + '55' }]}
      onPress={() => Linking.openURL(`tel:${number.replace(/\D/g, '')}`)}
      activeOpacity={0.75}
    >
      <Text style={[styles.callButtonNumber, { color }]}>{number}</Text>
      <Text style={styles.callButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function SymptomCard({
  symptom,
}: {
  symptom: typeof HEAT_SYMPTOMS_DATA[number];
}) {
  const [expanded, setExpanded] = useState(symptom.severity === 'crisis');
  const color = SEVERITY_COLORS[symptom.severity] ?? C.WARNING;

  return (
    <View style={[styles.symptomCard, { borderLeftColor: color }]}>
      <TouchableOpacity
        style={styles.symptomHeader}
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.8}
      >
        <View style={styles.symptomHeaderLeft}>
          <Text style={[styles.symptomName, { color }]}>{symptom.name}</Text>
          {symptom.callEmergency && (
            <View style={styles.emergencyTag}>
              <Text style={styles.emergencyTagText}>CALL 911</Text>
            </View>
          )}
        </View>
        <Text style={[styles.chevron, { color: C.TEXT_MUTED }]}>
          {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.symptomBody}>
          <Text style={styles.symptomSectionLabel}>Symptoms</Text>
          <View style={styles.symptomList}>
            {symptom.symptoms.map((s) => (
              <View key={s} style={styles.symptomItem}>
                <View style={[styles.symptomDot, { backgroundColor: color }]} />
                <Text style={styles.symptomText}>{s}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.actionBox, { backgroundColor: color + '14', borderColor: color + '44' }]}>
            <Text style={styles.symptomSectionLabel}>What to do</Text>
            <Text style={[styles.actionText, { color: symptom.callEmergency ? color : C.TEXT }]}>
              {symptom.action}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function SOSStepsCard() {
  return (
    <View style={styles.card}>
      {SOS_INSTRUCTIONS_DATA.steps.map((step, i) => (
        <View key={step.step}>
          <View style={styles.sosStep}>
            <View style={styles.sosStepNumber}>
              <Text style={styles.sosStepNumberText}>{step.step}</Text>
            </View>
            <Text style={styles.sosStepText}>{step.action}</Text>
          </View>
          {i < SOS_INSTRUCTIONS_DATA.steps.length - 1 && (
            <View style={styles.sosDivider} />
          )}
        </View>
      ))}
      <View style={[styles.sosNote, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }]}>
        <Text style={[styles.sosNoteText, { color: C.DANGER }]}>
          {SOS_INSTRUCTIONS_DATA.note}
        </Text>
      </View>
    </View>
  );
}

function CacheStatusRow({ status }: { status: SyncStatus | null }) {
  if (!status) return null;

  const criticalOk = status.criticalCached;
  const color = criticalOk ? C.SUCCESS : C.DANGER;

  return (
    <View style={[styles.cacheStatusRow, { borderColor: color + '44', backgroundColor: color + '10' }]}>
      <Text style={[styles.cacheStatusIcon, { color }]}>
        {criticalOk ? '✓' : '⚠'}
      </Text>
      <View style={styles.cacheStatusText}>
        <Text style={[styles.cacheStatusTitle, { color }]}>
          {criticalOk ? 'Emergency data cached' : 'Emergency data not cached'}
        </Text>
        <Text style={styles.cacheStatusSub}>
          Last synced: {status.lastSyncAgeLabel}
          {' · '}
          {status.inventory.filter((i) => i.hasData).length}/{status.inventory.length} items
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EmergencyOfflineCard() {
  const router = useRouter();
  const network = useNetworkStatus();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [nearestShelters, setNearestShelters] = useState<any[]>([]);

  useEffect(() => {
    loadCachedData();
  }, []);

  const loadCachedData = async () => {
    const status = await getSyncStatus();
    setSyncStatus(status);

    const contactsResult = await cacheGet<any[]>(CACHE_KEYS.EMERGENCY_CONTACTS);
    if (contactsResult) setEmergencyContacts(contactsResult.data);

    const sheltersResult = await cacheGet<any[]>(CACHE_KEYS.SHELTER_LIST);
    if (sheltersResult) {
      setNearestShelters(sheltersResult.data.slice(0, 3));
    }
  };

  const handleSync = async () => {
    if (!network.isOnline || syncing) return;
    setSyncing(true);
    await runFullSync();
    await loadCachedData();
    setSyncing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Emergency Card</Text>
          <Text style={[styles.headerSub, { color: network.isOffline ? C.WARNING : C.SUCCESS }]}>
            {network.isOffline ? '⚡ Offline mode' : '● Live'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleSync}
          style={styles.syncBtn}
          disabled={!network.isOnline || syncing}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {syncing
            ? <ActivityIndicator size="small" color={C.ACCENT} />
            : <Text style={[styles.syncIcon, { color: network.isOnline ? C.ACCENT : C.TEXT_MUTED }]}>⟳</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cache Status */}
        <CacheStatusRow status={syncStatus} />

        {/* Emergency Calls */}
        <View style={styles.section}>
          <SectionHeader title="Emergency Numbers" color={C.DANGER} />
          <View style={styles.callGrid}>
            <EmergencyCallButton label="Emergency Services" number="911"   color={C.DANGER} />
            <EmergencyCallButton label="Heat & Crisis Line" number="2-1-1" color={C.WARNING} />
          </View>
        </View>

        {/* Emergency Contacts */}
        {emergencyContacts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Your Emergency Contacts" color={C.ACCENT} />
            <View style={styles.card}>
              {emergencyContacts.map((contact: any, i: number) => (
                <View key={contact.id ?? i}>
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => Linking.openURL(`tel:${contact.phone?.replace(/\D/g, '')}`)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.contactAvatar}>
                      <Text style={styles.contactInitial}>
                        {contact.name?.charAt(0)?.toUpperCase() ?? '?'}
                      </Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactPhone}>{contact.phone}</Text>
                    </View>
                    <Text style={[styles.callIcon, { color: C.SUCCESS }]}>✆</Text>
                  </TouchableOpacity>
                  {i < emergencyContacts.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Nearest Shelters */}
        {nearestShelters.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Nearest Cooling Shelters" color={C.ACCENT} />
            <View style={styles.card}>
              {nearestShelters.map((shelter: any, i: number) => (
                <View key={shelter.id}>
                  <View style={styles.shelterRow}>
                    <View style={styles.shelterInfo}>
                      <Text style={styles.shelterName}>{shelter.name}</Text>
                      <Text style={styles.shelterAddress}>{shelter.address}</Text>
                      <Text style={styles.shelterMeta}>{shelter.distanceMiles} mi · {shelter.hoursLabel}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${shelter.phone?.replace(/\D/g, '')}`)}
                      style={styles.shelterCallBtn}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.shelterCallIcon}>✆</Text>
                    </TouchableOpacity>
                  </View>
                  {i < nearestShelters.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* SOS Steps */}
        <View style={styles.section}>
          <SectionHeader title="Heat Emergency Steps" color={C.DANGER} />
          <SOSStepsCard />
        </View>

        {/* Symptom Guide */}
        <View style={styles.section}>
          <SectionHeader title="Symptom Guide" color={C.WARNING} />
          <Text style={styles.symptomGuideHint}>Tap any condition to expand</Text>
          {HEAT_SYMPTOMS_DATA.map((symptom) => (
            <SymptomCard key={symptom.id} symptom={symptom} />
          ))}
        </View>

        {/* Sync prompt if online */}
        {network.isOnline && (
          <View style={styles.section}>
            <SectionHeader title="Offline Readiness" color={C.SUCCESS} />
            <View style={styles.card}>
              {syncStatus?.inventory.map((item) => (
                <View key={item.key} style={styles.cacheItemRow}>
                  <Text style={[styles.cacheItemDot, { color: item.hasData ? C.SUCCESS : C.DANGER }]}>
                    {item.hasData ? '●' : '○'}
                  </Text>
                  <Text style={styles.cacheItemKey} numberOfLines={1}>
                    {item.key.split(':').pop()?.replace(/_/g, ' ')}
                  </Text>
                  <Text style={[styles.cacheItemAge, { color: item.isStale ? C.WARNING : C.TEXT_MUTED }]}>
                    {item.ageLabel}
                  </Text>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.syncAllBtn, syncing && styles.syncAllBtnDisabled]}
                onPress={handleSync}
                disabled={syncing}
                activeOpacity={0.8}
              >
                <Text style={styles.syncAllBtnText}>
                  {syncing ? 'Syncing…' : 'Sync All Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: C.BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.BORDER,
  },
  backBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon:   { fontSize: 22, color: C.TEXT },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '600', color: C.TEXT, letterSpacing: 0.3 },
  headerSub:    { fontSize: 11, marginTop: 1 },
  syncBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  syncIcon:   { fontSize: 22 },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 20 },

  // Cache status
  cacheStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  cacheStatusIcon:  { fontSize: 18, flexShrink: 0 },
  cacheStatusText:  { flex: 1, gap: 2 },
  cacheStatusTitle: { fontSize: 13, fontWeight: '700' },
  cacheStatusSub:   { fontSize: 11, color: C.TEXT_MUTED },

  // Section
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionBar:    { width: 3, height: 16, borderRadius: 2 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  // Call buttons
  callGrid: { flexDirection: 'row', gap: 10 },
  callButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  callButtonNumber: { fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  callButtonLabel:  { fontSize: 11, color: C.TEXT_MUTED, textAlign: 'center' },

  // Card
  card: {
    backgroundColor: C.CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.BORDER,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: C.BORDER, marginLeft: 14 },

  // Contacts
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitial: { fontSize: 16, fontWeight: '700', color: C.ACCENT },
  contactInfo:    { flex: 1 },
  contactName:    { fontSize: 14, fontWeight: '600', color: C.TEXT },
  contactPhone:   { fontSize: 12, color: C.TEXT_MUTED, marginTop: 1 },
  callIcon:       { fontSize: 20 },

  // Shelters
  shelterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  shelterInfo:    { flex: 1, gap: 2 },
  shelterName:    { fontSize: 14, fontWeight: '600', color: C.TEXT },
  shelterAddress: { fontSize: 11, color: C.TEXT_MUTED },
  shelterMeta:    { fontSize: 11, color: C.TEXT_DIM },
  shelterCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelterCallIcon: { fontSize: 18, color: C.SUCCESS },

  // SOS Steps
  sosStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  sosStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  sosStepNumberText: { fontSize: 12, fontWeight: '800', color: C.DANGER },
  sosStepText:       { flex: 1, fontSize: 13, color: C.TEXT, lineHeight: 19 },
  sosDivider:        { height: 1, backgroundColor: C.BORDER, marginLeft: 14 },
  sosNote: {
    margin: 12,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sosNoteText: { fontSize: 12, fontWeight: '600', lineHeight: 17 },

  // Symptoms
  symptomGuideHint: { fontSize: 11, color: C.TEXT_MUTED, marginBottom: -4 },
  symptomCard: {
    backgroundColor: C.CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.BORDER,
    borderLeftWidth: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  symptomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  symptomHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  symptomName:       { fontSize: 15, fontWeight: '700', color: C.TEXT },
  emergencyTag: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  emergencyTagText: { fontSize: 9, fontWeight: '800', color: C.DANGER, letterSpacing: 0.8 },
  chevron: { fontSize: 12 },
  symptomBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  symptomSectionLabel: { fontSize: 10, fontWeight: '700', color: C.TEXT_MUTED, letterSpacing: 0.8, marginBottom: 4 },
  symptomList: { gap: 6 },
  symptomItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  symptomDot:  { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  symptomText: { flex: 1, fontSize: 13, color: C.TEXT_DIM, lineHeight: 18 },
  actionBox:   { borderRadius: 8, borderWidth: 1, padding: 12, gap: 4 },
  actionText:  { fontSize: 13, lineHeight: 19, fontWeight: '500' },

  // Cache inventory
  cacheItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.BORDER,
  },
  cacheItemDot:  { fontSize: 10, width: 12 },
  cacheItemKey:  { flex: 1, fontSize: 12, color: C.TEXT_DIM, textTransform: 'capitalize' },
  cacheItemAge:  { fontSize: 11 },
  syncAllBtn: {
    backgroundColor: C.ACCENT,
    margin: 12,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  syncAllBtnDisabled: { opacity: 0.4 },
  syncAllBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  bottomPad: { height: 40 },
});
