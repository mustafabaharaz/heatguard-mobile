// ─────────────────────────────────────────────
// Emergency Network Hub Screen
// SVG live map, shelter capacity, volunteer
// dispatch, and active request management
// ─────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, {
  Rect,
  Circle,
  Line,
  Text as SvgText,
  G,
  Defs,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import {
  computeNetworkSnapshot,
  getShelterStatusConfig,
  getDispatchStatusConfig,
  getUrgencyConfig,
  getSkillLabel,
  getOccupancyPercent,
  formatMinutesAgo,
  formatRequestAge,
  type Shelter,
  type Volunteer,
  type DispatchRequest,
  type NetworkSnapshot,
} from '../../src/features/network/networkEngine';
import {
  saveNetworkSnapshot,
  loadNetworkSnapshot,
  toggleFavoriteShelter,
  loadFavoriteShelters,
} from '../../src/features/network/networkStorage';

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  BG: '#0F172A',
  CARD: '#1E293B',
  BORDER: '#334155',
  TEXT: '#F1F5F9',
  TEXT_DIM: '#94A3B8',
  TEXT_MUTED: '#64748B',
  ACCENT: '#3B82F6',
  SUCCESS: '#22C55E',
  WARNING: '#F59E0B',
  DANGER: '#EF4444',
  PURPLE: '#A855F7',
} as const;

type TabId = 'map' | 'shelters' | 'volunteers' | 'requests';

// ─── SVG Live Map ─────────────────────────────────────────────────────────────

function LiveMap({
  shelters,
  selectedId,
  onSelect,
}: {
  shelters: Shelter[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const W = 340;
  const H = 220;

  // Road grid lines (simulated street grid)
  const roads = [
    { x1: 0, y1: H * 0.35, x2: W, y2: H * 0.35 },
    { x1: 0, y1: H * 0.6, x2: W, y2: H * 0.6 },
    { x1: W * 0.3, y1: 0, x2: W * 0.3, y2: H },
    { x1: W * 0.55, y1: 0, x2: W * 0.55, y2: H },
    { x1: W * 0.75, y1: 0, x2: W * 0.75, y2: H },
  ];

  return (
    <Svg width={W} height={H}>
      <Defs>
        <RadialGradient id="mapBg" cx="50%" cy="50%" r="70%">
          <Stop offset="0%" stopColor="#1E3A5F" stopOpacity="1" />
          <Stop offset="100%" stopColor="#0F172A" stopOpacity="1" />
        </RadialGradient>
      </Defs>

      {/* Background */}
      <Rect x={0} y={0} width={W} height={H} fill="url(#mapBg)" rx={12} />

      {/* Road grid */}
      {roads.map((r, i) => (
        <Line
          key={i}
          x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
          stroke="#1E3A5F"
          strokeWidth={6}
          strokeLinecap="round"
        />
      ))}
      {roads.map((r, i) => (
        <Line
          key={`road-center-${i}`}
          x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
          stroke="#253D5B"
          strokeWidth={1}
          strokeDasharray="4,6"
        />
      ))}

      {/* Town Lake */}
      <Rect x={W * 0.28} y={H * 0.42} width={W * 0.22} height={H * 0.12}
        fill="#1D4ED8" fillOpacity={0.3} rx={8} />
      <SvgText x={W * 0.39} y={H * 0.5} fontSize={7} fill="#60A5FA"
        textAnchor="middle" fillOpacity={0.8}>TOWN LAKE</SvgText>

      {/* Shelter pins */}
      {shelters.map((shelter) => {
        const x = (shelter.mapX / 100) * W;
        const y = (shelter.mapY / 100) * H;
        const cfg = getShelterStatusConfig(shelter.status);
        const isSelected = selectedId === shelter.id;
        const pinR = isSelected ? 10 : 7;

        return (
          <G key={shelter.id} onPress={() => onSelect(shelter.id)}>
            {/* Pulse ring for selected */}
            {isSelected && (
              <Circle cx={x} cy={y} r={16} fill={cfg.color} fillOpacity={0.15} />
            )}
            {/* Shadow */}
            <Circle cx={x + 1} cy={y + 1} r={pinR + 1} fill="#000" fillOpacity={0.4} />
            {/* Pin body */}
            <Circle cx={x} cy={y} r={pinR} fill={cfg.color} fillOpacity={isSelected ? 1 : 0.85} />
            {/* Inner dot */}
            <Circle cx={x} cy={y} r={pinR * 0.4} fill="#fff" fillOpacity={0.9} />
            {/* Label */}
            <SvgText
              x={x}
              y={y + pinR + 9}
              fontSize={6.5}
              fill={C.TEXT}
              textAnchor="middle"
              fillOpacity={0.9}
            >
              {shelter.name.split(' ').slice(0, 2).join(' ')}
            </SvgText>
          </G>
        );
      })}

      {/* You pin */}
      <Circle cx={W * 0.48} cy={H * 0.44} r={6} fill={C.ACCENT} />
      <Circle cx={W * 0.48} cy={H * 0.44} r={3} fill="#fff" />
      <Circle cx={W * 0.48} cy={H * 0.44} r={12} fill={C.ACCENT} fillOpacity={0.15} />
      <SvgText x={W * 0.48} y={H * 0.44 + 18} fontSize={7} fill={C.ACCENT} textAnchor="middle">YOU</SvgText>

      {/* Legend */}
      {(['open', 'limited', 'full'] as const).map((status, i) => {
        const cfg = getShelterStatusConfig(status);
        return (
          <G key={status}>
            <Circle cx={8 + i * 54} cy={H - 8} r={4} fill={cfg.color} />
            <SvgText x={15 + i * 54} y={H - 4} fontSize={7} fill={C.TEXT_DIM}>{cfg.label}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── System Status Bar ────────────────────────────────────────────────────────

function SystemStatusBar({ snapshot }: { snapshot: NetworkSnapshot }) {
  const totalCapacity = snapshot.totalCapacity;
  const totalOccupancy = snapshot.totalOccupancy;
  const pct = Math.round((totalOccupancy / totalCapacity) * 100);
  const availableCount = snapshot.volunteers.filter((v) => v.status === 'available').length;
  const criticalCount = snapshot.activeRequests.filter(
    (r) => r.urgency === 'critical' && !r.resolved,
  ).length;

  const statusColors: Record<NetworkSnapshot['systemStatus'], string> = {
    normal: C.SUCCESS,
    elevated: C.WARNING,
    critical: C.DANGER,
  };
  const statusColor = statusColors[snapshot.systemStatus];

  return (
    <View style={[styles.statusBar, { borderColor: statusColor + '44' }]}>
      <View style={styles.statusBarLeft}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusLabel, { color: statusColor }]}>
          {snapshot.systemStatus.charAt(0).toUpperCase() + snapshot.systemStatus.slice(1)}
        </Text>
      </View>
      <View style={styles.statusBarStats}>
        <View style={styles.statusStat}>
          <Text style={styles.statusStatVal}>{pct}%</Text>
          <Text style={styles.statusStatLabel}>capacity</Text>
        </View>
        <View style={styles.statusDivider} />
        <View style={styles.statusStat}>
          <Text style={[styles.statusStatVal, { color: C.SUCCESS }]}>{availableCount}</Text>
          <Text style={styles.statusStatLabel}>volunteers</Text>
        </View>
        {criticalCount > 0 && (
          <>
            <View style={styles.statusDivider} />
            <View style={styles.statusStat}>
              <Text style={[styles.statusStatVal, { color: C.DANGER }]}>{criticalCount}</Text>
              <Text style={styles.statusStatLabel}>critical</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Shelter Card ─────────────────────────────────────────────────────────────

function ShelterCard({
  shelter,
  isFavorited,
  onFavorite,
}: {
  shelter: Shelter;
  isFavorited: boolean;
  onFavorite: () => void;
}) {
  const cfg = getShelterStatusConfig(shelter.status);
  const pct = getOccupancyPercent(shelter);
  const barColor = pct > 90 ? C.DANGER : pct > 70 ? C.WARNING : C.SUCCESS;

  const handleCall = () => {
    Linking.openURL(`tel:${shelter.phone.replace(/\D/g, '')}`);
  };

  return (
    <View style={[styles.shelterCard, { borderLeftColor: cfg.color }]}>
      <View style={styles.shelterCardHeader}>
        <View style={styles.shelterCardLeft}>
          <Text style={styles.shelterName}>{shelter.name}</Text>
          <Text style={styles.shelterAddress} numberOfLines={1}>{shelter.address}</Text>
        </View>
        <View style={styles.shelterCardRight}>
          <TouchableOpacity onPress={onFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 18, color: isFavorited ? C.WARNING : C.TEXT_MUTED }}>
              {isFavorited ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
          <View style={[styles.shelterStatusBadge, { backgroundColor: cfg.background }]}>
            <Text style={[styles.shelterStatusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
      </View>

      {/* Occupancy bar */}
      <View style={styles.occupancyRow}>
        <View style={styles.occupancyBarBg}>
          <View style={[styles.occupancyBarFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
        </View>
        <Text style={styles.occupancyText}>
          {shelter.currentOccupancy}/{shelter.capacity} · {pct}%
        </Text>
      </View>

      {/* Meta row */}
      <View style={styles.shelterMetaRow}>
        <Text style={styles.shelterMeta}>{shelter.distanceMiles} mi</Text>
        <Text style={styles.shelterMetaDot}>·</Text>
        <Text style={styles.shelterMeta}>{shelter.hoursLabel}</Text>
      </View>

      {/* Amenities */}
      <View style={styles.amenityRow}>
        {shelter.amenities.slice(0, 4).map((a) => (
          <View key={a} style={styles.amenityBadge}>
            <Text style={styles.amenityText}>{a}</Text>
          </View>
        ))}
        {shelter.amenities.length > 4 && (
          <Text style={styles.amenityMore}>+{shelter.amenities.length - 4}</Text>
        )}
      </View>

      {/* Call button */}
      {shelter.status !== 'closed' && (
        <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.75}>
          <Text style={styles.callBtnText}>Call {shelter.phone}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Volunteer Row ────────────────────────────────────────────────────────────

function VolunteerRow({ volunteer }: { volunteer: Volunteer }) {
  const dCfg = getDispatchStatusConfig(volunteer.status);

  return (
    <View style={styles.volunteerRow}>
      <View style={[styles.volunteerAvatar, { borderColor: dCfg.color }]}>
        <Text style={styles.volunteerInitials}>{volunteer.initials}</Text>
      </View>
      <View style={styles.volunteerInfo}>
        <View style={styles.volunteerNameRow}>
          <Text style={styles.volunteerName}>{volunteer.name}</Text>
          <View style={[styles.dispatchBadge, { backgroundColor: dCfg.color + '22' }]}>
            <Text style={[styles.dispatchBadgeText, { color: dCfg.color }]}>
              {dCfg.icon} {dCfg.label}
            </Text>
          </View>
        </View>
        <View style={styles.volunteerSkillRow}>
          {volunteer.skills.slice(0, 3).map((s) => (
            <Text key={s} style={styles.skillChip}>{getSkillLabel(s)}</Text>
          ))}
        </View>
        {volunteer.currentTask && (
          <Text style={styles.volunteerTask} numberOfLines={1}>{volunteer.currentTask}</Text>
        )}
        <View style={styles.volunteerMetaRow}>
          <Text style={styles.volunteerMeta}>{volunteer.distanceMiles} mi away</Text>
          <Text style={styles.volunteerMetaDot}>·</Text>
          <Text style={styles.volunteerMeta}>{volunteer.checksCompleted} checks</Text>
          <Text style={styles.volunteerMetaDot}>·</Text>
          <Text style={styles.volunteerMeta}>{formatMinutesAgo(volunteer.lastUpdate)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Request Row ──────────────────────────────────────────────────────────────

function RequestRow({
  request,
  volunteers,
}: {
  request: DispatchRequest;
  volunteers: Volunteer[];
}) {
  const uCfg = getUrgencyConfig(request.urgency);
  const assigned = volunteers.find((v) => v.id === request.assignedVolunteerId);

  return (
    <View style={[styles.requestRow, { borderLeftColor: uCfg.color }]}>
      <View style={styles.requestHeader}>
        <View style={[styles.urgencyBadge, { backgroundColor: uCfg.background }]}>
          <Text style={[styles.urgencyText, { color: uCfg.color }]}>
            {uCfg.label.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.requestSkill}>{getSkillLabel(request.skillNeeded)}</Text>
        <Text style={styles.requestAge}>{formatRequestAge(request.requestedAt)}</Text>
      </View>
      <Text style={styles.requestDescription}>{request.description}</Text>
      <Text style={styles.requestLocation}>📍 {request.location}</Text>
      {assigned ? (
        <Text style={[styles.requestAssigned, { color: C.SUCCESS }]}>
          ✓ Assigned to {assigned.name}
        </Text>
      ) : (
        <Text style={[styles.requestAssigned, { color: C.DANGER }]}>
          ⚠ Unassigned — needs volunteer
        </Text>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EmergencyNetworkHub() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<NetworkSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('map');
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<string[]>([]);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = await loadNetworkSnapshot();
      if (cached) {
        setSnapshot(cached);
        setLoading(false);
        return;
      }
    }
    const fresh = computeNetworkSnapshot();
    await saveNetworkSnapshot(fresh);
    setSnapshot(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(false);
    loadFavoriteShelters().then(setFavoritedIds);
  }, [loadData]);

  const handleFavorite = async (shelterId: string) => {
    await toggleFavoriteShelter(shelterId);
    const updated = await loadFavoriteShelters();
    setFavoritedIds(updated);
  };

  const TABS: { id: TabId; label: string; badge?: number }[] = [
    { id: 'map', label: 'Map' },
    { id: 'shelters', label: 'Shelters', badge: snapshot?.shelters.filter((s) => s.status === 'open').length },
    { id: 'volunteers', label: 'Volunteers', badge: snapshot?.volunteers.filter((v) => v.status === 'available').length },
    { id: 'requests', label: 'Requests', badge: snapshot?.activeRequests.filter((r) => r.urgency === 'critical').length },
  ];

  // Selected shelter detail
  const selectedShelter = snapshot?.shelters.find((s) => s.id === selectedShelterId);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Emergency Network</Text>
          <Text style={styles.headerSub}>East Valley · Live</Text>
        </View>
        <TouchableOpacity onPress={() => loadData(true)} style={styles.refreshBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.refreshIcon}>⟳</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.ACCENT} />
          <Text style={styles.loadingText}>Loading network status…</Text>
        </View>
      ) : snapshot ? (
        <>
          {/* System status */}
          <View style={styles.statusBarWrapper}>
            <SystemStatusBar snapshot={snapshot} />
          </View>

          {/* Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContainer}>
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.tab, tab === t.id && styles.tabActive]}
                onPress={() => setTab(t.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>
                  {t.label}
                </Text>
                {t.badge !== undefined && t.badge > 0 && (
                  <View style={[styles.tabBadge, tab === t.id && styles.tabBadgeActive]}>
                    <Text style={styles.tabBadgeText}>{t.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* ── MAP TAB ── */}
            {tab === 'map' && (
              <View style={styles.mapSection}>
                <View style={styles.mapCard}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <LiveMap
                      shelters={snapshot.shelters}
                      selectedId={selectedShelterId}
                      onSelect={setSelectedShelterId}
                    />
                  </ScrollView>
                </View>
                <Text style={styles.mapHint}>Tap a pin to see shelter details</Text>

                {/* Selected shelter detail */}
                {selectedShelter ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Selected Shelter</Text>
                    <ShelterCard
                      shelter={selectedShelter}
                      isFavorited={favoritedIds.includes(selectedShelter.id)}
                      onFavorite={() => handleFavorite(selectedShelter.id)}
                    />
                  </View>
                ) : (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Nearest Shelters</Text>
                    {snapshot.shelters.slice(0, 2).map((s) => (
                      <ShelterCard
                        key={s.id}
                        shelter={s}
                        isFavorited={favoritedIds.includes(s.id)}
                        onFavorite={() => handleFavorite(s.id)}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ── SHELTERS TAB ── */}
            {tab === 'shelters' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>All Shelters · Nearest First</Text>
                {snapshot.shelters.map((s) => (
                  <ShelterCard
                    key={s.id}
                    shelter={s}
                    isFavorited={favoritedIds.includes(s.id)}
                    onFavorite={() => handleFavorite(s.id)}
                  />
                ))}
              </View>
            )}

            {/* ── VOLUNTEERS TAB ── */}
            {tab === 'volunteers' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Active Volunteers ·{' '}
                  <Text style={{ color: C.SUCCESS }}>
                    {snapshot.volunteers.filter((v) => v.status === 'available').length} available
                  </Text>
                </Text>
                <View style={styles.card}>
                  {snapshot.volunteers.map((v, i) => (
                    <View key={v.id}>
                      <VolunteerRow volunteer={v} />
                      {i < snapshot.volunteers.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── REQUESTS TAB ── */}
            {tab === 'requests' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Active Requests ·{' '}
                  <Text style={{ color: C.DANGER }}>
                    {snapshot.activeRequests.filter((r) => r.urgency === 'critical').length} critical
                  </Text>
                </Text>
                {snapshot.activeRequests.map((r) => (
                  <RequestRow key={r.id} request={r} volunteers={snapshot.volunteers} />
                ))}
              </View>
            )}

            <View style={styles.bottomPad} />
          </ScrollView>
        </>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.BORDER,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: C.TEXT },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: C.TEXT, letterSpacing: 0.3 },
  headerSub: { fontSize: 11, color: C.TEXT_MUTED, marginTop: 1 },
  refreshBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  refreshIcon: { fontSize: 22, color: C.ACCENT },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: C.TEXT_DIM, fontSize: 15 },

  // Status bar
  statusBarWrapper: { paddingHorizontal: 16, paddingVertical: 10 },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.CARD,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  statusBarStats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusStat: { alignItems: 'center' },
  statusStatVal: { fontSize: 16, fontWeight: '700', color: C.TEXT, fontVariant: ['tabular-nums'] },
  statusStatLabel: { fontSize: 9, color: C.TEXT_MUTED, letterSpacing: 0.5 },
  statusDivider: { width: 1, height: 24, backgroundColor: C.BORDER },

  // Tabs
  tabScroll: { flexGrow: 0 },
  tabContainer: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.CARD,
    borderWidth: 1,
    borderColor: C.BORDER,
    alignSelf: 'flex-start',
    height: 36,
  },
  tabActive: { backgroundColor: C.ACCENT + '22', borderColor: C.ACCENT },
  tabText: { fontSize: 13, fontWeight: '600', color: C.TEXT_DIM },
  tabTextActive: { color: C.ACCENT },
  tabBadge: {
    backgroundColor: C.BORDER,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeActive: { backgroundColor: C.ACCENT },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: C.TEXT },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },

  // Map
  mapSection: { gap: 12 },
  mapCard: {
    backgroundColor: C.CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.BORDER,
    overflow: 'hidden',
  },
  mapHint: { fontSize: 11, color: C.TEXT_MUTED, textAlign: 'center' },

  // Sections
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.TEXT, letterSpacing: 0.1 },
  card: {
    backgroundColor: C.CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.BORDER,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: C.BORDER, marginLeft: 14 },

  // Shelter Card
  shelterCard: {
    backgroundColor: C.CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.BORDER,
    borderLeftWidth: 3,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  shelterCardHeader: { flexDirection: 'row', gap: 8 },
  shelterCardLeft: { flex: 1, gap: 2 },
  shelterName: { fontSize: 14, fontWeight: '700', color: C.TEXT },
  shelterAddress: { fontSize: 11, color: C.TEXT_MUTED },
  shelterCardRight: { alignItems: 'flex-end', gap: 6 },
  shelterStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  shelterStatusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  occupancyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  occupancyBarBg: { flex: 1, height: 6, backgroundColor: C.BORDER, borderRadius: 3, overflow: 'hidden' },
  occupancyBarFill: { height: 6, borderRadius: 3 },
  occupancyText: { fontSize: 11, color: C.TEXT_DIM, fontVariant: ['tabular-nums'], width: 80, textAlign: 'right' },
  shelterMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shelterMeta: { fontSize: 12, color: C.TEXT_DIM },
  shelterMetaDot: { color: C.TEXT_MUTED },
  amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  amenityBadge: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  amenityText: { fontSize: 10, color: C.TEXT_DIM, fontWeight: '500' },
  amenityMore: { fontSize: 10, color: C.TEXT_MUTED, alignSelf: 'center' },
  callBtn: {
    backgroundColor: C.ACCENT + '22',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.ACCENT + '44',
  },
  callBtnText: { fontSize: 13, fontWeight: '700', color: C.ACCENT },

  // Volunteer Row
  volunteerRow: { flexDirection: 'row', padding: 14, gap: 12, alignItems: 'flex-start' },
  volunteerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  volunteerInitials: { fontSize: 14, fontWeight: '700', color: C.TEXT },
  volunteerInfo: { flex: 1, gap: 4 },
  volunteerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  volunteerName: { fontSize: 14, fontWeight: '600', color: C.TEXT },
  dispatchBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  dispatchBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  volunteerSkillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  skillChip: { fontSize: 10, color: C.TEXT_MUTED, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  volunteerTask: { fontSize: 12, color: C.TEXT_DIM, fontStyle: 'italic' },
  volunteerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  volunteerMeta: { fontSize: 11, color: C.TEXT_MUTED },
  volunteerMetaDot: { color: C.TEXT_MUTED, fontSize: 11 },

  // Request Row
  requestRow: {
    backgroundColor: C.CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.BORDER,
    borderLeftWidth: 3,
    padding: 14,
    gap: 8,
    marginBottom: 8,
  },
  requestHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  urgencyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  urgencyText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  requestSkill: { fontSize: 12, fontWeight: '600', color: C.TEXT_DIM },
  requestAge: { fontSize: 11, color: C.TEXT_MUTED, marginLeft: 'auto' },
  requestDescription: { fontSize: 13, color: C.TEXT, lineHeight: 18 },
  requestLocation: { fontSize: 12, color: C.TEXT_DIM },
  requestAssigned: { fontSize: 12, fontWeight: '600' },

  bottomPad: { height: 40 },
});
