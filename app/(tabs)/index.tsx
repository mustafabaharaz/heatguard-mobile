import { useSettings } from '../../src/context/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import haptics from '../../src/utils/haptics';
import { SkeletonThermalCard, SkeletonInfoCard, SkeletonPostRow, SkeletonForecastRow } from '../../src/components/ui/Skeleton';
import AnimatedEntrance from '../../src/components/ui/AnimatedEntrance';
import PressableScale from '../../src/components/ui/PressableScale';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert, Linking, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AlertCircle, Thermometer, RefreshCw, MapPin, User, TrendingUp, ShieldAlert, Brain, ChevronRight, Zap, BarChart2 } from 'lucide-react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import EmergencySOSModal from '../../src/components/emergency/EmergencySOSModal';
import { getCurrentWeather, WeatherData } from '../../src/services/api/weatherApi';
import { useLocation } from '../../src/lib/hooks/useLocation';
import { scheduleHeatAlert } from '../../src/services/notifications/push';
import { getHeatProfile, getRiskMultiplier, HeatProfile } from '../../src/features/profile/storage/profileStorage';
import ExposureSessionCard from '../../src/components/exposure/ExposureSessionCard';
import { PassiveTracker } from '../../src/features/exposure/passiveTracker';
import MedicationWarningCard from '../../src/components/medications/MedicationWarningCard';

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
  const { formatTemp } = useSettings();
  const multiplier = getRiskMultiplier(profile);
  const level = getPersonalRiskLevel(temperature, multiplier);
  const advice = getPersonalAdvice(temperature, profile, multiplier);
  const label = getRiskLabel(level);
  const color = getRiskLevelColor(level);

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

      <Text style={styles.wellnessAdvice}>{advice}</Text>

      {riskFactors.length > 0 && (
        <View style={styles.factorsRow}>
          {riskFactors.map(f => (
            <View key={f} style={[styles.factorChip, { borderColor: color }]}>
              <Text style={[styles.factorText, { color }]}>{f}</Text>
            </View>
          ))}
        </View>
      )}

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

// ─── Intelligence Hub Card ────────────────────────────────────────────────────

function IntelligenceHubCard({ temperature }: { temperature: number }) {
  const router = useRouter();
  const { formatTemp } = useSettings();

  const tomorrowLevel = temperature >= 40 ? 'Crisis' : temperature >= 35 ? 'Extreme' : temperature >= 30 ? 'High Alert' : 'Caution';
  const tomorrowColor = temperature >= 40 ? '#7C2D12' : temperature >= 35 ? '#DC2626' : temperature >= 30 ? '#EA580C' : '#D97706';
  const safeWindow = temperature >= 38 ? '6 – 9 AM' : temperature >= 32 ? '6 – 10 AM' : 'All morning';

  return (
    <View style={styles.hubCard}>
      <View style={styles.hubHeader}>
        <View style={styles.hubIconWrap}>
          <Brain size={18} color="#FFFFFF" />
        </View>
        <Text style={styles.hubTitle}>Intelligence</Text>
        <View style={styles.hubBadge}>
          <Text style={styles.hubBadgeText}>Personalised</Text>
        </View>
      </View>

      <View style={styles.hubMetrics}>
        <View style={styles.hubMetric}>
          <Text style={styles.hubMetricLabel}>Tomorrow's Peak</Text>
          <View style={[styles.hubLevelPill, { backgroundColor: tomorrowColor + '22', borderColor: tomorrowColor + '55' }]}>
            <View style={[styles.hubLevelDot, { backgroundColor: tomorrowColor }]} />
            <Text style={[styles.hubLevelText, { color: tomorrowColor }]}>{tomorrowLevel}</Text>
          </View>
        </View>
        <View style={styles.hubDivider} />
        <View style={styles.hubMetric}>
          <Text style={styles.hubMetricLabel}>Best Window</Text>
          <Text style={styles.hubMetricValue}>{safeWindow}</Text>
        </View>
        <View style={styles.hubDivider} />
        <View style={styles.hubMetric}>
          <Text style={styles.hubMetricLabel}>Personalised</Text>
          <Text style={[styles.hubMetricValue, { color: '#2D9B6F' }]}>Active</Text>
        </View>
      </View>

      <View style={styles.hubButtonRow}>
        <TouchableOpacity
          style={styles.hubButton}
          onPress={() => router.push('/intelligence/forecast')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open 5-day heat forecast"
        >
          <Brain size={14} color="#FFFFFF" />
          <Text style={styles.hubButtonText}>5-Day Forecast</Text>
          <ChevronRight size={13} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.hubButton, styles.hubButtonAlt]}
          onPress={() => router.push('/intelligence/activity-planner')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open activity safety planner"
        >
          <Zap size={14} color="#FFFFFF" />
          <Text style={styles.hubButtonText}>Activity Planner</Text>
          <ChevronRight size={13} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.hubButton, styles.hubButtonExposure]}
        onPress={() => router.push('/intelligence/exposure-history')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Open personal exposure history"
      >
        <BarChart2 size={14} color="#FFFFFF" />
        <Text style={styles.hubButtonText}>Exposure History</Text>
        <Text style={styles.hubButtonMeta}>14-day analytics</Text>
        <ChevronRight size={13} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { formatTemp } = useSettings();
  const [refreshing, setRefreshing] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [heatProfile, setHeatProfile] = useState<HeatProfile>(getHeatProfile());
  const lastAlertTemp = useRef<number>(0);

  const { location, error: locationError } = useLocation();

  useFocusEffect(useCallback(() => {
    setHeatProfile(getHeatProfile());
  }, []));

  const fetchWeather = useCallback(async () => {
    if (!location) return;
    try {
      const data = await getCurrentWeather(location.lat, location.lon);
      setWeather(data);
      const temp = data.temperature;
      const tempF = (temp * 9 / 5) + 32;
      if (PassiveTracker.getState().isTracking) {
        await PassiveTracker.updateTemperature(tempF);
      }
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
          <PressableScale onPress={() => router.push("/settings")} accessibilityLabel="Settings" accessibilityRole="button" style={styles.headerAction}>
            <Ionicons name="settings-outline" size={22} color={COLORS.ocean} />
          </PressableScale>
          <View style={styles.locationRow}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.subtitle}>{locationName}</Text>
          </View>
        </View>

        {/* Temperature Card */}
        <View style={[styles.tempCard, { backgroundColor: getRiskColor() }]}>
          <Thermometer size={48} color={COLORS.ocean} strokeWidth={2} />
          <Text style={styles.tempLarge}>{formatTemp(temperature, false)}</Text>
          <Text style={styles.tempSubtext}>Feels like {formatTemp(heatIndex)}</Text>
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

        {/* Predictive Wellness Dashboard */}
        <PredictiveWellnessCard temperature={temperature} profile={heatProfile} />

        {/* Intelligence Hub */}
        <IntelligenceHubCard temperature={temperature} />

        {/* Exposure Tracker */}
        <ExposureSessionCard currentTempF={(temperature * 9 / 5) + 32} />

        {/* Medication Warnings */}
        <MedicationWarningCard tempC={temperature} takesMedications={heatProfile.takesMedications} />

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
  header: { marginBottom: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerAction: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 30, fontWeight: 'bold', color: COLORS.ocean },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  subtitle: { fontSize: 16, color: '#6B7280', marginLeft: 4 },

  tempCard: { borderRadius: 24, padding: 32, marginBottom: 24, alignItems: 'center' },
  tempLarge: { fontSize: 72, fontWeight: 'bold', color: COLORS.ocean, marginTop: 16 },
  tempSubtext: { fontSize: 20, color: COLORS.ocean, opacity: 0.8, marginTop: 8 },
  weatherDesc: { fontSize: 16, color: COLORS.ocean, opacity: 0.7, marginTop: 4, textTransform: 'capitalize' },
  riskBadge: { backgroundColor: 'rgba(29, 53, 87, 0.1)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, marginTop: 24 },
  riskText: { fontSize: 18, fontWeight: '600', color: COLORS.ocean },

  alertCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 24, marginBottom: 16 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  alertTitle: { fontSize: 18, fontWeight: '600', color: COLORS.ocean, marginLeft: 8 },
  alertText: { fontSize: 16, color: '#374151', lineHeight: 24 },

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
  wellnessSetupRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  wellnessSetupText: { flex: 1 },
  wellnessSetupHeadline: { fontSize: 15, fontWeight: '600', color: COLORS.ocean, marginBottom: 4 },
  wellnessSetupSub: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  wellnessSetupBtn: { alignSelf: 'flex-start', backgroundColor: '#EFF6FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  wellnessSetupBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.ocean },

  hubCard: {
    backgroundColor: COLORS.ocean, borderRadius: 16, padding: 18, marginBottom: 16,
    shadowColor: COLORS.ocean, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  hubHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  hubIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  hubTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  hubBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  hubBadgeText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  hubMetrics: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 12 },
  hubMetric: { flex: 1, alignItems: 'center', gap: 6 },
  hubDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 2 },
  hubMetricLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  hubMetricValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  hubLevelPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  hubLevelDot: { width: 6, height: 6, borderRadius: 3 },
  hubLevelText: { fontSize: 11, fontWeight: '700' },
  hubButtonRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  hubButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, gap: 6 },
  hubButtonAlt: { backgroundColor: 'rgba(59,130,246,0.25)' },
  hubButtonExposure: { flex: 0, backgroundColor: 'rgba(255,255,255,0.07)', marginTop: 0 },
  hubButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', flex: 1 },
  hubButtonMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },

  sosButton: { backgroundColor: COLORS.lava, borderRadius: 16, padding: 24, alignItems: 'center', minHeight: 44, marginBottom: 0, marginTop: 16 },
  sosButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  sosButtonSubtext: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 4 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, opacity: 0.6 },
  footerText: { fontSize: 14, color: '#6B7280', marginLeft: 8 },
});
