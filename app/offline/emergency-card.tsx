// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/offline/emergency-card.tsx
// HeatGuard · Emergency info card
// Everything here works with no signal:
//  - 911 and 2-1-1
//  - Your emergency contacts (from this phone)
//  - Nearest cooling centers from the last saved Heat Relief Network list
//    (real data; only shown when we know roughly where you are)
//  - What to do now, and how to tell heat exhaustion from heat stroke
// Skins: High Sun (light) / Night Shift (dark).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown, ChevronUp, Phone, MapPin } from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { HEAT_SYMPTOMS_DATA, SOS_INSTRUCTIONS_DATA } from '../../src/features/offline/offlineSync';
import { getContacts } from '../../src/features/emergency/storage/contactStorage';
import type { EmergencyContact } from '../../src/features/emergency/types/contact.types';
import {
  getCachedCoolSpots, distanceMiles, todayHoursLabel, SPOT_LABEL, type CoolSpot,
} from '../../src/features/coolspots/coolSpotsService';
import { getWeatherSnapshot } from '../../src/services/weather/weatherStore';
import { useNetworkStatus } from '../../src/utils/networkStatus';

const SKIN = {
  light: {
    bg: '#F4F4F0', card: '#FFFFFF', border: '#0A0A0A', divider: '#E2E2DC',
    text: '#0A0A0A', muted: '#3F3F3A', accent: '#0B4FD6', pressed: '#ECECE6',
    danger: '#B91C1C', onDanger: '#FFFFFF', warn: '#8A5A00', warnBg: '#FFF4CC',
    callBg: '#0A0A0A', onCall: '#FFFFFF',
  },
  dark: {
    bg: '#0B1220', card: '#131C2E', border: '#24314F', divider: '#24314F',
    text: '#F1F5F9', muted: '#A3B1C9', accent: '#38BDF8', pressed: '#1A2540',
    danger: '#DC2626', onDanger: '#FFFFFF', warn: '#FBBF24', warnBg: '#2A2410',
    callBg: '#1A2540', onCall: '#F1F5F9',
  },
};
type Skin = typeof SKIN.light;

const MAX_SPOT_MILES = 25;

function tel(n: string) {
  Linking.openURL(`tel:${n.replace(/[^\d+]/g, '')}`).catch(() => {});
}

function SymptomCard({ s, c, borderWidth }: { s: typeof HEAT_SYMPTOMS_DATA[number]; c: Skin; borderWidth: number }) {
  const [open, setOpen] = useState(s.callEmergency);
  const tone = s.callEmergency ? c.danger : s.severity === 'high' ? c.warn : c.text;
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
      <Pressable
        onPress={() => setOpen(o => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.symHead}
      >
        <Text style={[styles.symName, { color: tone }]}>{s.name}</Text>
        {s.callEmergency && (
          <View style={[styles.tag, { backgroundColor: c.danger }]}>
            <Text style={[styles.tagText, { color: c.onDanger }]}>Call 911</Text>
          </View>
        )}
        <View style={styles.flex1} />
        {open ? <ChevronUp size={22} color={c.muted} /> : <ChevronDown size={22} color={c.muted} />}
      </Pressable>
      {open && (
        <View style={styles.symBody}>
          <Text style={[styles.smallLabel, { color: c.muted }]}>Signs</Text>
          {s.symptoms.map(x => (
            <Text key={x} style={[styles.bullet, { color: c.text }]}>•  {x}</Text>
          ))}
          <Text style={[styles.smallLabel, { color: c.muted, marginTop: 8 }]}>What to do</Text>
          <Text style={[styles.body, { color: c.text, fontWeight: s.callEmergency ? '800' : '600' }]}>{s.action}</Text>
        </View>
      )}
    </View>
  );
}

export default function EmergencyInfoCard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const c: Skin = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;
  const network = useNetworkStatus();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [spots, setSpots] = useState<{ spot: CoolSpot; miles: number }[]>([]);
  const [spotsSavedAt, setSpotsSavedAt] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    setContacts(getContacts());
    (async () => {
      const snap = getWeatherSnapshot();
      const saved = await getCachedCoolSpots();
      if (!snap || snap.isDefaultLocation || !saved) { setSpots([]); return; }
      const near = saved.spots
        .filter(s => s.type !== 'hydration' && !s.seasonEnded)
        .map(spot => ({ spot, miles: distanceMiles(snap.lat, snap.lon, spot.latitude, spot.longitude) }))
        .filter(x => x.miles <= MAX_SPOT_MILES)
        .sort((a, b) => a.miles - b.miles)
        .slice(0, 3);
      setSpots(near);
      setSpotsSavedAt(saved.fetchedAt);
    })().catch(() => setSpots([]));
  }, []));

  return (
    <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
        <ChevronLeft size={24} color={c.accent} />
        <Text style={[styles.backText, { color: c.accent }]}>Back</Text>
      </Pressable>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Emergency info</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>
          {network.isOffline ? 'You’re offline. Everything on this page still works.' : 'Works even without signal.'}
        </Text>

        {/* Calls */}
        <View style={styles.callRow}>
          <Pressable
            onPress={() => tel('911')}
            accessibilityRole="button"
            accessibilityLabel="Call 911"
            style={({ pressed }) => [styles.callBtn, { backgroundColor: c.danger, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.callNum, { color: c.onDanger }]}>911</Text>
            <Text style={[styles.callLabel, { color: c.onDanger }]}>Emergency</Text>
          </Pressable>
          <Pressable
            onPress={() => tel('211')}
            accessibilityRole="button"
            accessibilityLabel="Call 2 1 1 for local help"
            style={({ pressed }) => [styles.callBtn, { backgroundColor: c.callBg, opacity: pressed ? 0.85 : 1, borderColor: c.border, borderWidth: isDark ? 1 : 0 }]}
          >
            <Text style={[styles.callNum, { color: c.onCall }]}>2-1-1</Text>
            <Text style={[styles.callLabel, { color: c.onCall }]}>Local help & cooling</Text>
          </Pressable>
        </View>

        {/* Contacts */}
        <Text style={[styles.sectionLabel, { color: c.muted }]}>Your emergency contacts</Text>
        <View style={[styles.card, styles.noPad, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
          {contacts.length === 0 ? (
            <Pressable
              onPress={() => router.push('/emergency/contacts')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.pressed : 'transparent' }]}
            >
              <Text style={[styles.rowTitle, { color: c.accent }]}>Add an emergency contact</Text>
            </Pressable>
          ) : contacts.map((ct, i) => (
            <Pressable
              key={ct.id ?? `${ct.name}-${i}`}
              onPress={() => tel(ct.phoneNumber)}
              accessibilityRole="button"
              accessibilityLabel={`Call ${ct.name}`}
              style={({ pressed }) => [styles.row, {
                backgroundColor: pressed ? c.pressed : 'transparent',
                borderBottomColor: c.divider,
                borderBottomWidth: i === contacts.length - 1 ? 0 : StyleSheet.hairlineWidth,
              }]}
            >
              <View style={styles.flex1}>
                <Text style={[styles.rowTitle, { color: c.text }]}>{ct.name}</Text>
                <Text style={[styles.rowSub, { color: c.muted }]}>{ct.phoneNumber}</Text>
              </View>
              <Phone size={22} color={c.accent} />
            </Pressable>
          ))}
        </View>

        {/* Cooling centers */}
        {spots.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: c.muted }]}>Nearest cooling centers</Text>
            <View style={[styles.card, styles.noPad, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
              {spots.map(({ spot, miles }, i) => (
                <View
                  key={spot.id}
                  style={[styles.row, {
                    borderBottomColor: c.divider,
                    borderBottomWidth: i === spots.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  }]}
                >
                  <MapPin size={22} color={c.text} />
                  <View style={styles.flex1}>
                    <Text style={[styles.rowTitle, { color: c.text }]}>{spot.name}</Text>
                    <Text style={[styles.rowSub, { color: c.muted }]}>
                      {[spot.address, spot.city].filter(Boolean).join(', ')}
                    </Text>
                    <Text style={[styles.rowSub, { color: c.muted }]}>
                      {SPOT_LABEL[spot.type]} · {miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi · {todayHoursLabel(spot)}
                    </Text>
                  </View>
                  {spot.phone ? (
                    <Pressable
                      onPress={() => tel(spot.phone!)}
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${spot.name}`}
                      hitSlop={8}
                      style={styles.iconBtn}
                    >
                      <Phone size={22} color={c.accent} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
            <Text style={[styles.note, { color: c.muted }]}>
              From the Heat Relief Network list saved {spotsSavedAt ? new Date(spotsSavedAt).toLocaleDateString() : 'earlier'}. Hours can change. Call ahead if you can.
            </Text>
          </>
        )}

        {/* Steps */}
        <Text style={[styles.sectionLabel, { color: c.muted }]}>If someone is sick from heat</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
          {SOS_INSTRUCTIONS_DATA.steps.map(s => (
            <View key={s.step} style={styles.step}>
              <View style={[styles.stepNum, { backgroundColor: s.step === 1 ? c.danger : c.callBg }]}>
                <Text style={[styles.stepNumText, { color: s.step === 1 ? c.onDanger : c.onCall }]}>{s.step}</Text>
              </View>
              <Text style={[styles.body, { color: c.text, flex: 1 }]}>{s.action}</Text>
            </View>
          ))}
          <View style={[styles.callout, { backgroundColor: c.warnBg }]}>
            <Text style={[styles.calloutText, { color: c.warn }]}>{SOS_INSTRUCTIONS_DATA.note}</Text>
          </View>
        </View>

        {/* Symptoms */}
        <Text style={[styles.sectionLabel, { color: c.muted }]}>Know the signs</Text>
        {HEAT_SYMPTOMS_DATA.map(s => (
          <SymptomCard key={s.id} s={s} c={c} borderWidth={borderWidth} />
        ))}

        <Text style={[styles.note, { color: c.muted, textAlign: 'center' }]}>
          Based on CDC guidance on heat-related illness. HeatGuard is not a medical device.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 20, gap: 12 },
  flex1: { flex: 1 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 16, marginTop: -6 },

  callRow: { flexDirection: 'row', gap: 10 },
  callBtn: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center', minHeight: 88, justifyContent: 'center' },
  callNum: { fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] },
  callLabel: { fontSize: 14, fontWeight: '700', marginTop: 2 },

  sectionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8 },
  card: { borderRadius: 16, padding: 16, gap: 10, overflow: 'hidden' },
  noPad: { padding: 0, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64 },
  rowTitle: { fontSize: 17, fontWeight: '800' },
  rowSub: { fontSize: 14, lineHeight: 19 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 13, lineHeight: 18 },

  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 15, fontWeight: '800' },
  body: { fontSize: 16, lineHeight: 22 },
  callout: { borderRadius: 12, padding: 12 },
  calloutText: { fontSize: 15, fontWeight: '800', lineHeight: 21 },

  symHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  symName: { fontSize: 19, fontWeight: '800' },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 13, fontWeight: '800' },
  symBody: { gap: 4 },
  smallLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  bullet: { fontSize: 16, lineHeight: 22 },
});
