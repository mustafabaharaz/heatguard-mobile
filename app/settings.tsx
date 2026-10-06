// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/settings.tsx
// HeatGuard · Settings
// Display (units, appearance), notifications, safety profile, data & privacy,
// about. Skins: High Sun (light) / Night Shift (dark), like the rest of the app.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useSettings } from '../src/context/SettingsContext';
import haptics from '../src/utils/haptics';
import { clearAllStores } from '../src/lib/mmkvCompat';
import { LINKS } from '../src/config/links';
import {
  getNotificationPrefs,
  setNotificationPref,
  type NotificationPrefs,
} from '../src/features/settings/appPrefs';
import { scheduleHotDayVehicleReminders, cancelVehicleReminders } from '../src/services/notifications/push';
import { getWeatherSnapshot, getUpcomingDateKeys } from '../src/services/weather/weatherStore';

const SKIN = {
  light: {
    bg: '#F4F4F0', card: '#FFFFFF', border: '#0A0A0A', divider: '#E2E2DC',
    text: '#0A0A0A', muted: '#3F3F3A', accent: '#0B4FD6', pressed: '#ECECE6',
    segBg: '#E2E2DC', segActive: '#0A0A0A', segActiveText: '#FFFFFF',
    danger: '#B91C1C', warnBg: '#FFF4CC', warnText: '#5C4300',
    trackOff: '#C9C9C2',
  },
  dark: {
    bg: '#0B1220', card: '#131C2E', border: '#24314F', divider: '#24314F',
    text: '#F1F5F9', muted: '#A3B1C9', accent: '#38BDF8', pressed: '#1A2540',
    segBg: '#0B1220', segActive: '#38BDF8', segActiveText: '#04121F',
    danger: '#F87171', warnBg: '#2A2410', warnText: '#FBBF24',
    trackOff: '#24314F',
  },
};
type Skin = typeof SKIN.light;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

function Section({ title, children, c, borderWidth }: { title: string; children: React.ReactNode; c: Skin; borderWidth: number }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: c.muted }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>{children}</View>
    </View>
  );
}

function ToggleRow({ icon, label, description, value, onChange, last, c }: {
  icon: IconName; label: string; description?: string; value: boolean;
  onChange: (v: boolean) => void; last?: boolean; c: Skin;
}) {
  return (
    <View style={[styles.row, { borderBottomColor: c.divider, borderBottomWidth: last ? 0 : 1 }]}>
      <Ionicons name={icon} size={24} color={c.text} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: c.text }]}>{label}</Text>
        {description ? <Text style={[styles.rowSub, { color: c.muted }]}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={v => { haptics.medium(); onChange(v); }}
        trackColor={{ false: c.trackOff, true: c.accent }}
        ios_backgroundColor={c.trackOff}
        accessibilityLabel={label}
      />
    </View>
  );
}

function NavRow({ icon, label, description, onPress, last, destructive, external, c }: {
  icon: IconName; label: string; description?: string; onPress: () => void;
  last?: boolean; destructive?: boolean; external?: boolean; c: Skin;
}) {
  const color = destructive ? c.danger : c.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      style={({ pressed }) => [styles.row, {
        backgroundColor: pressed ? c.pressed : 'transparent',
        borderBottomColor: c.divider,
        borderBottomWidth: last ? 0 : 1,
      }]}
    >
      <Ionicons name={icon} size={24} color={color} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color }]}>{label}</Text>
        {description ? <Text style={[styles.rowSub, { color: c.muted }]}>{description}</Text> : null}
      </View>
      {!destructive && (
        <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={20} color={c.muted} />
      )}
    </Pressable>
  );
}

function Segmented({ icon, label, options, value, onChange, note, last, c }: {
  icon: IconName; label: string; options: { label: string; value: string }[];
  value: string; onChange: (v: string) => void; note?: string; last?: boolean; c: Skin;
}) {
  return (
    <View style={[styles.segRow, { borderBottomColor: c.divider, borderBottomWidth: last ? 0 : 1 }]}>
      <View style={styles.segHead}>
        <Ionicons name={icon} size={24} color={c.text} />
        <Text style={[styles.rowTitle, { color: c.text }]}>{label}</Text>
      </View>
      <View style={[styles.seg, { backgroundColor: c.segBg }]} accessibilityRole="radiogroup">
        {options.map(o => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => { haptics.selection(); onChange(o.value); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label}: ${o.label}`}
              style={[styles.segItem, { backgroundColor: active ? c.segActive : 'transparent' }]}
            >
              <Text
                style={[styles.segText, { color: active ? c.segActiveText : c.text, fontWeight: active ? '800' : '600' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {note ? <Text style={[styles.rowSub, { color: c.muted }]}>{note}</Text> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { tempUnit, setTempUnit, appTheme, setAppTheme, isDark } = useSettings();
  const c: Skin = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  const [prefs, setPrefs] = useState<NotificationPrefs>(getNotificationPrefs());
  const [osNotificationsOn, setOsNotificationsOn] = useState(true);

  // Re-check iPhone notification permission whenever Settings is shown
  useFocusEffect(useCallback(() => {
    Notifications.getPermissionsAsync()
      .then(({ status }) => setOsNotificationsOn(status === 'granted'))
      .catch(() => {});
  }, []));

  const toggleHeatAlerts = (value: boolean) => setPrefs(setNotificationPref('heatAlerts', value));

  const toggleVehicleReminders = async (value: boolean) => {
    setPrefs(setNotificationPref('vehicleReminders', value));
    if (!value) {
      await cancelVehicleReminders();
      return;
    }
    const snapshot = getWeatherSnapshot();
    if (snapshot) {
      const days = getUpcomingDateKeys(snapshot, 5)
        .map(k => snapshot.daily.find(d => d.dateKey === k))
        .filter((d): d is NonNullable<typeof d> => !!d)
        .map(d => ({ dateKey: d.dateKey, highF: d.highF }));
      await scheduleHotDayVehicleReminders(days);
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Unable to open link', url));
  };

  const handleClearData = () => {
    haptics.warning();
    Alert.alert(
      'Clear all data?',
      'This permanently deletes your heat profile, household, emergency contacts, check-ins, medicines, hydration log, and settings from this phone. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear everything',
          style: 'destructive',
          onPress: async () => {
            try {
              clearAllStores();
              await AsyncStorage.clear();
              await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
              haptics.success();
              router.replace('/onboarding');
            } catch {
              haptics.error();
              Alert.alert('Couldn’t clear everything', 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const appearanceNote =
    appTheme === 'system'
      ? 'Follows your iPhone: High Sun in light mode, Night Shift in dark mode.'
      : appTheme === 'light'
        ? 'High Sun: bold black on light. Easiest to read outside in bright sun.'
        : 'Night Shift: soft light on navy. Easier on the eyes at night.';

  return (
    <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.back}
      >
        <Ionicons name="chevron-back" size={24} color={c.accent} />
        <Text style={[styles.backText, { color: c.accent }]}>Profile</Text>
      </Pressable>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Settings</Text>

        <Section title="Display" c={c} borderWidth={borderWidth}>
          <Segmented
            c={c}
            icon="thermometer-outline"
            label="Temperature"
            options={[{ label: '°F', value: 'fahrenheit' }, { label: '°C', value: 'celsius' }]}
            value={tempUnit}
            onChange={v => setTempUnit(v as 'fahrenheit' | 'celsius')}
          />
          <Segmented
            c={c}
            icon="contrast-outline"
            label="Appearance"
            options={[
              { label: 'Automatic', value: 'system' },
              { label: 'High Sun', value: 'light' },
              { label: 'Night Shift', value: 'dark' },
            ]}
            value={appTheme}
            onChange={v => setAppTheme(v as 'system' | 'light' | 'dark')}
            note={appearanceNote}
            last
          />
        </Section>

        <Section title="Notifications" c={c} borderWidth={borderWidth}>
          {!osNotificationsOn && (
            <Pressable
              onPress={() => Linking.openSettings()}
              accessibilityRole="button"
              style={[styles.warn, { backgroundColor: c.warnBg, borderBottomColor: c.divider }]}
            >
              <Ionicons name="notifications-off-outline" size={22} color={c.warnText} />
              <Text style={[styles.warnText, { color: c.warnText }]}>
                Notifications are off. Tap to turn them on in iPhone Settings so alerts and check-ins can reach you.
              </Text>
            </Pressable>
          )}
          <ToggleRow
            c={c}
            icon="warning-outline"
            label="Heat alerts"
            description="When it feels as hot as your profile's alert level"
            value={prefs.heatAlerts}
            onChange={toggleHeatAlerts}
          />
          <ToggleRow
            c={c}
            icon="car-outline"
            label="Hot-day car reminders"
            description="7:30 AM “look before you lock” on days forecast at 95°F or more"
            value={prefs.vehicleReminders}
            onChange={toggleVehicleReminders}
            last
          />
        </Section>

        <Section title="Safety profile" c={c} borderWidth={borderWidth}>
          <NavRow c={c} icon="person-outline" label="Heat profile" description="Age, health, alert level" onPress={() => router.push('/profile/heat-profile')} />
          <NavRow c={c} icon="notifications-outline" label="Daily check-in" description="Times, safety check, heat buddy" onPress={() => router.push('/checkin/settings')} />
          <NavRow c={c} icon="call-outline" label="Emergency contacts" description="Who your SOS texts go to" onPress={() => router.push('/emergency/contacts')} last />
        </Section>

        <Section title="Data & privacy" c={c} borderWidth={borderWidth}>
          <View style={[styles.row, { borderBottomColor: c.divider, borderBottomWidth: 1 }]}>
            <Ionicons name="phone-portrait-outline" size={24} color={c.text} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: c.text }]}>Your data stays on this phone</Text>
              <Text style={[styles.rowSub, { color: c.muted }]}>
                No account, no ads, no tracking. Only your approximate location is sent to the weather service.
              </Text>
            </View>
          </View>
          <NavRow c={c} icon="trash-outline" label="Clear all data" destructive onPress={handleClearData} last />
        </Section>

        <Section title="About" c={c} borderWidth={borderWidth}>
          <NavRow c={c} icon="medkit-outline" label="Safety & medical disclaimer" onPress={() => router.push('/disclaimer')} />
          <NavRow c={c} icon="shield-checkmark-outline" label="Privacy policy" external onPress={() => openLink(LINKS.privacy)} />
          <NavRow c={c} icon="document-text-outline" label="Terms of use" external onPress={() => openLink(LINKS.terms)} />
          <NavRow c={c} icon="mail-outline" label="Contact support" external onPress={() => openLink(LINKS.support)} last />
        </Section>

        <Text style={[styles.version, { color: c.muted }]}>
          HeatGuard 1.0.0{'\n'}Weather data by Open-Meteo.com · Cooling centers from the Maricopa Association of Governments Heat Relief Network
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 20, gap: 10 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },

  section: { gap: 8, marginTop: 6 },
  sectionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  card: { borderRadius: 16, overflow: 'hidden' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17, fontWeight: '800' },
  rowSub: { fontSize: 14, lineHeight: 19 },

  segRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  segHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  seg: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segText: { fontSize: 16 },

  warn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1 },
  warnText: { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 20 },

  version: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 16 },
});
