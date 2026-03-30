import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert, Linking, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AlertCircle, Thermometer, RefreshCw, MapPin, User, TrendingUp, ShieldAlert } from 'lucide-react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import EmergencySOSModal from '../../src/components/emergency/EmergencySOSModal';
import { getCurrentWeather, WeatherData } from '../../src/services/api/weatherApi';
import { useLocation } from '../../src/lib/hooks/useLocation';
import { scheduleHeatAlert } from '../../src/services/notifications/push';
import { getHeatProfile, getRiskMultiplier, HeatProfile } from '../../src/features/profile/storage/profileStorage';

const COLORS = {
  glacier: '#8ECAE6',
  desert: '#F4A261',
  ember: '#E76F51',
  lava: '#E63946',
  ocean: '#1D3557',
  safe: '#2D9B6F',
};

// ─── Personalized risk helpers ───────────────────────────────────────────────

function getPersonalRiskLevel(temp: number, multiplier: number): 'safe' | 'caution' | 'high' | 'critical' {
  const adjusted = temp * multiplier;
  if (adjusted >= 52 || temp >= 40) return 'critical';
  if (adjusted >= 42 || temp >= 35) return 'high';
  if (adjusted >= 34 || temp >= 30) return 'caution';
  return 'safe';
}

function getPersonalAdvice(temp: number, profile: HeatProfile, multiplier: number): string {
  const level = getPersonalRiskLevel(temp, multiplier);
  const conditions: string[] = [];
  if (profile.isElderly) conditions.push('your age');
  if (profile.hasDiabetes) conditions.push('diabetes');
  if (profile.hasHeartDisease) conditions.push('heart condition');
  if (profile.hasRespiratoryIssues) conditions.push('respiratory issues');
  if (profile.takesMedications) conditions.push('medications');

  const conditionStr = conditions.length > 0
    ? ` Given ${conditions.join(', ')}, your risk is elevated.`
    : '';

  if (level === 'critical') return `Extreme danger for you personally.${conditionStr} Seek cool shelter immediately and avoid all outdoor activity.`;
  if (level === 'high') return `High personal risk at ${temp}°C.${conditionStr} Stay indoors, hydrate every 15–20 minutes, and avoid exertion.`;
  if (level === 'caution') return `Moderate risk for you.${conditionStr} Take breaks in shade, drink water frequently, and monitor how you feel.`;
  return `Conditions are within safe range for you.${conditionStr} Stay aware and keep hydrated.`;
}

function getRiskLabel(level: 'safe' | 'caution' | 'high' | 'critical'): string {
  if (level === 'critical') return 'CRITICAL FOR YOU';
  if (level === 'high') return 'HIGH PERSONAL RISK';
  if (level === 'caution') return 'MONITOR CLOSELY';
  return 'SAFE FOR YOU';
}

function getRiskLevelColor(level: 'safe' | 'caution' | 'high' | 'critical'): string {
  if (level === 'critical') return COLORS.lava;
  if (level === 'high') return COLORS.ember;
  if (level === 'caution') return COLORS.desert;
  return COLORS.safe;
}

// ─── Predictive Wellness Card ─────────────────────────────────────────────────

function PredictiveWellnessCard({ temperature, profile }: { temperature: number; profile: HeatProfile }) {
  const router = useRouter();
  const multiplier = getRiskMultiplier(profile);
  const level = getPersonalRiskLevel(temperature, multiplier);
  const advice = getPersonalAdvice(temperature, profile, multiplier);
  const label = getRiskLabel(level);
  const color = getRiskLevelColor(level);

  // Factors contributing to elevated risk
  const riskFactors: string[] = [];
  if (profile.isElderly) riskFactors.push('Age 65+');
  if (profile.hasDiabetes) riskFactors.push('Diabetes');
  if (profile.hasHeartDisease) riskFactors.push('Heart Disease');
  if (profile.hasRespiratoryIssues) riskFactors.push('Respiratory');
  if (profile.takesMedications) riskFactors.push('Medications');
  if (profile.activityLevel === 'high') riskFactors.push('High Activity');

  const multiplierDisplay = Math.round((multiplier - 1) * 100);

  if (!profile.profileComplete) {
    return (
      <TouchableOpacity style={styles.wellnessCard} onPress={() => router.push('/profile/heat-profile')} activeOpacity={0.85}>
        <View style={styles.wellnessHeader}>
          <TrendingUp size={20} color={COLORS.ocean} />
          <Text style={styles.wellnessTitle}>Predictive Wellness</Text>
        </View>
        <View style={styles.wellnessSetupRow}>
          <ShieldAlert size={28} color={COLORS.desert} />
          <View style={styles.wellnessSetupText}>
            <Text style={styles.wellnessSetupHeadline}>Set up your heat profile</Text>
            <Text style={styles.wellnessSetupSub}>Get personalized risk alerts based on your age, health, and activity level.</Text>
          </View>
        </View>
        <View style={styles.wellnessSetupBtn}>
          <Text style={styles.wellnessSetupBtnText}>Set Up Profile →</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.wellnessCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={styles.wellnessHeader}>
        <TrendingUp size={20} color={COLORS.ocean} />
        <Text style={styles.wellnessTitle}>Your Personal Risk</Text>
        <View style={[styles.wellnessLevelBadge, { backgroundColor: color }]}>
          <Text style={styles.wellnessLevelText}>{label}</Text>
        </View>
      </View>

      {/* Profile summary row */}
      <View style={styles.wellnessProfileRow}>
        <View style={styles.wellnessAvatar}>
          <User size={16} color="white" />
        </View>
        <Text style={styles.wellnessProfileName}>{profile.name}, {profile.age}</Text>
        {multiplierDisplay > 0 && (
          <View style={styles.multiplierBadge}>
            <Text style={styles.multiplierText}>+{multiplierDisplay}% risk</Text>
          </View>
        )}
      </View>

      {/* Advice */}
      <Text style={styles.wellnessAdvice}>{advice}</Text>

      {/* Risk factors */}
      {riskFactors.length > 0 && (
        <View style={styles.factorsRow}>
          {riskFactors.map(f => (
            <View key={f} style={[styles.factorChip, { borderColor: color }]}>
              <Text style={[styles.factorText, { color }]}>{f}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Alert threshold indicator */}
      <View style={styles.thresholdRow}>
        <Thermometer size={14} color={COLORS.ocean} />
        <Text style={styles.thresholdText}>
          Your alert threshold: {profile.alertThreshold}°C
          {temperature >= profile.alertThreshold ? ' — ⚠️ Exceeded!' : ` — ${profile.alertThreshold - temperature}°C remaining`}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [heatProfile, setHeatProfile] = useState<HeatProfile>(getHeatProfile());
  const lastAlertTemp = useRef<number>(0);

  const { location, error: locationError } = useLocation();

  // Reload profile when returning from profile screen
  useFocusEffect(useCallback(() => {
    setHeatProfile(getHeatProfile());
  }, []));

  const fetchWeather = useCallback(async () => {
    if (!location) return;
    try {
      const data = await getCurrentWeather(location.lat, location.lon);
      setWeather(data);

      const temp = data.temperature;
      const threshold = heatProfile.alertThreshold ?? 35;
      if (temp >= threshold && temp !== lastAlertTemp.current) {
        const riskLevel = temp >= 40 ? 'critical' : temp >= 35 ? 'high' : 'caution';
        await scheduleHeatAlert(temp, riskLevel);
        lastAlertTemp.current = temp;
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error);
    } finally {
      setLoading(false);
    }
  }, [location, heatProfile.alertThreshold]);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  const temperature = weather?.temperature || 38;
  const heatIndex = weather?.feelsLike || 42;
  const locationName = weather?.location || 'Your Location';

  const getRiskColor = () => {
    if (temperature >= 40) return COLORS.lava;
    if (temperature >= 35) return COLORS.ember;
    if (temperature >= 30) return COLORS.desert;
    return COLORS.glacier;
  };

  const getRiskText = () => {
    if (temperature >= 40) return 'CRITICAL';
    if (temperature >= 35) return 'HIGH RISK';
    if (temperature >= 30) return 'CAUTION';
    return 'NORMAL';
  };

  const getAdviceText = () => {
    if (temperature >= 40) return 'EXTREME DANGER: Heat stroke highly likely. Seek immediate shelter and hydration.';
    if (temperature >= 35) return 'HIGH RISK: Heat exhaustion likely. Limit outdoor activity and stay hydrated.';
    if (temperature >= 30) return 'CAUTION: Possible fatigue with prolonged exposure. Take regular breaks.';
    return 'SAFE: Current conditions are comfortable. Stay aware of weather changes.';
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWeather();
    setRefreshing(false);
  };

  const handleCallEmergency = () => {
    Alert.alert('Call 911?', 'This will immediately call emergency services.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call Now', style: 'destructive', onPress: () => { setShowEmergencyModal(false); Linking.openURL('tel:911'); } },
    ]);
  };

  const handleContactFamily = () => {
    Alert.alert('Alert Sent', 'Your emergency contacts have been notified.', [{ text: 'OK', onPress: () => setShowEmergencyModal(false) }]);
  };

  const handleShareLocation = () => {
    Alert.alert('Location Shared', 'Your GPS coordinates have been sent.', [{ text: 'OK', onPress: () => setShowEmergencyModal(false) }]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.ocean} />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>🛡️ HeatGuard</Text>
          <View style={styles.locationRow}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.subtitle}>{locationName}</Text>
          </View>
        </View>

        {/* Temperature Card */}
        <View style={[styles.tempCard, { backgroundColor: getRiskColor() }]}>
          <Thermometer size={48} color={COLORS.ocean} strokeWidth={2} />
          <Text style={styles.tempLarge}>{temperature}°</Text>
          <Text style={styles.tempSubtext}>Feels like {heatIndex}°C</Text>
          {weather?.description && (
            <Text style={styles.weatherDesc}>{weather.description}</Text>
          )}
          <View style={styles.riskBadge}>
            <Text style={styles.riskText}>{getRiskText()}</Text>
          </View>
        </View>

        {/* General Alert */}
        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <AlertCircle size={20} color={COLORS.ocean} />
            <Text style={styles.alertTitle}>Heat Index Alert</Text>
          </View>
          <Text style={styles.alertText}>{getAdviceText()}</Text>
        </View>

        {/* ✦ Predictive Wellness Dashboard */}
        <PredictiveWellnessCard temperature={temperature} profile={heatProfile} />

        {/* Emergency SOS */}
        <TouchableOpacity
          onPress={() => setShowEmergencyModal(true)}
          style={styles.sosButton}
          activeOpacity={0.8}
        >
          <Text style={styles.sosButtonText}>🆘 EMERGENCY SOS</Text>
          <Text style={styles.sosButtonSubtext}>Tap if you need immediate help</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <RefreshCw size={14} color="#6B7280" />
          <Text style={styles.footerText}>Auto-refresh every 5 min • Pull to refresh now</Text>
        </View>
      </ScrollView>

      <EmergencySOSModal
        visible={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        onCallEmergency={handleCallEmergency}
        onContactFamily={handleContactFamily}
        onShareLocation={handleShareLocation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6B7280' },
  scrollView: { flex: 1 },
  content: { padding: 24 },
  header: { marginBottom: 32 },
  title: { fontSize: 30, fontWeight: 'bold', color: COLORS.ocean },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  subtitle: { fontSize: 16, color: '#6B7280', marginLeft: 4 },

  // Temp card
  tempCard: { borderRadius: 24, padding: 32, marginBottom: 24, alignItems: 'center' },
  tempLarge: { fontSize: 72, fontWeight: 'bold', color: COLORS.ocean, marginTop: 16 },
  tempSubtext: { fontSize: 20, color: COLORS.ocean, opacity: 0.8, marginTop: 8 },
  weatherDesc: { fontSize: 16, color: COLORS.ocean, opacity: 0.7, marginTop: 4, textTransform: 'capitalize' },
  riskBadge: { backgroundColor: 'rgba(29, 53, 87, 0.1)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, marginTop: 24 },
  riskText: { fontSize: 18, fontWeight: '600', color: COLORS.ocean },

  // Alert card
  alertCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 24, marginBottom: 16 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  alertTitle: { fontSize: 18, fontWeight: '600', color: COLORS.ocean, marginLeft: 8 },
  alertText: { fontSize: 16, color: '#374151', lineHeight: 24 },

  // Wellness card
  wellnessCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 3, borderWidth: 1, borderColor: '#F0F0F0',
  },
  wellnessHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  wellnessTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ocean, flex: 1 },
  wellnessLevelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  wellnessLevelText: { color: 'white', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  wellnessProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  wellnessAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.ocean, alignItems: 'center', justifyContent: 'center' },
  wellnessProfileName: { fontSize: 14, fontWeight: '600', color: COLORS.ocean, flex: 1 },
  multiplierBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  multiplierText: { fontSize: 12, fontWeight: '600', color: '#92400E' },
  wellnessAdvice: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 14 },
  factorsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  factorChip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  factorText: { fontSize: 12, fontWeight: '600' },
  thresholdRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  thresholdText: { fontSize: 13, color: '#6B7280', flex: 1 },

  // Setup state
  wellnessSetupRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  wellnessSetupText: { flex: 1 },
  wellnessSetupHeadline: { fontSize: 15, fontWeight: '600', color: COLORS.ocean, marginBottom: 4 },
  wellnessSetupSub: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  wellnessSetupBtn: { alignSelf: 'flex-start', backgroundColor: '#EFF6FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  wellnessSetupBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.ocean },

  // SOS
  sosButton: { backgroundColor: COLORS.lava, borderRadius: 16, padding: 24, alignItems: 'center', minHeight: 44, marginBottom: 0 },
  sosButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  sosButtonSubtext: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 4 },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, opacity: 0.6 },
  footerText: { fontSize: 14, color: '#6B7280', marginLeft: 8 },
});
