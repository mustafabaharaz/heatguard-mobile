// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/(tabs)/index.tsx
// HeatGuard · Home
//  - Compact color-coded temperature chip (taps through to the forecast)
//  - Two-line heat summary: what to do + your personal risk
//  - "Needs your attention" card (one item at a time, most urgent first)
//  - Quick tiles: Hydration (+1 cup) and Vehicle check (only if kids/pets ride
//    along; otherwise the offline Emergency card)
//  - A short list of tools; last-updated time at the bottom
// Skins: High Sun (light) / Night Shift (dark). SOS lives in the tab bar.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Droplet, Car, Plus, Bell, ChevronRight, Settings, LifeBuoy,
  Newspaper, Snowflake, Activity, UserRound, MapPin,
} from 'lucide-react-native';
import haptics from '../../src/utils/haptics';
import { useSettings } from '../../src/context/SettingsContext';
import { useWeather } from '../../src/services/weather/useWeather';
import {
  refreshWeather, fToC, getTodayHighF, snapshotAgeMinutes, getUpcomingDateKeys,
} from '../../src/services/weather/weatherStore';
import {
  scheduleHeatAlert, scheduleHotDayVehicleReminders, cancelVehicleReminders, registerForPushNotifications,
} from '../../src/services/notifications/push';
import { getNotificationPrefs } from '../../src/features/settings/appPrefs';
import {
  getHeatProfile, getRiskMultiplier, hasVehicleDependents, hasCoolingRisk, type HeatProfile,
} from '../../src/features/profile/storage/profileStorage';
import { PassiveTracker } from '../../src/features/exposure/passiveTracker';
import {
  calculateHydrationTarget, computeHydrationSummary, mlToOz, type HydrationSummary,
} from '../../src/features/hydration/hydrationEngine';
import { addHydrationLog, getHydrationLogs } from '../../src/features/hydration/hydrationStorage';
import { getCachedBrief, generateDailyBrief, cacheBrief } from '../../src/features/brief/briefEngine';
import { getAcclimationScore } from '../../src/features/acclimation/acclimationEngine';
import { getAcclimationState } from '../../src/features/acclimation/acclimationStorage';
import {
  getActiveVehicleSession, dismissVehicleSession, type VehicleSession,
} from '../../src/features/vehicle/vehicleAlertEngine';
import { getContacts } from '../../src/features/emergency/storage/contactStorage';
import { carRiderNames, joinNames } from '../../src/features/profile/storage/dependentsStorage';
import {
  getCheckInStatus, confirmToday, planDailyCheckIns, isSuggestionDismissed, dismissSuggestion, formatCheckInTime,
} from '../../src/features/checkin/dailyCheckIn';
import { textContacts } from '../../src/features/emergency/emergencyMessaging';
import {
  getActiveTrip, endTrip, isTripOverdue, formatClock, type Trip,
} from '../../src/features/plan/tripCheckIn';

// ─── Skins ────────────────────────────────────────────────────────────────────

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
    vehicle: '#C2410C',
    attentionBg: '#FFF4CC',
    attentionBorder: '#0A0A0A',
    attentionLabel: '#5C4300',
    urgentBg: '#FDE2E2',
    urgentLabel: '#8A1414',
    btnDark: '#0A0A0A',
    onBtnDark: '#FFFFFF',
    track: '#E2E2DC',
    pressed: '#ECECE6',
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
    vehicle: '#FB923C',
    attentionBg: '#1A2540',
    attentionBorder: '#2D3B5E',
    attentionLabel: '#FBBF24',
    urgentBg: '#2A1520',
    urgentLabel: '#FCA5A5',
    btnDark: '#38BDF8',
    onBtnDark: '#04121F',
    track: '#24314F',
    pressed: '#1A2540',
  },
};

type Skin = typeof SKIN.light;

// ─── Heat levels (from feels-like °C) ─────────────────────────────────────────

type Level = 'safe' | 'caution' | 'high' | 'extreme' | 'crisis';

function levelFromFeelsC(c: number): Level {
  if (c >= 46) return 'crisis';
  if (c >= 40) return 'extreme';
  if (c >= 35) return 'high';
  if (c >= 30) return 'caution';
  return 'safe';
}

const LEVEL_LABEL: Record<Level, string> = {
  safe: 'Safe',
  caution: 'Caution',
  high: 'High Alert',
  extreme: 'Extreme',
  crisis: 'Crisis',
};

const LEVEL_SUMMARY: Record<Level, string> = {
  safe: 'Comfortable right now. Stay aware as the day warms up.',
  caution: 'Hot out. Take shade breaks and drink water often.',
  high: 'Dangerous heat. Limit time outside and avoid hard work.',
  extreme: 'Extreme heat. Stay indoors in the afternoon if you can.',
  crisis: 'Life-threatening heat. Stay somewhere cool.',
};

function chipColors(level: Level, isDark: boolean) {
  if (isDark) {
    const fg = { safe: '#4ADE80', caution: '#FACC15', high: '#FB923C', extreme: '#F87171', crisis: '#E879F9' }[level];
    return { bg: '#131C2E', fg, border: fg };
  }
  const map: Record<Level, { bg: string; fg: string }> = {
    safe: { bg: '#15803D', fg: '#FFFFFF' },
    caution: { bg: '#FACC15', fg: '#0A0A0A' },
    high: { bg: '#EA580C', fg: '#0A0A0A' },
    extreme: { bg: '#B91C1C', fg: '#FFFFFF' },
    crisis: { bg: '#6B21A8', fg: '#FFFFFF' },
  };
  return { ...map[level], border: map[level].bg };
}

// ─── Personal risk ────────────────────────────────────────────────────────────

type Personal = 'low' | 'moderate' | 'high' | 'veryHigh';

function personalRisk(tempC: number, multiplier: number): Personal {
  const adjusted = tempC * multiplier;
  if (adjusted >= 52 || tempC >= 40) return 'veryHigh';
  if (adjusted >= 42 || tempC >= 35) return 'high';
  if (adjusted >= 34 || tempC >= 30) return 'moderate';
  return 'low';
}

const PERSONAL_LABEL: Record<Personal, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  veryHigh: 'Very high',
};

function riskReasons(p: HeatProfile): string {
  const r: string[] = [];
  if (p.isElderly) r.push('age');
  if (p.hasHeartDisease) r.push('heart');
  if (p.hasDiabetes) r.push('diabetes');
  if (p.hasRespiratoryIssues) r.push('breathing');
  if (p.takesMedications) r.push('medications');
  if (p.noAC) r.push('no AC');
  else if (p.acUnreliable) r.push('unreliable AC');
  return r.join(', ');
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const CUP_ML = 240;

// ─── Attention item ───────────────────────────────────────────────────────────

interface AttentionItem {
  urgent: boolean;
  title: string;
  body: string;
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { formatTemp, isDark } = useSettings();
  const c: Skin = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<HeatProfile>(getHeatProfile());
  const [hydration, setHydration] = useState<HydrationSummary | null>(null);
  const [vehicleSession, setVehicleSession] = useState<VehicleSession | null>(null);
  const [contactCount, setContactCount] = useState<number>(0);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [riders, setRiders] = useState<string[]>([]);
  const [, setTick] = useState(0);
  const lastAlertTemp = useRef<number>(0);

  const { snapshot, loading: weatherLoading, error: weatherError } = useWeather();
  const todayHighF = getTodayHighF(snapshot);
  const currentTempF = snapshot ? Math.round(snapshot.current.tempF) : null;

  // ── Hydration ──────────────────────────────────────────────────────────────
  const recomputeHydration = useCallback(() => {
    const tempForTarget = todayHighF ?? currentTempF;
    if (tempForTarget === null) return;
    const target = calculateHydrationTarget(getHeatProfile(), tempForTarget);
    setHydration(computeHydrationSummary(target, getHydrationLogs()));
  }, [todayHighF, currentTempF]);

  const addCup = () => {
    addHydrationLog(CUP_ML, 'cup');
    haptics.selection();
    recomputeHydration();
  };

  // ── Refresh local state whenever Home is shown ─────────────────────────────
  useFocusEffect(useCallback(() => {
    const p = getHeatProfile();
    setProfile(p);
    setVehicleSession(getActiveVehicleSession());
    setTrip(getActiveTrip());
    setRiders(carRiderNames());
    planDailyCheckIns().catch(() => {});
    try { setContactCount(getContacts().length); } catch { setContactCount(0); }
    recomputeHydration();

    // Keep the Daily Brief cache warm for the Brief screen (real weather only)
    if (todayHighF !== null && p.profileComplete && !getCachedBrief()) {
      try {
        const acclim = getAcclimationState();
        const target = calculateHydrationTarget(p, todayHighF);
        const summary = computeHydrationSummary(target, getHydrationLogs());
        cacheBrief(generateDailyBrief({
          profile: p,
          forecastHighF: todayHighF,
          hydrationTargetOz: mlToOz(target.dailyTargetMl),
          hydrationPercentComplete: summary.percentComplete,
          acclimationDay: acclim.isActive ? acclim.currentDay : null,
          acclimationScore: getAcclimationScore(acclim.completedDays.length),
          medicationWarnings: p.takesMedications ? 1 : 0,
        }));
      } catch {}
    }
  }, [todayHighF, recomputeHydration]));

  // Tick the display while a vehicle timer or trip check-in is running
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), vehicleSession || trip ? 30_000 : 60_000);
    return () => clearInterval(id);
  }, [vehicleSession, trip]);

  // React to each new weather reading: exposure tracker + heat alerts
  useEffect(() => {
    if (!snapshot) return;
    const tempF = snapshot.current.tempF;
    const feelsC = fToC(snapshot.current.feelsLikeF);
    if (PassiveTracker.getState().isTracking) {
      Promise.resolve(PassiveTracker.updateTemperature(tempF)).catch(() => {});
    }
    const threshold = profile.alertThreshold ?? 35;
    const rounded = Math.round(feelsC);
    if (getNotificationPrefs().heatAlerts && rounded >= threshold && rounded !== lastAlertTemp.current) {
      const riskLevel = rounded >= 40 ? 'critical' : rounded >= 35 ? 'high' : 'caution';
      Promise.resolve(scheduleHeatAlert(rounded, riskLevel)).catch(() => {});
      lastAlertTemp.current = rounded;
    }
  }, [snapshot?.fetchedAt, profile.alertThreshold]);

  // Ask for notification permission once (heat alerts + hot-day reminders)
  useEffect(() => {
    registerForPushNotifications().catch(() => {});
  }, []);

  // "Look before you lock" reminders: only for people with kids or pets in the
  // car (or who haven't answered yet). Re-planned when the forecast updates.
  useEffect(() => {
    if (!snapshot) return;
    if (profile.householdAnswered && !hasVehicleDependents(profile) && riders.length === 0) {
      cancelVehicleReminders();
      return;
    }
    const days = getUpcomingDateKeys(snapshot, 5)
      .map(dateKey => snapshot.daily.find(d => d.dateKey === dateKey))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map(d => ({ dateKey: d.dateKey, highF: d.highF }));
    scheduleHotDayVehicleReminders(days, riders);
  }, [snapshot?.fetchedAt, profile.householdAnswered, profile.drivesWithKids, profile.drivesWithPets, riders.join('|')]);

  // Refresh weather every 15 minutes while Home is mounted
  useEffect(() => {
    const id = setInterval(() => { refreshWeather(true); }, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshWeather(true);
    setRefreshing(false);
  };

  // ── No weather yet ─────────────────────────────────────────────────────────
  if (!snapshot) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: c.bg, paddingHorizontal: 24 }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {!weatherError || weatherLoading ? (
          <>
            <ActivityIndicator size="large" color={c.accent} />
            <Text style={[styles.loadingText, { color: c.muted }]}>Getting your local conditions…</Text>
          </>
        ) : (
          <>
            <Text style={[styles.noWeatherTitle, { color: c.text }]}>Weather unavailable</Text>
            <Text style={[styles.noWeatherText, { color: c.muted }]}>
              HeatGuard couldn't load your local conditions. Check your connection and try again. SOS and the emergency card still work.
            </Text>
            <Pressable
              onPress={() => refreshWeather(true)}
              accessibilityRole="button"
              style={[styles.solidBtn, { backgroundColor: c.btnDark, alignSelf: 'stretch' }]}
            >
              <Text style={[styles.solidBtnText, { color: c.onBtnDark }]}>Try again</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/offline/emergency-card')}
              accessibilityRole="button"
              style={[styles.outlineBtn, { borderColor: c.border, borderWidth, alignSelf: 'stretch', marginTop: 10 }]}
            >
              <Text style={[styles.outlineBtnText, { color: c.text }]}>Open emergency info card</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const tempC = Math.round(fToC(snapshot.current.tempF));
  const feelsC = Math.round(fToC(snapshot.current.feelsLikeF));
  const level = levelFromFeelsC(feelsC);
  const chip = chipColors(level, isDark);
  const locationName = snapshot.locationName ?? 'Your location';
  const ageMins = snapshotAgeMinutes(snapshot);
  const updatedLabel =
    (ageMins < 2 ? 'Updated just now' : ageMins < 60 ? `Updated ${ageMins} min ago` : `Updated ${Math.round(ageMins / 60)} hr ago`) +
    (weatherError ? ' · offline' : '');

  const firstName = profile.name.trim().split(' ')[0];
  const personal = personalRisk(tempC, getRiskMultiplier(profile));
  const reasons = riskReasons(profile);
  const showVehicle = hasVehicleDependents(profile) || riders.length > 0;
  const coolingRisk = hasCoolingRisk(profile);
  const checkInStatus = getCheckInStatus();
  const riderText = riders.length
    ? `${joinNames(riders)} aboard?`
    : `${profile.drivesWithKids && profile.drivesWithPets ? 'Kids & pets' : profile.drivesWithKids ? 'Kids' : 'Pets'} aboard?`;

  const vehicleMinutes = vehicleSession
    ? Math.max(0, Math.floor((Date.now() - new Date(vehicleSession.startTime).getTime()) / 60_000))
    : 0;

  const consumedOz = hydration ? mlToOz(hydration.consumedMl) : 0;
  const targetOz = hydration ? mlToOz(hydration.target.dailyTargetMl) : 0;
  const remainingOz = hydration ? mlToOz(hydration.remainingMl) : 0;
  const hydrationPct = hydration ? hydration.percentComplete : 0;

  // ── One attention item, most urgent first ──────────────────────────────────
  let attention: AttentionItem | null = null;
  if (vehicleSession) {
    attention = {
      urgent: true,
      title: `Vehicle timer: ${vehicleMinutes} min`,
      body: 'Is everyone out of the car?',
      primary: {
        label: 'Yes, all clear',
        onPress: () => { dismissVehicleSession(); setVehicleSession(null); haptics.selection(); },
      },
      secondary: { label: 'Open timer', onPress: () => router.push('/vehicle/alert') },
    };
  } else if (trip && isTripOverdue(trip)) {
    attention = {
      urgent: true,
      title: 'Trip check-in: are you OK?',
      body: `You planned to be back from ${trip.activityLabel.toLowerCase()} by ${formatClock(trip.checkAt)}.`,
      primary: {
        label: "I'm OK",
        onPress: async () => { await endTrip(); setTrip(null); haptics.selection(); },
      },
      secondary: {
        label: 'Text my contacts',
        onPress: () => { textContacts(`I went out for ${trip.activityLabel.toLowerCase()} and may need help.`); },
      },
    };
  } else if (trip) {
    attention = {
      urgent: false,
      title: `${trip.activityLabel} · check-in at ${formatClock(trip.checkAt)}`,
      body: 'HeatGuard will check on you then. Tap below when you are back.',
      primary: {
        label: "I'm back safe",
        onPress: async () => { await endTrip(); setTrip(null); haptics.selection(); },
      },
    };
  } else if (checkInStatus === 'due') {
    attention = {
      urgent: true,
      title: 'Daily check-in: are you OK?',
      body: `Your check-in was at ${formatCheckInTime()}. Tap below so HeatGuard knows you are safe.`,
      primary: {
        label: "I'm OK",
        onPress: async () => { await confirmToday(); haptics.selection(); setTick(t => t + 1); },
      },
      secondary: {
        label: 'Text my contacts',
        onPress: () => { textContacts('I missed my HeatGuard daily check-in and may need help.'); },
      },
    };
  } else if (!profile.householdAnswered) {
    attention = {
      urgent: false,
      title: 'Who are you protecting?',
      body: 'Answer 4 quick questions so HeatGuard shows the right tools for you.',
      primary: { label: 'Answer now', onPress: () => router.push('/profile/household') },
    };
  } else if (contactCount === 0) {
    attention = {
      urgent: false,
      title: 'Add an emergency contact',
      body: profile.livesAlone
        ? 'You live alone. Make sure SOS can reach someone who can check on you.'
        : 'So SOS can text someone your location if you need help.',
      primary: { label: 'Add a contact', onPress: () => router.push('/emergency/contacts') },
    };
  } else if ((profile.livesAlone || coolingRisk) && checkInStatus === 'off' && !isSuggestionDismissed()) {
    attention = {
      urgent: false,
      title: 'Turn on a daily check-in',
      body: profile.livesAlone
        ? 'You live alone. A daily "Are you OK?" makes it easy to reach someone if the heat gets to you.'
        : 'Your home cooling may not be reliable. A daily "Are you OK?" makes it easy to reach someone if it fails.',
      primary: { label: 'Set it up', onPress: () => router.push('/profile/household') },
      secondary: { label: 'Not now', onPress: () => { dismissSuggestion(); setTick(t => t + 1); } },
    };
  }
  const hydrationBehind = !!hydration && (hydration.status === 'behind' || hydration.status === 'critical');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.muted} />}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <View style={styles.topRow}>
          <Text style={[styles.location, { color: c.muted }]} numberOfLines={1}>{locationName}</Text>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={styles.iconBtn}
            hitSlop={6}
          >
            <Settings size={22} color={c.muted} />
          </Pressable>
        </View>
        <View style={styles.header}>
          <Text
            style={[styles.greeting, { color: c.text }]}
            accessibilityRole="header"
            numberOfLines={2}
          >
            {firstName ? `${greeting()},\n${firstName}` : greeting()}
          </Text>
          <Pressable
            onPress={() => router.push('/intelligence/forecast')}
            accessibilityRole="button"
            accessibilityLabel={`${formatTemp(tempC)}, feels like ${formatTemp(feelsC)}, ${LEVEL_LABEL[level]}. Open forecast`}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: chip.bg, borderColor: chip.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.chipTemp, { color: chip.fg }]}>{formatTemp(tempC, false)}</Text>
            <Text style={[styles.chipLabel, { color: chip.fg }]}>{LEVEL_LABEL[level]}</Text>
          </Pressable>
        </View>

        {/* ── Summary ──────────────────────────────────────────────────────── */}
        <View
          style={[
            styles.summary,
            isDark
              ? { backgroundColor: c.card, padding: 14, borderRadius: 14 }
              : { borderTopWidth: 3, borderTopColor: c.text, paddingTop: 10 },
          ]}
        >
          <Text style={[styles.summaryText, { color: c.text }]}>{LEVEL_SUMMARY[level]}</Text>
          {profile.profileComplete ? (
            <Pressable
              onPress={profile.takesMedications ? () => router.push('/profile/medications') : undefined}
              disabled={!profile.takesMedications}
              accessibilityRole={profile.takesMedications ? 'button' : 'text'}
              accessibilityHint={profile.takesMedications ? 'Opens medication heat tips' : undefined}
              style={styles.personalRow}
            >
              <Text style={[styles.personal, { color: c.text }]}>
                Your risk: <Text style={styles.personalStrong}>{PERSONAL_LABEL[personal]}</Text>
                {reasons ? <Text style={{ color: c.muted }}> · {reasons}</Text> : null}
              </Text>
              {profile.takesMedications && <ChevronRight size={18} color={c.muted} />}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/profile/heat-profile')}
              accessibilityRole="button"
              style={styles.inlineLink}
            >
              <UserRound size={18} color={c.accent} />
              <Text style={[styles.inlineLinkText, { color: c.accent }]}>Set up your heat profile for your personal risk</Text>
            </Pressable>
          )}
        </View>

        {/* ── Needs your attention ─────────────────────────────────────────── */}
        {attention && (
          <View
            style={[
              styles.attention,
              {
                backgroundColor: attention.urgent ? c.urgentBg : c.attentionBg,
                borderColor: c.attentionBorder,
                borderWidth,
              },
            ]}
            accessibilityRole="alert"
          >
            <View style={styles.attentionLabelRow}>
              <Bell size={16} color={attention.urgent ? c.urgentLabel : c.attentionLabel} />
              <Text style={[styles.attentionLabel, { color: attention.urgent ? c.urgentLabel : c.attentionLabel }]}>
                Needs your attention
              </Text>
            </View>
            <Text style={[styles.attentionTitle, { color: c.text }]}>{attention.title}</Text>
            <Text style={[styles.attentionBody, { color: c.text }]}>{attention.body}</Text>
            <View style={styles.attentionActions}>
              <Pressable
                onPress={attention.primary.onPress}
                accessibilityRole="button"
                style={({ pressed }) => [styles.solidBtn, styles.flex1, { backgroundColor: c.btnDark, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={[styles.solidBtnText, { color: c.onBtnDark }]}>{attention.primary.label}</Text>
              </Pressable>
              {attention.secondary && (
                <Pressable
                  onPress={attention.secondary.onPress}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.outlineBtn,
                    { borderColor: c.border, borderWidth, backgroundColor: pressed ? c.pressed : c.card },
                  ]}
                >
                  <Text style={[styles.outlineBtnText, { color: c.text }]}>{attention.secondary.label}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ── Quick tiles ──────────────────────────────────────────────────── */}
        <View style={styles.tiles}>
          <Pressable
            onPress={() => router.push('/hydration/tracker')}
            accessibilityRole="button"
            accessibilityLabel={`Hydration, ${consumedOz} of ${targetOz} ounces. Open tracker`}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: pressed ? c.pressed : c.card, borderColor: c.border, borderWidth },
            ]}
          >
            <View style={styles.tileTop}>
              <Droplet size={26} color={c.accent} />
              <Pressable
                onPress={addCup}
                accessibilityRole="button"
                accessibilityLabel="Log one cup of water"
                hitSlop={8}
                style={({ pressed }) => [styles.plusBtn, { backgroundColor: c.accent, opacity: pressed ? 0.8 : 1 }]}
              >
                <Plus size={22} color={c.onAccent} strokeWidth={3} />
              </Pressable>
            </View>
            <Text style={[styles.tileTitle, { color: c.text }]}>Hydration</Text>
            <Text style={[styles.tileBig, { color: c.text }]}>
              {consumedOz}
              <Text style={[styles.tileBigUnit, { color: c.muted }]}> / {targetOz} oz</Text>
            </Text>
            <View style={[styles.track, { backgroundColor: c.track }]}>
              <View style={[styles.trackFill, { width: `${hydrationPct}%`, backgroundColor: c.accent }]} />
            </View>
            {hydrationBehind && (
              <Text style={[styles.tileNudge, { color: c.urgentLabel }]}>Drink a cup now</Text>
            )}
          </Pressable>

          {showVehicle ? (
            <Pressable
              onPress={() => router.push('/vehicle/alert')}
              accessibilityRole="button"
              accessibilityLabel="Vehicle check. Start a timer when you park"
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: pressed ? c.pressed : c.card, borderColor: c.border, borderWidth },
              ]}
            >
              <Car size={26} color={c.vehicle} />
              <Text style={[styles.tileTitle, { color: c.text }]}>Vehicle check</Text>
              <Text style={[styles.tileSub, { color: c.muted }]}>
                {vehicleSession
                  ? `Timer running · ${vehicleMinutes} min`
                  : `${riderText} Start a timer when you park.`}
              </Text>
            </Pressable>
          ) : coolingRisk ? (
            <Pressable
              onPress={() => router.push('/map')}
              accessibilityRole="button"
              accessibilityLabel="Cool Spots. Cooling centers near you"
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: pressed ? c.pressed : c.card, borderColor: c.border, borderWidth },
              ]}
            >
              <MapPin size={26} color={c.accent} />
              <Text style={[styles.tileTitle, { color: c.text }]}>Cool Spots</Text>
              <Text style={[styles.tileSub, { color: c.muted }]}>Cooling centers near you, with hours and directions.</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/offline/emergency-card')}
              accessibilityRole="button"
              accessibilityLabel="Emergency info card. Works offline"
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: pressed ? c.pressed : c.card, borderColor: c.border, borderWidth },
              ]}
            >
              <LifeBuoy size={26} color={c.vehicle} />
              <Text style={[styles.tileTitle, { color: c.text }]}>Emergency card</Text>
              <Text style={[styles.tileSub, { color: c.muted }]}>Symptoms, what to do, and your contacts. Works offline.</Text>
            </Pressable>
          )}
        </View>

        {/* ── More tools ───────────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: c.muted }]}>More tools</Text>
        <View style={[styles.list, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
          {[
            ...(coolingRisk && showVehicle ? [{ label: 'Cool Spots near you', Icon: MapPin, href: '/map' }] : []),
            { label: 'Daily brief', Icon: Newspaper, href: '/brief' },
            { label: 'Cool-down timer', Icon: Snowflake, href: '/cooldown/timer' },
            { label: 'Heat acclimation', Icon: Activity, href: '/acclimation' },
            ...(showVehicle || coolingRisk ? [{ label: 'Emergency info card', Icon: LifeBuoy, href: '/offline/emergency-card' }] : []),
          ].map((item, i, arr) => (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as any)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.listRow,
                {
                  backgroundColor: pressed ? c.pressed : 'transparent',
                  borderBottomColor: c.divider,
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                },
              ]}
            >
              <item.Icon size={22} color={c.text} />
              <Text style={[styles.listLabel, { color: c.text }]}>{item.label}</Text>
              <ChevronRight size={20} color={c.muted} />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.footer, { color: c.muted }]}>{updatedLabel}. Pull down to refresh.</Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  noWeatherTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  noWeatherText: { fontSize: 16, textAlign: 'center', lineHeight: 23, marginBottom: 20 },

  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  flex1: { flex: 1 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  location: { fontSize: 14, fontWeight: '700' },
  greeting: { flex: 1, fontSize: 26, fontWeight: '800', letterSpacing: -0.3, lineHeight: 31 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chip: {
    minHeight: 56,
    minWidth: 76,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  chipTemp: { fontSize: 26, fontWeight: '800', lineHeight: 28, fontVariant: ['tabular-nums'] },
  chipLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  summary: { gap: 4 },
  summaryText: { fontSize: 17, fontWeight: '700', lineHeight: 23 },
  summaryMeta: { fontSize: 14 },
  personalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  personal: { flex: 1, fontSize: 15, lineHeight: 21 },
  personalStrong: { fontWeight: '800' },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  inlineLinkText: { fontSize: 15, fontWeight: '700', flexShrink: 1 },

  attention: { borderRadius: 16, padding: 16, gap: 8 },
  attentionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attentionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  attentionTitle: { fontSize: 20, fontWeight: '800', lineHeight: 25 },
  attentionBody: { fontSize: 16, lineHeight: 22 },
  attentionActions: { flexDirection: 'row', gap: 10, marginTop: 4 },

  solidBtn: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  solidBtnText: { fontSize: 17, fontWeight: '800' },
  outlineBtn: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  outlineBtnText: { fontSize: 17, fontWeight: '700' },

  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, borderRadius: 16, padding: 14, gap: 8, minHeight: 156 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plusBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 16, fontWeight: '800' },
  tileBig: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tileBigUnit: { fontSize: 15, fontWeight: '600' },
  tileSub: { fontSize: 15, lineHeight: 20 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  tileNudge: { fontSize: 14, fontWeight: '800' },
  footer: { fontSize: 13, textAlign: 'center', marginTop: 4 },
  trackFill: { height: 8, borderRadius: 4 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, minHeight: 72 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17, fontWeight: '800' },
  rowSub: { fontSize: 14, lineHeight: 19 },

  sectionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 6 },
  list: { borderRadius: 16, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 56 },
  listLabel: { flex: 1, fontSize: 16, fontWeight: '700' },
});
