import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../src/context/SettingsContext';
import PressableScale from '../src/components/ui/PressableScale';
import haptics from '../src/utils/haptics';

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
  const { tempUnit, setTempUnit, appTheme, setAppTheme } = useSettings();
  const [notifHeatAlerts, setNotifHeatAlerts] = useState(true);
  const [notifDailyCheckin, setNotifDailyCheckin] = useState(true);
  const [notifCommunity, setNotifCommunity] = useState(true);
  const [notifVolunteer, setNotifVolunteer] = useState(false);

  const handleClearData = () => {
    haptics.warning();
    Alert.alert('Clear all data?',
      'This will permanently delete your check-in history, exposure records, and community posts.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear everything', style: 'destructive', onPress: async () => {
          try { await AsyncStorage.clear(); haptics.success(); Alert.alert('Done', 'All local data has been cleared.'); }
          catch { haptics.error(); }
        }},
      ]
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

        <Section title="Appearance">
          <SegmentedRow
            icon="contrast-outline" label="Theme"
            options={[{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }, { label: 'Auto', value: 'system' }]}
            value={appTheme} onChange={(v) => setAppTheme(v as 'light' | 'dark' | 'system')}
            separator={false}
          />
        </Section>

        <Section title="Notifications">
          <ToggleRow icon="warning-outline" label="Heat alerts" description="Push notifications when heat index crosses your threshold" value={notifHeatAlerts} onChange={setNotifHeatAlerts} />
          <ToggleRow icon="calendar-outline" label="Daily check-in reminder" description="Morning reminder to log your wellness" value={notifDailyCheckin} onChange={setNotifDailyCheckin} />
          <ToggleRow icon="people-outline" label="Community updates" description="Posts and alerts from your neighbors" value={notifCommunity} onChange={setNotifCommunity} />
          <ToggleRow icon="hand-left-outline" label="Volunteer requests" description="When someone near you needs assistance" value={notifVolunteer} onChange={setNotifVolunteer} separator={false} />
        </Section>

        <Section title="Safety profile">
          <NavRow icon="person-outline" label="Heat profile" description="Age, conditions, activity level" onPress={() => router.push('/profile/heat-profile')} />
          <NavRow icon="call-outline" label="Emergency contacts" description="Who to notify in an SOS event" onPress={() => router.push('/emergency/contacts')} separator={false} />
        </Section>

        <Section title="Data & privacy">
          <NavRow icon="document-text-outline" label="Export my data" description="Download a copy of your records" onPress={() => Alert.alert('Export', 'Data export coming soon.')} />
          <NavRow icon="trash-outline" label="Clear all data" destructive onPress={handleClearData} separator={false} />
        </Section>

        <Section title="About">
          <NavRow icon="information-circle-outline" label="About HeatGuard" onPress={() => Alert.alert('HeatGuard', 'Version 1.0.0 — Built for heat-vulnerable communities.')} />
          <NavRow icon="shield-checkmark-outline" label="Privacy policy" onPress={() => {}} />
          <NavRow icon="document-outline" label="Terms of use" onPress={() => {}} separator={false} />
        </Section>

        <Text style={styles.versionText}>HeatGuard 1.0.0 · com.tarnaka.heatguard</Text>
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
