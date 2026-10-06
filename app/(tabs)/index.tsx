// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/(tabs)/index.tsx
// HeatGuard · Home
//  - Greeting with location and current temperature, then today's
//    risk card (BriefHeroCard, shared risk engine). Taps to "Your heat risk"
//    (app/risk), which explains how the level is measured.
//    Settings live in Profile; no settings icon here.
//  - "Needs your attention" card (one item at a time, most urgent first);
//    a due check-in opens the check-in screen (/checkin)
//  - Quick tiles: Hydration (+1 cup) and Vehicle check (only if kids/pets ride
//    along; otherwise the offline Emergency card)
//  - A short list of tools; last-updated time at the bottom
// Every tappable card uses TactileCard: a solid ledge behind it that the
// card sinks into when pressed. Arrows mark cards that open another screen.
// Skins: High Sun (light) / Night Shift (dark). SOS lives in the tab bar.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Droplet, Car, Plus, Bell, LifeBuoy,
  Snowflake, Activity, UserRound, MapPin, ArrowRight, Pill, Minus,
} from 'lucide-react-native';
import { getTodayPeakFeelsF } from '../../src/features/risk/riskEngine';
import BriefHeroCard from '../../src/components/brief/BriefHeroCard';
import { buildTodayBrief } from '../../src/features/brief/todayBrief';
import TactileCard from '../../src/components/ui/TactileCard';
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
  getHeatProfile, hasVehicleDependents, hasCoolingRisk, isHomeVulnerable, type HeatProfile,
} from '../../src/features/profile/storage/profileStorage';
import { PassiveTracker } from '../../src/features/exposure/passiveTracker';
import {
  calculateHydrationTarget, computeHydrationSummary, mlToOz, type HydrationSummary,
} from '../../src/features/hydration/hydrationEngine';
import {
  addHydrationLog, getHydrationLogs, getTodayHydrationLogs, removeHydrationLog,
} from '../../src/features/hydration/hydrationStorage';
import { getCachedBrief, generateDailyBrief, cacheBrief } from '../../src/features/brief/briefEngine';
import { getAcclimationScore } from '../../src/features/acclimation/acclimationEngine';
import { getAcclimationState } from '../../src/features/acclimation/acclimationStorage';
import {
  getActiveVehicleSession, dismissVehicleSession, type VehicleSession,
} from '../../src/features/vehicle/vehicleAlertEngine';
import { getContacts } from '../../src/features/emergency/storage/contactStorage';
import { carRiderNames, joinNames } from '../../src/features/profile/storage/dependentsStorage';
import {
  getCheckInStatus, planDailyCheckIns, isSuggestionDismissed, dismissSuggestion, getDueTimeLabel, formatNextCheckIn,
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
    cardBorder: '#0A0A0A',
    ledge: '#0A0A0A',
    iconBadge: '#F4F4F0',
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
    cardBorder: '#3A4C78',
    ledge: '#2A3A5E',
    iconBadge: '#0B1220',
  },
};

type Skin = typeof SKIN.light;

// ─── Hydration colors: red → amber → green as you near the target ────────────

function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
function ramp(stops: [string, string, string], pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 100));
  return t < 0.5 ? mix(stops[0], stops[1], t * 2) : mix(stops[1], stops[2], (t - 0.5) * 2);
}
function hydrationColors(pct: number, isDark: boolean) {
  return isDark
    ? { bg: ramp(['#3B1219', '#3A2E0B', '#0F2E1C'], pct), fill: ramp(['#F87171', '#FBBF24', '#4ADE80'], pct) }
    : { bg: ramp(['#FECACA', '#FDE68A', '#BBF7D0'], pct), fill: ramp(['#DC2626', '#D97706', '#16A34A'], pct) };
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

  /** Undo the most recent entry logged today (mis-taps on +). */
  const removeLast = () => {
    const today = getTodayHydrationLogs()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (!today.length) return;
    removeHydrationLog(today[0].id);
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
          forecastFeelsMaxF: getTodayPeakFeelsF(snapshot) ?? undefined,
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
  // Today's brief, built live so Home and the brief always match
  const brief = buildTodayBrief(snapshot, profile);
  const locationName = snapshot.locationName ?? 'Your location';
  const ageMins = snapshotAgeMinutes(snapshot);
  const updatedLabel =
    (ageMins < 2 ? 'Updated just now' : ageMins < 60 ? `Updated ${ageMins} min ago` : `Updated ${Math.round(ageMins / 60)} hr ago`) +
    (weatherError ? ' · offline' : '');

  const firstName = profile.name.trim().split(' ')[0];
  const showVehicle = hasVehicleDependents(profile) || riders.length > 0;
  const coolingRisk = hasCoolingRisk(profile);
  const checkInStatus = getCheckInStatus();
  const nextCheckIn = formatNextCheckIn();
  const checkInSub =
    checkInStatus === 'off' ? 'Off. Tap to set up.'
      : checkInStatus === 'due' ? 'Due now. Tap to check in.'
        : checkInStatus === 'done' ? `Done for today.${nextCheckIn ? ` Next ${nextCheckIn}.` : ''}`
          : `Next ${nextCheckIn ?? 'soon'}.`;
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
    const dueAt = getDueTimeLabel();
    attention = {
      urgent: true,
      title: 'Check-in: are you OK?',
      body: `${dueAt ? `Your ${dueAt} check-in is waiting.` : 'Your check-in is waiting.'} Tap below so HeatGuard knows you are safe.`,
      primary: {
        label: 'Check in',
        onPress: () => router.push('/checkin'),
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
      body: 'A few quick taps so HeatGuard shows the right tools for you.',
      primary: { label: 'Answer now', onPress: () => router.push('/profile/household') },
    };
  } else if (!profile.homeAnswered && isHomeVulnerable(profile)) {
    attention = {
      urgent: false,
      title: 'How cool does your home stay?',
      body: 'Three quick questions about your AC. HeatGuard adds free cooling tips and bill help if you need them.',
      primary: { label: 'Answer now', onPress: () => router.push('/profile/home') },
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
  } else if ((isHomeVulnerable(profile) || coolingRisk) && checkInStatus === 'off' && !isSuggestionDismissed()) {
    attention = {
      urgent: false,
      title: 'Turn on daily check-ins',
      body: profile.livesAlone
        ? 'You live alone. A daily "Are you OK?" makes it easy to reach someone if the heat gets to you.'
        : coolingRisk
          ? 'Your home cooling may not be reliable. A daily "Are you OK?" makes it easy to reach someone if it fails.'
          : 'A daily "Are you OK?" with a quick home safety check, shared with a heat buddy if you like.',
      primary: { label: 'Set it up', onPress: () => router.push('/checkin/settings') },
      secondary: { label: 'Not now', onPress: () => { dismissSuggestion(); setTick(t => t + 1); } },
    };
  }
  const hydroColors = hydrationColors(hydrationPct, isDark);

  // ── Render ─────────────────────────────────────────────────────────────────
  const card = { faceColor: c.card, borderColor: c.cardBorder, ledgeColor: c.ledge, borderWidth: isDark ? 1.5 : 2 };

  const tools = [
    ...(coolingRisk && showVehicle ? [{ label: 'Cool Spots near you', Icon: MapPin, href: '/map' }] : []),
    { label: 'Cool-down timer', Icon: Snowflake, href: '/cooldown/timer' },
    ...(profile.worksOutdoors || profile.activityLevel === 'high'
      ? [{ label: 'Heat acclimation', Icon: Activity, href: '/acclimation' }]
      : []),
    ...(profile.takesMedications ? [{ label: 'Medicines & heat', Icon: Pill, href: '/profile/medications' }] : []),
    ...(showVehicle || coolingRisk ? [{ label: 'Emergency info card', Icon: LifeBuoy, href: '/offline/emergency-card' }] : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.muted} />}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <Text
          style={[styles.greeting, { color: c.text }]}
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {firstName ? `${greeting()}, ${firstName}` : greeting()}
        </Text>

        {/* ── Today's risk card ────────────────────────────────────────── */}
        {brief && (
          <TactileCard
            faceColor="transparent"
            borderColor="transparent"
            ledgeColor={c.ledge}
            borderWidth={0}
            radius={20}
            onPress={() => router.push('/risk')}
            accessibilityLabel={`Today: ${brief.headline} ${brief.forecastSummary} Risk level ${Math.round(brief.overallScore / 25)} of 4.`}
            accessibilityHint="Explains how your heat risk is measured"
          >
            <BriefHeroCard
              brief={brief}
              now={{
                location: locationName,
                reading: `Now ${formatTemp(tempC, false)} · feels ${formatTemp(feelsC, false)}`,
              }}
            />
          </TactileCard>
        )}

        {!profile.profileComplete && (
          <Pressable onPress={() => router.push('/profile/heat-profile')} accessibilityRole="button" style={styles.inlineLink}>
            <UserRound size={18} color={c.accent} />
            <Text style={[styles.inlineLinkText, { color: c.accent }]}>Set up your heat profile for your personal risk</Text>
          </Pressable>
        )}

        {/* ── Needs your attention ─────────────────────────────────────────── */}
        {attention && (
          <View
            style={[
              styles.attention,
              {
                backgroundColor: attention.urgent ? c.urgentBg : c.attentionBg,
                borderColor: c.attentionBorder,
                borderWidth: card.borderWidth,
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
              <TactileCard
                faceColor={c.btnDark}
                borderColor={c.btnDark}
                ledgeColor={isDark ? c.ledge : '#3F3F3A'}
                borderWidth={card.borderWidth}
                radius={12}
                onPress={attention.primary.onPress}
                containerStyle={styles.flex1}
                style={styles.btnFace}
              >
                <Text style={[styles.solidBtnText, { color: c.onBtnDark }]}>{attention.primary.label}</Text>
              </TactileCard>
              {attention.secondary && (
                <TactileCard {...card} radius={12} onPress={attention.secondary.onPress} style={styles.btnFace}>
                  <Text style={[styles.outlineBtnText, { color: c.text }]}>{attention.secondary.label}</Text>
                </TactileCard>
              )}
            </View>
          </View>
        )}

        {/* ── Quick tiles ──────────────────────────────────────────────────── */}
        <View style={styles.tiles}>
          <TactileCard
            {...card}
            faceColor={hydroColors.bg}
            containerStyle={styles.flex1}
            style={styles.tile}
            onPress={() => router.push('/hydration/tracker')}
            accessibilityLabel={`Hydration, ${consumedOz} of ${targetOz} ounces`}
            accessibilityHint="Opens the hydration tracker"
          >
            <View style={styles.tileTitleRow}>
              <Text style={[styles.tileTitle, { color: c.text }]}>Hydration</Text>
              <ArrowRight size={18} color={c.text} />
            </View>
            <View>
              <Text style={[styles.tileBig, { color: c.text }]}>{consumedOz}</Text>
              <Text style={[styles.tileBigUnit, { color: c.muted }]}>of {targetOz} oz</Text>
            </View>
            <View style={[styles.track, { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(10,10,10,0.12)' }]}>
              <View style={[styles.trackFill, { width: `${hydrationPct}%`, backgroundColor: hydroColors.fill }]} />
            </View>
            <View style={styles.stepper}>
              <Pressable
                onPress={removeLast}
                disabled={consumedOz === 0}
                accessibilityRole="button"
                accessibilityLabel="Undo last water entry"
                accessibilityState={{ disabled: consumedOz === 0 }}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.stepBtn,
                  {
                    borderColor: c.cardBorder,
                    borderWidth: card.borderWidth,
                    backgroundColor: c.card,
                    opacity: consumedOz === 0 ? 0.4 : 1,
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  },
                ]}
              >
                <Minus size={20} color={c.text} strokeWidth={3} />
              </Pressable>
              <Pressable
                onPress={addCup}
                accessibilityRole="button"
                accessibilityLabel="Log one cup of water"
                hitSlop={4}
                style={({ pressed }) => [
                  styles.stepBtn,
                  styles.stepAdd,
                  { backgroundColor: c.accent, transform: [{ scale: pressed ? 0.95 : 1 }] },
                ]}
              >
                <Plus size={20} color={c.onAccent} strokeWidth={3} />
              </Pressable>
            </View>
          </TactileCard>

          {showVehicle ? (
            <TactileCard
              {...card}
              containerStyle={styles.flex1}
              style={styles.tile}
              onPress={() => router.push('/vehicle/alert')}
              accessibilityLabel="Vehicle check"
              accessibilityHint="Start a timer when you park"
            >
              <View style={styles.tileTitleRow}>
                <Text style={[styles.tileTitle, { color: c.text }]}>Vehicle check</Text>
                <ArrowRight size={18} color={c.text} />
              </View>
              <Text style={[styles.tileSub, { color: c.muted }]}>
                {vehicleSession
                  ? `Timer running · ${vehicleMinutes} min`
                  : 'Start a timer when you park.'}
              </Text>
            </TactileCard>
          ) : coolingRisk ? (
            <TactileCard
              {...card}
              containerStyle={styles.flex1}
              style={styles.tile}
              onPress={() => router.push('/map')}
              accessibilityLabel="Cool Spots"
              accessibilityHint="Cooling centers near you"
            >
              <View style={styles.tileTitleRow}>
                <Text style={[styles.tileTitle, { color: c.text }]}>Cool Spots</Text>
                <ArrowRight size={18} color={c.text} />
              </View>
              <Text style={[styles.tileSub, { color: c.muted }]}>Cooling centers near you.</Text>
            </TactileCard>
          ) : (
            <TactileCard
              {...card}
              containerStyle={styles.flex1}
              style={styles.tile}
              onPress={() => router.push('/offline/emergency-card')}
              accessibilityLabel="Emergency info card"
              accessibilityHint="Works offline"
            >
              <View style={styles.tileTitleRow}>
                <Text style={[styles.tileTitle, { color: c.text }]}>Emergency card</Text>
                <ArrowRight size={18} color={c.text} />
              </View>
              <Text style={[styles.tileSub, { color: c.muted }]}>What to do. Works offline.</Text>
            </TactileCard>
          )}
        </View>

        {/* ── Daily check-in (full width) ──────────────────────────────────── */}
        <TactileCard
          {...card}
          style={styles.wideTile}
          onPress={() => router.push(checkInStatus === 'off' ? '/checkin/settings' : '/checkin')}
          accessibilityLabel={`Daily check-in. ${checkInSub}`}
          accessibilityHint={checkInStatus === 'off' ? 'Set up check-ins' : 'Check in now'}
        >
          <View style={styles.flex1}>
            <Text style={[styles.tileTitle, { color: c.text, fontSize: 17 }]}>Daily check-in</Text>
            <Text style={[styles.tileSub, { color: checkInStatus === 'due' ? c.urgentLabel : c.muted }, checkInStatus === 'due' && styles.strong]}>
              {checkInSub}
            </Text>
          </View>
          <ArrowRight size={22} color={c.text} />
        </TactileCard>

        {/* ── More tools ───────────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: c.muted }]}>More tools</Text>
        <View style={styles.toolList}>
          {tools.map(item => (
            <TactileCard
              key={item.href}
              {...card}
              radius={14}
              style={styles.toolRow}
              onPress={() => router.push(item.href as any)}
              accessibilityLabel={item.label}
            >
              <View style={[styles.toolIcon, { backgroundColor: c.iconBadge }]}>
                <item.Icon size={20} color={c.text} />
              </View>
              <Text style={[styles.listLabel, { color: c.text }]}>{item.label}</Text>
              <ArrowRight size={20} color={c.text} />
            </TactileCard>
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

  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  flex1: { flex: 1 },
  strong: { fontWeight: '800' },

  greeting: { fontSize: 26, fontWeight: '800', letterSpacing: -0.3, marginTop: 8, textAlign: 'center' },
  nowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: -6, marginBottom: 4 },
  nowText: { fontSize: 15, fontWeight: '700', flexShrink: 1 },

  heroBand: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 12 },
  heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  heroLocationText: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  heroNow: { fontSize: 30, fontWeight: '800', lineHeight: 34, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  heroFeels: { fontSize: 15, fontWeight: '700' },
  heroPill: { alignSelf: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  heroPillText: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroBody: { paddingHorizontal: 16, paddingTop: 14, gap: 6 },
  heroMessage: { fontSize: 18, fontWeight: '800', lineHeight: 24, textAlign: 'center' },
  heroForecast: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 6, minHeight: 48 },
  heroLink: { fontSize: 16, fontWeight: '800' },

  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: -4 },
  inlineLinkText: { fontSize: 15, fontWeight: '700', flexShrink: 1 },

  attention: { borderRadius: 16, padding: 16, gap: 8 },
  attentionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attentionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  attentionTitle: { fontSize: 20, fontWeight: '800', lineHeight: 25 },
  attentionBody: { fontSize: 16, lineHeight: 22 },
  attentionActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnFace: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },

  solidBtn: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  solidBtnText: { fontSize: 17, fontWeight: '800' },
  outlineBtn: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  outlineBtnText: { fontSize: 17, fontWeight: '700' },

  tiles: { flexDirection: 'row', gap: 8 },
  wideTile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 68, borderRadius: 14 },
  tile: { padding: 12, gap: 6, minHeight: 132, flexGrow: 1, borderRadius: 14 },
  stepper: { flexDirection: 'row', gap: 6, marginTop: 'auto' },
  stepBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepAdd: { flexDirection: 'row', gap: 4 },
  stepAddText: { fontSize: 16, fontWeight: '800' },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  plusBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  tileTitle: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  tileBig: { fontSize: 26, fontWeight: '800', lineHeight: 30, fontVariant: ['tabular-nums'] },
  tileBigUnit: { fontSize: 13, fontWeight: '700' },
  tileSub: { fontSize: 14, lineHeight: 19 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 4 },
  tileNudge: { fontSize: 14, fontWeight: '800' },

  sectionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8 },
  toolList: { gap: 4 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, minHeight: 60 },
  toolIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listLabel: { flex: 1, fontSize: 16, fontWeight: '700' },

  footer: { fontSize: 13, textAlign: 'center', marginTop: 4 },
});
