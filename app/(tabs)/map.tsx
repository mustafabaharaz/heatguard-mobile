// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/(tabs)/map.tsx
// HeatGuard · Cool Spots
// Nearest real heat relief sites (MAG Heat Relief Network), sorted by
// distance, with today's hours, one-tap directions and call. Works offline
// from the last saved list. Skins: High Sun (light) / Night Shift (dark).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, Linking, Platform, RefreshControl, ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Navigation, Phone, Clock, Info, PawPrint, Accessibility, MapPinOff } from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useLocation } from '../../src/lib/hooks/useLocation';
import {
  loadCoolSpots, getCachedCoolSpots, distanceMiles, todayHoursLabel, inHeatReliefSeason, SPOT_LABEL,
  type CoolSpot, type CoolSpotsResult, type SpotType,
} from '../../src/features/coolspots/coolSpotsService';

// ─── Skins ────────────────────────────────────────────────────────────────────

const SKIN = {
  light: {
    bg: '#F4F4F0',
    card: '#FFFFFF',
    border: '#0A0A0A',
    text: '#0A0A0A',
    muted: '#3F3F3A',
    accent: '#0B4FD6',
    onAccent: '#FFFFFF',
    noteBg: '#FFF4CC',
    noteText: '#5C4300',
    chipBg: '#FFFFFF',
    chipActiveBg: '#0A0A0A',
    chipActiveText: '#FFFFFF',
    warn: '#9A3412',
    pressed: '#ECECE6',
    type: { cooling: '#0B4FD6', respite: '#6B21A8', hydration: '#0E7490' },
  },
  dark: {
    bg: '#0B1220',
    card: '#131C2E',
    border: '#24314F',
    text: '#F1F5F9',
    muted: '#A3B1C9',
    accent: '#38BDF8',
    onAccent: '#04121F',
    noteBg: '#1A2540',
    noteText: '#FBBF24',
    chipBg: '#131C2E',
    chipActiveBg: '#38BDF8',
    chipActiveText: '#04121F',
    warn: '#FB923C',
    pressed: '#1A2540',
    type: { cooling: '#38BDF8', respite: '#C4B5FD', hydration: '#5EEAD4' },
  },
};

type Skin = typeof SKIN.light;

const FILTERS: { key: SpotType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'cooling', label: 'Cooling' },
  { key: 'respite', label: 'Rest' },
  { key: 'hydration', label: 'Water' },
];

const MAX_ITEMS = 40;
const FAR_MILES = 50;
const DEFAULT_POINT = { lat: 33.4255, lon: -111.94 }; // Tempe

function openDirections(spot: CoolSpot) {
  const label = encodeURIComponent(spot.name);
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${spot.latitude},${spot.longitude}&q=${label}`,
    android: `geo:0,0?q=${spot.latitude},${spot.longitude}(${label})`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}`,
  });
  Linking.openURL(url).catch(() => {});
}

function callSpot(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits) Linking.openURL(`tel:${digits}`).catch(() => {});
}

function formatUpdated(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function SpotCard({ spot, miles, c, borderWidth }: { spot: CoolSpot; miles: number; c: Skin; borderWidth: number }) {
  const typeColor = c.type[spot.type];
  const hours = todayHoursLabel(spot);
  const place = [spot.address, spot.city].filter(Boolean).join(', ');

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
      <View style={styles.cardTop}>
        <Text style={[styles.typeLabel, { color: typeColor }]}>{SPOT_LABEL[spot.type]}</Text>
        <Text style={[styles.distance, { color: c.text }]}>{miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi</Text>
      </View>

      <Text style={[styles.name, { color: c.text }]}>{spot.name}</Text>
      {place ? <Text style={[styles.address, { color: c.muted }]}>{place}</Text> : null}

      <View style={styles.infoRow}>
        <Clock size={16} color={c.muted} />
        <Text style={[styles.infoText, { color: c.text }]}>{hours}</Text>
      </View>

      {(spot.seasonEnded || spot.closureNote) && (
        <View style={styles.infoRow}>
          <Info size={16} color={c.warn} />
          <Text style={[styles.infoText, { color: c.warn }]}>
            {spot.seasonEnded ? 'Summer season ended. Call ahead.' : spot.closureNote}
          </Text>
        </View>
      )}

      {(spot.petsAllowed || spot.wheelchair) && (
        <View style={styles.badges}>
          {spot.petsAllowed && (
            <View style={[styles.badge, { borderColor: c.border }]}>
              <PawPrint size={14} color={c.text} />
              <Text style={[styles.badgeText, { color: c.text }]}>Pets OK</Text>
            </View>
          )}
          {spot.wheelchair && (
            <View style={[styles.badge, { borderColor: c.border }]}>
              <Accessibility size={14} color={c.text} />
              <Text style={[styles.badgeText, { color: c.text }]}>Wheelchair access</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => openDirections(spot)}
          accessibilityRole="button"
          accessibilityLabel={`Directions to ${spot.name}`}
          style={({ pressed }) => [styles.primaryBtn, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Navigation size={18} color={c.onAccent} />
          <Text style={[styles.primaryBtnText, { color: c.onAccent }]}>Directions</Text>
        </Pressable>
        {spot.phone && (
          <Pressable
            onPress={() => callSpot(spot.phone!)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${spot.name}`}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { borderColor: c.border, borderWidth, backgroundColor: pressed ? c.pressed : 'transparent' },
            ]}
          >
            <Phone size={18} color={c.text} />
            <Text style={[styles.secondaryBtnText, { color: c.text }]}>Call</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CoolSpotsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const c: Skin = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  const { location, error: locationError, loading: locationLoading } = useLocation();
  const [data, setData] = useState<CoolSpotsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<SpotType | 'all'>('all');

  const load = useCallback(async () => {
    const result = await loadCoolSpots();
    if (result) setData(result);
  }, []);

  useEffect(() => {
    (async () => {
      const cached = await getCachedCoolSpots();
      if (cached) {
        setData(cached);
        setLoading(false);
      }
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const origin = location ?? DEFAULT_POINT;
  const usingDefault = !location || !!locationError;

  const list = useMemo(() => {
    if (!data) return [];
    return data.spots
      .filter(s => filter === 'all' || s.type === filter)
      .map(s => ({ spot: s, miles: distanceMiles(origin.lat, origin.lon, s.latitude, s.longitude) }))
      .sort((a, b) => a.miles - b.miles)
      .slice(0, MAX_ITEMS);
  }, [data, filter, origin.lat, origin.lon]);

  const nearestMiles = list.length ? list[0].miles : null;
  const offSeason = !inHeatReliefSeason();

  const header = (
    <View style={styles.headerWrap}>
      <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Cool Spots</Text>
      <Text style={[styles.subtitle, { color: c.muted }]}>Places to cool down near you</Text>

      {offSeason && (
        <View style={[styles.note, { backgroundColor: c.noteBg, borderColor: c.border, borderWidth }]}>
          <Info size={18} color={c.noteText} />
          <Text style={[styles.noteText, { color: c.text }]}>
            The Heat Relief Network runs May through September. Some sites may be closed now, so call ahead.
          </Text>
        </View>
      )}

      {usingDefault && !locationLoading && (
        <View style={[styles.note, { backgroundColor: c.noteBg, borderColor: c.border, borderWidth }]}>
          <MapPinOff size={18} color={c.noteText} />
          <Text style={[styles.noteText, { color: c.text }]}>
            Distances are from Tempe. Allow location access in Settings to see the spots nearest you.
          </Text>
        </View>
      )}

      {nearestMiles !== null && nearestMiles > FAR_MILES && (
        <View style={[styles.note, { backgroundColor: c.noteBg, borderColor: c.border, borderWidth }]}>
          <Info size={18} color={c.noteText} />
          <Text style={[styles.noteText, { color: c.text }]}>
            Cool Spots covers Maricopa County, Arizona for now. Elsewhere, public libraries, malls and community centers are good places to cool off.
          </Text>
        </View>
      )}

      <View style={styles.filters}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? c.chipActiveBg : c.chipBg,
                  borderColor: active ? c.chipActiveBg : c.border,
                  borderWidth,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? c.chipActiveText : c.text }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const footer = data ? (
    <Text style={[styles.footer, { color: c.muted }]}>
      Source: Maricopa Association of Governments, Heat Relief Network.{'\n'}
      Updated {formatUpdated(data.fetchedAt)}{data.fromCache ? ' (saved copy)' : ''}. Pull down to refresh.
    </Text>
  ) : null;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {loading && !data ? (
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={[styles.loadingText, { color: c.muted }]}>Finding cool spots near you…</Text>
        </View>
      ) : !data ? (
        <View style={[styles.centered, { paddingTop: insets.top, paddingHorizontal: 24 }]}>
          <Text style={[styles.emptyTitle, { color: c.text }]}>Can't load cool spots</Text>
          <Text style={[styles.emptyText, { color: c.muted }]}>
            Connect to the internet once and HeatGuard will save the list for offline use. If you feel unwell, hold the SOS button.
          </Text>
          <Pressable
            onPress={onRefresh}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primaryBtn, styles.retry, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.primaryBtnText, { color: c.onAccent }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={item => item.spot.id}
          renderItem={({ item }) => <SpotCard spot={item.spot} miles={item.miles} c={c} borderWidth={borderWidth} />}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: c.muted, textAlign: 'left' }]}>No sites of this type right now.</Text>
          }
          contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 16 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.muted} />}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  retry: { marginTop: 20, alignSelf: 'stretch', flex: 0 },

  listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  headerWrap: { gap: 10, marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 16, marginTop: -6 },

  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 14, padding: 12 },
  noteText: { flex: 1, fontSize: 15, lineHeight: 21 },

  filters: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '700' },

  card: { borderRadius: 16, padding: 16, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  distance: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  name: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  address: { fontSize: 15, lineHeight: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  infoText: { fontSize: 15, flex: 1, lineHeight: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  primaryBtn: { flex: 1, flexDirection: 'row', gap: 8, minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 16, fontWeight: '800' },
  secondaryBtn: { flexDirection: 'row', gap: 8, minHeight: 50, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 16, fontWeight: '700' },

  footer: { fontSize: 13, lineHeight: 19, marginTop: 8 },
});
