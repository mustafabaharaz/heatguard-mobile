import haptics from '../../src/utils/haptics';
import PressableScale from '../../src/components/ui/PressableScale';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, Switch, Alert, Platform,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { User, Activity, Thermometer, Pill, ChevronLeft, Check } from 'lucide-react-native';
import {
  getHeatProfile, saveHeatProfile, HeatProfile, ActivityLevel,
} from '../../src/features/profile/storage/profileStorage';

const COLORS = {
  ocean: '#1D3557', glacier: '#8ECAE6', lava: '#E63946',
  ember: '#F4A261', safe: '#2D9B6F', bg: '#F9FAFB',
  card: '#FFFFFF', border: '#E5E7EB', muted: '#6B7280', text: '#111827',
};

const CONDITIONS = [
  { key: 'hasDiabetes' as const, label: 'Diabetes' },
  { key: 'hasHeartDisease' as const, label: 'Heart Disease' },
  { key: 'hasRespiratoryIssues' as const, label: 'Respiratory Issues' },
  { key: 'isElderly' as const, label: 'Age 65+' },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'low', label: 'Low', desc: 'Mostly indoors' },
  { value: 'medium', label: 'Medium', desc: 'Mix of both' },
  { value: 'high', label: 'High', desc: 'Mostly outdoors' },
];

const MIN = 28, MAX = 42;

export default function HeatProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<HeatProfile>(getHeatProfile());
  const [saved, setSaved] = useState(false);

  const update = (key: keyof HeatProfile, value: any) => {
    setProfile(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    if (!profile.name.trim()) { Alert.alert('Required', 'Please enter your name.'); return; }
    if (!profile.age.trim() || isNaN(Number(profile.age))) { Alert.alert('Required', 'Please enter a valid age.'); return; }
    saveHeatProfile({ ...profile, profileComplete: true });
    setSaved(true);
    Alert.alert('✓ Profile Saved', 'Alerts will now be personalized for you.', [{ text: 'OK', onPress: () => router.back() }]);
  };

  const adjustThreshold = (delta: number) => {
    update('alertThreshold', Math.min(MAX, Math.max(MIN, profile.alertThreshold + delta)));
  };

  const thresholdColor = profile.alertThreshold <= 31 ? COLORS.safe : profile.alertThreshold <= 35 ? COLORS.ember : COLORS.lava;
  const thresholdPct = ((profile.alertThreshold - MIN) / (MAX - MIN)) * 100;

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} accessibilityLabel="Go back">
          <ChevronLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Heat Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.introBanner}>
          <Text style={s.introText}>
            Your profile personalizes heat risk alerts based on your health. All data stays on your device.
          </Text>
        </View>

        {/* Personal Info */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <User size={18} color={COLORS.ocean} />
            <Text style={s.sectionTitle}>Personal Info</Text>
          </View>
          <View style={s.field}>
            <Text style={s.label}>Full Name</Text>
            <TextInput
              style={s.input}
              value={profile.name}
              onChangeText={v => update('name', v)}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.muted}
              accessibilityLabel="Full name"
            />
          </View>
          <View style={[s.field, { borderBottomWidth: 0 }]}>
            <Text style={s.label}>Age</Text>
            <TextInput
              style={[s.input, s.inputShort]}
              value={profile.age}
              onChangeText={v => update('age', v.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 45"
              placeholderTextColor={COLORS.muted}
              keyboardType="number-pad"
              maxLength={3}
              accessibilityLabel="Age"
            />
          </View>
        </View>

        {/* Activity Level */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Activity size={18} color={COLORS.ocean} />
            <Text style={s.sectionTitle}>Outdoor Activity Level</Text>
          </View>
          <View style={s.activityRow}>
            {ACTIVITY_LEVELS.map(({ value, label, desc }) => {
              const active = profile.activityLevel === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[s.activityBtn, active && s.activityBtnActive]}
                  onPress={() => update('activityLevel', value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`${label}: ${desc}`}
                >
                  <Text style={[s.activityLabel, active && s.activityLabelActive]}>{label}</Text>
                  <Text style={[s.activityDesc, active && s.activityDescActive]}>{desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Alert Threshold */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Thermometer size={18} color={COLORS.ocean} />
            <Text style={s.sectionTitle}>Alert Temperature Threshold</Text>
          </View>
          <Text style={s.fieldHint}>Alert me when temperature exceeds:</Text>
          <View style={s.thresholdRow}>
            <TouchableOpacity
              style={s.thresholdBtn}
              onPress={() => adjustThreshold(-1)}
              accessibilityLabel="Decrease threshold"
              disabled={profile.alertThreshold <= MIN}
            >
              <Text style={[s.thresholdBtnText, profile.alertThreshold <= MIN && s.btnDisabled]}>−</Text>
            </TouchableOpacity>
            <Text style={[s.thresholdValue, { color: thresholdColor }]}>{profile.alertThreshold}°C</Text>
            <TouchableOpacity
              style={s.thresholdBtn}
              onPress={() => adjustThreshold(1)}
              accessibilityLabel="Increase threshold"
              disabled={profile.alertThreshold >= MAX}
            >
              <Text style={[s.thresholdBtnText, profile.alertThreshold >= MAX && s.btnDisabled]}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={s.trackWrap}>
            <View style={s.track}>
              <View style={[s.trackFill, { width: `${thresholdPct}%` as any, backgroundColor: thresholdColor }]} />
              <View style={[s.trackThumb, { left: `${thresholdPct}%` as any, backgroundColor: thresholdColor }]} />
            </View>
            <View style={s.trackLabels}>
              <Text style={s.trackLabel}>{MIN}°C</Text>
              <Text style={s.trackLabel}>{MAX}°C</Text>
            </View>
          </View>
        </View>

        {/* Health Conditions */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Pill size={18} color={COLORS.ocean} />
            <Text style={s.sectionTitle}>Health Conditions</Text>
          </View>
          <Text style={s.fieldHint}>Select all that apply — used to personalize risk alerts</Text>
          {CONDITIONS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={s.conditionRow}
              onPress={() => update(key, !profile[key])}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: profile[key] as boolean }}
              accessibilityLabel={label}
            >
              <View style={[s.checkbox, profile[key] && s.checkboxActive]}>
                {profile[key] && <Check size={14} color="white" strokeWidth={3} />}
              </View>
              <Text style={s.conditionLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
          <View style={[s.settingRow, { marginTop: 8 }]}>
            <View style={s.settingInfo}>
              <Text style={s.settingLabel}>Heat-Sensitive Medications</Text>
              <Text style={s.settingDesc}>Diuretics, beta-blockers, antihistamines, etc.</Text>
            </View>
            <Switch
              value={profile.takesMedications}
              onValueChange={v => update('takesMedications', v)}
              trackColor={{ false: COLORS.border, true: COLORS.glacier }}
              thumbColor={profile.takesMedications ? COLORS.ocean : '#9CA3AF'}
              accessibilityLabel="Takes heat-sensitive medications"
            />
          </View>
          {profile.takesMedications && (
            <TouchableOpacity
              onPress={() => router.push('/profile/medications')}
              accessibilityRole="button"
              style={{ paddingVertical: 10, paddingHorizontal: 4 }}
            >
              <Text style={{ color: COLORS.ocean, fontSize: 13, fontWeight: '600' }}>
                Configure medication warnings →
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[s.saveBtn, saved && s.saveBtnSaved]}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save heat profile"
        >
          {saved
            ? <><Check size={20} color="white" strokeWidth={3} /><Text style={s.saveBtnText}> Saved!</Text></>
            : <Text style={s.saveBtnText}>Save Profile</Text>
          }
        </TouchableOpacity>
        <Text style={s.privacyNote}>🔒 Stored locally on your device. Never shared.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: COLORS.ocean, paddingTop: Platform.OS === 'ios' ? 56 : 48, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: 'white' },
  scroll: { flex: 1 },
  content: { paddingBottom: 48 },
  introBanner: { backgroundColor: '#EFF6FF', margin: 16, padding: 14, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: COLORS.glacier },
  introText: { fontSize: 14, color: COLORS.ocean, lineHeight: 20 },
  section: { backgroundColor: COLORS.card, marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.ocean },
  field: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  label: { fontSize: 13, fontWeight: '500', color: COLORS.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { fontSize: 16, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.bg },
  inputShort: { width: 100 },
  fieldHint: { fontSize: 13, color: COLORS.muted, marginBottom: 16, lineHeight: 18 },
  activityRow: { flexDirection: 'row', gap: 10, paddingBottom: 8 },
  activityBtn: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border, paddingVertical: 12, alignItems: 'center', backgroundColor: COLORS.bg },
  activityBtnActive: { borderColor: COLORS.ocean, backgroundColor: '#EFF6FF' },
  activityLabel: { fontSize: 15, fontWeight: '600', color: COLORS.muted },
  activityLabelActive: { color: COLORS.ocean },
  activityDesc: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  activityDescActive: { color: COLORS.ocean },
  thresholdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 20 },
  thresholdBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  thresholdBtnText: { fontSize: 28, fontWeight: '300', color: COLORS.ocean, lineHeight: 32 },
  btnDisabled: { color: COLORS.border },
  thresholdValue: { fontSize: 40, fontWeight: '700', minWidth: 110, textAlign: 'center' },
  trackWrap: { paddingHorizontal: 8, marginBottom: 8 },
  track: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, position: 'relative', overflow: 'visible', marginBottom: 6 },
  trackFill: { position: 'absolute', left: 0, top: 0, height: 6, borderRadius: 3 },
  trackThumb: { position: 'absolute', top: -5, width: 16, height: 16, borderRadius: 8, marginLeft: -8, borderWidth: 2, borderColor: 'white', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  trackLabel: { fontSize: 12, color: COLORS.muted },
  conditionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 14 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  checkboxActive: { backgroundColor: COLORS.ocean, borderColor: COLORS.ocean },
  conditionLabel: { fontSize: 16, color: COLORS.text },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  settingInfo: { flex: 1, marginRight: 16 },
  settingLabel: { fontSize: 16, fontWeight: '500', color: COLORS.text, marginBottom: 2 },
  settingDesc: { fontSize: 13, color: COLORS.muted, lineHeight: 18 },
  saveBtn: { margin: 20, backgroundColor: COLORS.ocean, borderRadius: 14, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  saveBtnSaved: { backgroundColor: COLORS.safe },
  saveBtnText: { fontSize: 17, fontWeight: '700', color: 'white' },
  privacyNote: { textAlign: 'center', fontSize: 13, color: COLORS.muted },
});
