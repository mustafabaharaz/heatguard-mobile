import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../src/context/SettingsContext';
import PressableScale from '../src/components/ui/PressableScale';
import haptics from '../src/utils/haptics';
import * as Notifications from 'expo-notifications';
import { clearAllStores } from '../src/lib/mmkvCompat';
import { LINKS } from '../src/config/links';
import {
  getNotificationPrefs,
  setNotificationPref,
  type NotificationPrefs,
} from '../src/features/settings/appPrefs';
import { scheduleHotDayVehicleReminders, cancelVehicleReminders } from '../src/services/notifications/push';
import { getWeatherSnapshot, getUpcomingDateKeys } from '../src/services/weather/weatherStore';

const C = {
  primary: '#1D3557',
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  surface: '#FFFFFF',
  background: '#F9FAFB',
  border: '#E5E7EB',
  danger: '#E63946',
};

interface SectionProps { title: string; children: React.ReactNode; }
const Section: React.FC<SectionProps> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionCard}>{children}</View>
  </View>
);

interface ToggleRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; description?: string;
  value: boolean; onChange: (v: boolean) => void;
  separator?: boolean;
}
const ToggleRow: React.FC<ToggleRowProps> = ({ icon, label, description, value, onChange, separator = true }) => (
  <View style={[styles.row, separator && styles.rowSeparator]}>
    <View style={styles.rowIconWrap}>
      <Ionicons name={icon} size={20} color={C.primary} />
    </View>
    <View style={styles.rowContent}>
      <Text style={styles.rowLabel}>{label}</Text>
      {description && <Text style={styles.rowDescription}>{description}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={(v) => { haptics.medium(); onChange(v); }}
      trackColor={{ false: C.border, true: C.primary + 'CC' }}
      thumbColor={value ? C.primary : C.textTertiary}
      ios_backgroundColor={C.border}
    />
  </View>
);

interface SegmentedRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  options: { label: string; value: string }[];
  value: string; onChange: (v: string) => void;
  separator?: boolean;
}
const SegmentedRow: React.FC<SegmentedRowProps> = ({ icon, label, options, value, onChange, separator = true }) => (
  <View style={[styles.row, styles.rowColumn, separator && styles.rowSeparator]}>
    <View style={styles.rowHorizontal}>
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon} size={20} color={C.primary} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
    <View style={styles.segmentedControl}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <PressableScale key={opt.value} onPress={() => onChange(opt.value)} hapticStyle="selection">
            <View style={[styles.segmentItem, active && styles.segmentItemActive]}>
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{opt.label}</Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  </View>
);

interface NavRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; description?: string;
  onPress: () => void; separator?: boolean; destructive?: boolean;
}
const NavRow: React.FC<NavRowProps> = ({ icon, label, description, onPress, separator = true, destructive = false }) => (
  <PressableScale onPress={onPress} hapticStyle="light">
    <View style={[styles.row, separator && styles.rowSeparator]}>
      <View style={[styles.rowIconWrap, destructive && { backgroundColor: C.danger + '18' }]}>
        <Ionicons name={icon} size={20} color={destructive ? C.danger : C.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, destructive && { color: C.danger }]}>{label}</Text>
        {description && <Text style={styles.rowDescription}>{description}</Text>}
      </View>
      {!destructive && <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />}
    </View>
  </PressableScale>
);

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { tempUnit, setTempUnit } = useSettings();
  const [prefs, setPrefs] = useState<NotificationPrefs>(getNotificationPrefs());
  const [osNotificationsOn, setOsNotificationsOn] = useState(true);

  // Re-check iPhone notification permission whenever Settings is shown
  useFocusEffect(useCallback(() => {
    Notifications.getPermissionsAsync()
      .then(({ status }) => setOsNotificationsOn(status === 'granted'))
      .catch(() => {});
  }, []));

  const toggleHeatAlerts = (value: boolean) => {
    setPrefs(setNotificationPref('heatAlerts', value));
  };

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
      'This permanently deletes your heat profile, emergency contacts, medications, hydration and exposure history, and settings from this phone. This can’t be undone.',
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </PressableScale>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>

        <Section title="Display">
          <SegmentedRow
            icon="thermometer-outline" label="Temperature"
            options={[{ label: '°F', value: 'fahrenheit' }, { label: '°C', value: 'celsius' }]}
            value={tempUnit} onChange={(v) => setTempUnit(v as 'fahrenheit' | 'celsius')}
            separator={false}
          />
        </Section>

        <Section title="Notifications">
          {!osNotificationsOn && (
            <NavRow
              icon="notifications-off-outline"
              label="Notifications are off"
              description="Turn them on in iPhone Settings so heat alerts and reminders can reach you"
              onPress={() => Linking.openSettings()}
            />
          )}
          <ToggleRow
            icon="warning-outline"
            label="Heat alerts"
            description="Alert when it feels as hot as your profile's threshold"
            value={prefs.heatAlerts}
            onChange={toggleHeatAlerts}
          />
          <ToggleRow
            icon="car-outline"
            label="Hot-day car reminders"
            description="7:30 AM “look before you lock” on days forecast at 95°F or more"
            value={prefs.vehicleReminders}
            onChange={toggleVehicleReminders}
            separator={false}
          />
        </Section>

        <Section title="Safety profile">
          <NavRow icon="person-outline" label="Heat profile" description="Age, conditions, activity level" onPress={() => router.push('/profile/heat-profile')} />
          <NavRow icon="call-outline" label="Emergency contacts" description="Who SOS texts open addressed to" onPress={() => router.push('/emergency/contacts')} separator={false} />
        </Section>

        <Section title="Data & privacy">
          <NavRow
            icon="phone-portrait-outline"
            label="Your data stays on this phone"
            description="No account. Only your approximate location is sent to the weather service."
            onPress={() => openLink(LINKS.privacy)}
          />
          <NavRow icon="trash-outline" label="Clear all data" destructive onPress={handleClearData} separator={false} />
        </Section>

        <Section title="About">
          <NavRow icon="medkit-outline" label="Safety & medical disclaimer" onPress={() => router.push('/disclaimer')} />
          <NavRow icon="shield-checkmark-outline" label="Privacy policy" onPress={() => openLink(LINKS.privacy)} />
          <NavRow icon="document-outline" label="Terms of use" onPress={() => openLink(LINKS.terms)} />
          <NavRow icon="mail-outline" label="Contact support" onPress={() => openLink(LINKS.support)} separator={false} />
        </Section>

        <Text style={styles.versionText}>HeatGuard 1.0.0 · Weather data by Open-Meteo.com</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: C.text },
  section: { marginBottom: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, paddingLeft: 4 },
  sectionCard: { backgroundColor: C.surface, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, minHeight: 56 },
  rowColumn: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  rowHorizontal: { flexDirection: 'row', alignItems: 'center' },
  rowSeparator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  rowIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.primary + '18', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowContent: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 16, color: C.text },
  rowDescription: { fontSize: 12, color: C.textSecondary, marginTop: 2, lineHeight: 16 },
  segmentedControl: { flexDirection: 'row', backgroundColor: C.border, borderRadius: 8, padding: 3, gap: 2 },
  segmentItem: { flex: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center' },
  segmentItemActive: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  segmentLabel: { fontSize: 14, color: C.textSecondary },
  segmentLabelActive: { color: C.text, fontWeight: '600' },
  versionText: { fontSize: 12, color: C.textTertiary, textAlign: 'center', marginTop: 8, marginBottom: 16 },
});
