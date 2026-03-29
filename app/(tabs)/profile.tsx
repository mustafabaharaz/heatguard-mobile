import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Bell, User, Settings, Shield, ChevronRight } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { registerForPushNotifications, scheduleDailyCheck, cancelAllNotifications } from '../../src/services/notifications/push';
import { getContacts } from '../../src/features/emergency/storage/contactStorage';

const COLORS = {
  ocean: '#1D3557',
  glacier: '#8ECAE6',
  lava: '#E63946',
};

export default function ProfileScreen() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [heatAlertsEnabled, setHeatAlertsEnabled] = useState(true);
  const [dailyCheckEnabled, setDailyCheckEnabled] = useState(true);
  const [contactCount, setContactCount] = useState(0);

  useEffect(() => {
    checkNotificationPermission();
    setContactCount(getContacts().length);
  }, []);

  const checkNotificationPermission = async () => {
    const status = await registerForPushNotifications();
    setNotificationsEnabled(status === 'granted');
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const status = await registerForPushNotifications();
      if (status === 'granted') {
        setNotificationsEnabled(true);
        Alert.alert('✓ Enabled', 'Push notifications are now enabled!');
      } else {
        Alert.alert(
          'Permission Denied',
          'Please enable notifications in your device settings to receive heat alerts.'
        );
      }
    } else {
      await cancelAllNotifications();
      setNotificationsEnabled(false);
      Alert.alert('Disabled', 'Push notifications disabled');
    }
  };

  const handleToggleDailyCheck = async (value: boolean) => {
    setDailyCheckEnabled(value);
    if (value) {
      await scheduleDailyCheck(14);
      Alert.alert('✓ Enabled', 'Daily check-in reminder set for 2 PM');
    } else {
      await cancelAllNotifications();
      Alert.alert('Disabled', 'Daily reminders disabled');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <User size={48} color="white" />
          </View>
          <Text style={styles.userName}>Volunteer</Text>
          <Text style={styles.userRole}>Community Helper</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Bell size={20} color={COLORS.ocean} />
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive alerts about heat conditions
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#D1D5DB', true: COLORS.glacier }}
              thumbColor={notificationsEnabled ? COLORS.ocean : '#9CA3AF'}
            />
          </View>

          {notificationsEnabled && (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Heat Alerts</Text>
                  <Text style={styles.settingDescription}>
                    Alert when temperature reaches danger levels (≥35°C)
                  </Text>
                </View>
                <Switch
                  value={heatAlertsEnabled}
                  onValueChange={setHeatAlertsEnabled}
                  trackColor={{ false: '#D1D5DB', true: COLORS.glacier }}
                  thumbColor={heatAlertsEnabled ? COLORS.ocean : '#9CA3AF'}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Daily Check Reminder</Text>
                  <Text style={styles.settingDescription}>
                    Daily reminder at 2 PM to check on residents
                  </Text>
                </View>
                <Switch
                  value={dailyCheckEnabled}
                  onValueChange={handleToggleDailyCheck}
                  trackColor={{ false: '#D1D5DB', true: COLORS.glacier }}
                  thumbColor={dailyCheckEnabled ? COLORS.ocean : '#9CA3AF'}
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield size={20} color={COLORS.ocean} />
            <Text style={styles.sectionTitle}>Safety Settings</Text>
          </View>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/emergency/contacts')}
          >
            <Text style={styles.menuItemText}>Emergency Contacts</Text>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemValue}>{contactCount} {contactCount === 1 ? 'contact' : 'contacts'}</Text>
              <ChevronRight size={20} color="#9CA3AF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Heat Thresholds</Text>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemValue}>Custom</Text>
              <ChevronRight size={20} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Settings size={20} color={COLORS.ocean} />
            <Text style={styles.sectionTitle}>App Information</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Build</Text>
            <Text style={styles.infoValue}>Beta</Text>
          </View>
        </View>

        <View style={styles.aboutContainer}>
          <Text style={styles.aboutTitle}>🛡️ HeatGuard</Text>
          <Text style={styles.aboutText}>
            Lifesaving heat emergency monitoring for vulnerable populations.
            Helping communities stay safe during extreme heat events.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollView: { flex: 1 },
  content: { paddingBottom: 40 },
  header: { backgroundColor: COLORS.ocean, alignItems: 'center', paddingTop: 60, paddingBottom: 32 },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.glacier, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  userName: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  userRole: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  section: { backgroundColor: 'white', marginTop: 16, paddingVertical: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: COLORS.ocean },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  settingInfo: { flex: 1, marginRight: 16 },
  settingLabel: { fontSize: 16, fontWeight: '500', color: COLORS.ocean, marginBottom: 4 },
  settingDescription: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  menuItemText: { fontSize: 16, color: COLORS.ocean },
  menuItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuItemValue: { fontSize: 14, color: '#6B7280' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: { fontSize: 14, color: COLORS.ocean, fontWeight: '500' },
  aboutContainer: { marginTop: 32, paddingHorizontal: 20, alignItems: 'center' },
  aboutTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.ocean, marginBottom: 8 },
  aboutText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
});
