// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/(tabs)/profile.tsx
// HeatGuard · Profile
//  - Heat profile (health, age, alert level)
//  - Who I'm protecting (dependents)
//  - Home & lifestyle answers, Home surroundings (AC)
//  - Daily check-in (times, safety check, heat buddy)
//  - Emergency contacts & heat buddies
//  - Notifications & settings, app info
// Skins: High Sun (light) / Night Shift (dark).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HeartPulse, Users, Home, Phone, Settings, ChevronRight, UserRound, AirVent, BellRing,
} from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { getContacts } from '../../src/features/emergency/storage/contactStorage';
import {
  getHeatProfile, isHomeVulnerable, needsSafetyCheck, type HeatProfile,
} from '../../src/features/profile/storage/profileStorage';
import { getDependents, joinNames, type Dependent } from '../../src/features/profile/storage/dependentsStorage';
import { getDailyCheckIn, formatCheckInTimes } from '../../src/features/checkin/dailyCheckIn';
import type { EmergencyContact } from '../../src/features/emergency/types/contact.types';

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
    badgeBg: '#FFF4CC',
    badgeText: '#5C4300',
    pressed: '#ECECE6',
    avatarBg: '#0A0A0A',
    avatarIcon: '#FFFFFF',
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
    badgeBg: '#2A2410',
    badgeText: '#FBBF24',
    pressed: '#1A2540',
    avatarBg: '#1A2540',
    avatarIcon: '#38BDF8',
  },
};

type Skin = typeof SKIN.light;

function householdSummary(p: HeatProfile): string {
  if (!p.householdAnswered) return 'Not answered yet';
  const parts: string[] = [];
  if (p.drivesWithKids || p.drivesWithPets) parts.push('Car riders');
  if (p.worksOutdoors) parts.push('Outdoors');
  if (p.livesAlone) parts.push('Lives alone');
  if (p.isElderly) parts.push('65+');
  return parts.length ? parts.join(' · ') : 'Answered';
}

function homeSummary(p: HeatProfile): string {
  if (!p.homeAnswered) return 'Your AC at home, cooling tips, bill help';
  if (p.noAC) return 'No AC · cooling tips & bill help';
  const parts = [p.acUnreliable ? 'AC not always reliable' : 'AC works'];
  if (p.acOffToSave) parts.push('sometimes off to save');
  return parts.join(' · ');
}

function checkInSummary(): string {
  const ci = getDailyCheckIn();
  return ci.enabled ? `${formatCheckInTimes(ci)} · "Are you OK?"` : 'Off · up to 3 "Are you OK?" a day';
}

interface RowProps {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onPress: () => void;
  badge?: string;
  last?: boolean;
  c: Skin;
}

function Row({ icon, title, sub, onPress, badge, last, c }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}${badge ? `. ${badge}` : ''}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? c.pressed : 'transparent',
          borderBottomColor: c.divider,
          borderBottomWidth: last ? 0 : 1,
        },
      ]}
    >
      {icon}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: c.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={2}>{sub}</Text>
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: c.badgeBg }]}>
          <Text style={[styles.badgeText, { color: c.badgeText }]}>{badge}</Text>
        </View>
      ) : null}
      <ChevronRight size={20} color={c.muted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, formatTemp } = useSettings();
  const c: Skin = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  const [profile, setProfile] = useState<HeatProfile>(getHeatProfile());
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  // Tabs stay mounted: refresh every time Profile comes into view
  useFocusEffect(useCallback(() => {
    setProfile(getHeatProfile());
    setDependents(getDependents());
    try { setContacts(getContacts()); } catch { setContacts([]); }
  }, []));

  const contactCount = contacts.length;
  const buddyCount = contacts.filter(ct => ct.isBuddy).length;
  const checkInOn = getDailyCheckIn().enabled;
  const flagged = needsSafetyCheck(profile);

  const name = profile.name.trim() || 'Your profile';
  const heatSub = profile.profileComplete
    ? `Age ${profile.age} · alerts at ${formatTemp(profile.alertThreshold)}`
    : 'Add your age and health for personal risk';
  const depSub = dependents.length
    ? joinNames(dependents.map(d => d.name))
    : 'Add kids, pets or family you look after';

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: c.avatarBg }]}>
            <UserRound size={30} color={c.avatarIcon} />
          </View>
          <View style={styles.flex1}>
            <Text style={[styles.name, { color: c.text }]} accessibilityRole="header" numberOfLines={1}>{name}</Text>
            <Text style={[styles.headerSub, { color: c.muted }]}>Everything here stays on this phone.</Text>
          </View>
        </View>

        {/* ── You ──────────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: c.muted }]}>You</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
          <Row
            c={c}
            icon={<HeartPulse size={24} color={c.text} />}
            title="Heat profile"
            sub={heatSub}
            badge={profile.profileComplete ? undefined : 'Set up'}
            onPress={() => router.push('/profile/heat-profile')}
          />
          <Row
            c={c}
            icon={<Home size={24} color={c.text} />}
            title="Home & lifestyle"
            sub={householdSummary(profile)}
            badge={profile.householdAnswered ? undefined : 'Answer'}
            onPress={() => router.push('/profile/household')}
          />
          <Row
            c={c}
            icon={<AirVent size={24} color={c.text} />}
            title="Home surroundings"
            sub={homeSummary(profile)}
            badge={!profile.homeAnswered && isHomeVulnerable(profile) ? 'Answer' : undefined}
            onPress={() => router.push('/profile/home')}
            last
          />
        </View>

        {/* ── Safety ───────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: c.muted }]}>Safety</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
          <Row
            c={c}
            icon={<BellRing size={24} color={c.text} />}
            title="Daily check-in"
            sub={checkInSummary()}
            badge={!checkInOn && flagged ? 'Recommended' : undefined}
            onPress={() => router.push('/checkin/settings')}
            last
          />
        </View>

        {/* ── People ───────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: c.muted }]}>People</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
          <Row
            c={c}
            icon={<Users size={24} color={c.text} />}
            title="Who I'm protecting"
            sub={depSub}
            onPress={() => router.push('/profile/dependents')}
          />
          <Row
            c={c}
            icon={<Phone size={24} color={c.text} />}
            title="Emergency contacts"
            sub={contactCount
              ? `${contactCount} ${contactCount === 1 ? 'contact' : 'contacts'} · ${buddyCount ? `${buddyCount} heat ${buddyCount === 1 ? 'buddy' : 'buddies'}` : 'no heat buddy yet'}`
              : 'Needed so SOS can reach someone'}
            badge={contactCount ? undefined : 'Add'}
            onPress={() => router.push('/emergency/contacts')}
            last
          />
        </View>

        {/* ── App ──────────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: c.muted }]}>App</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
          <Row
            c={c}
            icon={<Settings size={24} color={c.text} />}
            title="Notifications & settings"
            sub="Alerts, units, appearance"
            onPress={() => router.push('/settings')}
            last
          />
        </View>

        <Text style={[styles.about, { color: c.muted }]}>
          HeatGuard 1.0 (beta){'\n'}Heat safety for you and the people you look after.{'\n'}Not a medical device. In an emergency, call 911.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  flex1: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: 14, marginTop: 2 },

  sectionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8 },
  card: { borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 68 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17, fontWeight: '800' },
  rowSub: { fontSize: 14, lineHeight: 19 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: '800' },

  about: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 20 },
});
