import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Bell, User, Settings, Shield, ChevronRight, Heart } from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { registerForPushNotifications, scheduleDailyCheck, cancelAllNotifications } from '../../src/services/notifications/push';
import { getContacts } from '../../src/features/emergency/storage/contactStorage';
import { getHeatProfile } from '../../src/features/profile/storage/profileStorage';

const COLORS = {
  ocean: '#1D3557', glacier: '#8ECAE6', lava: '#E63946',
  safe: '#2D9B6F', bg: '#F9FAFB', border: '#E5E7EB', muted: '#6B7280',
};

export default function ProfileScreen() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [heatAlertsEnabled, setHeatAlertsEnabled] = useState(true);
  const [dailyCheckEnabled, setDailyCheckEnabled] = useState(true);
  const [contactCount, setContactCount] = useState(0);
  const [heatProfile, setHeatProfile] = useState(getHeatProfile());

  useEffect(() => {
    checkNotificationPermission();
    setContactCount(getContacts().length);
  }, []);

  useFocusEffect(useCallback(() => {
    setHeatProfile(getHeatProfile());
  }, []));

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
        Alert.alert('Permission Denied', 'Please enable notifications in your device settings.');
      }
    } else {
      await cancelAllNotifications();
      setNotificationsEnabled(false);
    }
  };

  const handleToggleDailyCheck = async (value: boolean) => {
    setDailyCheckEnabled(value);
    if (value) { await scheduleDailyCheck(14); }
    else { await cancelAllNotifications(); }
  };

  const profileName = heatProfile.profileComplete ? heatProfile.name : 'Volunteer';
  const profileSub = heatProfile.profileComplete
    ? `Age ${heatProfile.age} · Alert at ${heatProfile.alertThreshold}°C`
    : 'Set up your heat profile';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <User size={48} color="white" />
          </View>
          <Text style={styles.userName}>{profileName}</Text>
          <Text style={styles.userRole}>{profileSub}</Text>
          {heatProfile.profileComplete && (
            <View style={styles.profileBadge}>
              <Text style={styles.profileBadgeText}>✓ Profile Complete</Text>
            </View>
          )}
        </View>

        {/* Heat Profile Card */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Heart size={20} color={COLORS.ocean} />
            <Text style={styles.sectionTitle}>Heat Profile</Text>
          </View>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/heat-profile')}>
            <View style={styles.menuItemLeft}>
              <Text style={styles.menuItemText}>Personal Heat Profile</Text>
              <Text style={styles.menuItemSub}>
                {heatProfile.profileComplete
                  ? `Activity: ${heatProfile.activityLevel} · ${heatProfile.alertThreshold}°C alert`
                  : 'Personalize your heat risk alerts'}
              </Text>
            </View>
            <View style={styles.menuItemRight}>
              {!heatProfile.profileComplete && (
                <View style={styles.setupBadge}>
                  <Text style={styles.setupBadgeText}>Set Up</Text>
                </View>
              )}
              <ChevronRight size={20} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Bell size={20} color={COLORS.ocean} />
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDescription}>Receive alerts about heat conditions</Text>
            </View>
            <Switch value={notificationsEnabled} onValueChange={handleToggleNotifications} trackColor={{ false: '#D1D5DB', true: COLORS.glacier }} thumbColor={notificationsEnabled ? COLORS.ocean : '#9CA3AF'} />
          </View>
          {notificationsEnabled && (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Heat Alerts</Text>
                  <Text style={styles.settingDescription}>Alert when temperature reaches danger levels (≥{heatProfile.alertThreshold}°C)</Text>
                </View>
                <Switch value={heatAlertsEnabled} onValueChange={setHeatAlertsEnabled} trackColor={{ false: '#D1D5DB', true: COLORS.glacier }} thumbColor={heatAlertsEnabled ? COLORS.ocean : '#9CA3AF'} />
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Daily Check Reminder</Text>
                  <Text style={styles.settingDescription}>Daily reminder at 2 PM to check on residents</Text>
                </View>
                <Switch value={dailyCheckEnabled} onValueChange={handleToggleDailyCheck} trackColor={{ false: '#D1D5DB', true: COLORS.glacier }} thumbColor={dailyCheckEnabled ? COLORS.ocean : '#9CA3AF'} />
              </View>
            </>
          )}
        </View>

        {/* Safety */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield size={20} color={COLORS.ocean} />
            <Text style={styles.sectionTitle}>Safety Settings</Text>
          </View>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/emergency/contacts')}>
            <Text style={styles.menuItemText}>Emergency Contacts</Text>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemValue}>{contactCount} {contactCount === 1 ? 'contact' : 'contacts'}</Text>
              <ChevronRight size={20} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Settings size={20} color={COLORS.ocean} />
            <Text style={styles.sectionTitle}>App Information</Text>
          </View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Version</Text><Text style={styles.infoValue}>1.0.0</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Build</Text><Text style={styles.infoValue}>Beta</Text></View>
        </View>

        <View style={styles.aboutContainer}>
          <Text style={styles.aboutTitle}>🛡️ HeatGuard</Text>
          <Text style={styles.aboutText}>Lifesaving heat emergency monitoring for vulnerable populations.</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scrollView: { flex: 1 },
  content: { paddingBottom: 40 },
  header: { backgroundColor: COLORS.ocean, alignItems: 'center', paddingTop: 60, paddingBottom: 32 },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.glacier, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  userName: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  userRole: { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  profileBadge: { marginTop: 10, backgroundColor: COLORS.safe, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  profileBadgeText: { color: 'white', fontSize: 13, fontWeight: '600' },
  section: { backgroundColor: 'white', marginTop: 16, paddingVertical: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: COLORS.ocean },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  settingInfo: { flex: 1, marginRight: 16 },
  settingLabel: { fontSize: 16, fontWeight: '500', color: COLORS.ocean, marginBottom: 4 },
  settingDescription: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  menuItemLeft: { flex: 1, marginRight: 12 },
  menuItemText: { fontSize: 16, color: COLORS.ocean, fontWeight: '500' },
  menuItemSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  menuItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuItemValue: { fontSize: 14, color: '#6B7280' },
  setupBadge: { backgroundColor: COLORS.lava, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  setupBadgeText: { color: 'white', fontSize: 12, fontWeight: '600' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: { fontSize: 14, color: COLORS.ocean, fontWeight: '500' },
  aboutContainer: { marginTop: 32, paddingHorizontal: 20, alignItems: 'center' },
  aboutTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.ocean, marginBottom: 8 },
  aboutText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
});
