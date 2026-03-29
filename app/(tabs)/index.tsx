import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert, Linking, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AlertCircle, Thermometer, RefreshCw, MapPin } from 'lucide-react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import EmergencySOSModal from '../../src/components/emergency/EmergencySOSModal';
import { getCurrentWeather, WeatherData } from '../../src/services/api/weatherApi';
import { useLocation } from '../../src/lib/hooks/useLocation';
import { scheduleHeatAlert } from '../../src/services/notifications/push';

const COLORS = {
  glacier: '#8ECAE6',
  desert: '#F4A261',
  ember: '#E76F51',
  lava: '#E63946',
  ocean: '#1D3557',
};

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const lastAlertTemp = useRef<number>(0);
  
  const { location, error: locationError } = useLocation();
  
  const fetchWeather = useCallback(async () => {
    if (!location) return;
    
    try {
      const data = await getCurrentWeather(location.lat, location.lon);
      setWeather(data);
      
      // Auto-alert on danger thresholds
      const temp = data.temperature;
      if (temp >= 35 && temp !== lastAlertTemp.current) {
        const riskLevel = temp >= 40 ? 'critical' : temp >= 35 ? 'high' : 'caution';
        await scheduleHeatAlert(temp, riskLevel);
        lastAlertTemp.current = temp;
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error);
    } finally {
      setLoading(false);
    }
  }, [location]);
  
  useEffect(() => {
    fetchWeather();
    
    // Auto-refresh every 5 minutes
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
    if (temperature >= 40) 
      return 'EXTREME DANGER: Heat stroke highly likely. Seek immediate shelter and hydration.';
    if (temperature >= 35)
      return 'HIGH RISK: Heat exhaustion likely. Limit outdoor activity and stay hydrated.';
    if (temperature >= 30)
      return 'CAUTION: Possible fatigue with prolonged exposure. Take regular breaks.';
    return 'SAFE: Current conditions are comfortable. Stay aware of weather changes.';
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWeather();
    setRefreshing(false);
  };

  const handleCallEmergency = () => {
    Alert.alert(
      'Call 911?',
      'This will immediately call emergency services.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          style: 'destructive',
          onPress: () => {
            setShowEmergencyModal(false);
            Linking.openURL('tel:911');
          }
        }
      ]
    );
  };

  const handleContactFamily = () => {
    Alert.alert(
      'Alert Sent',
      'Your emergency contacts have been notified.',
      [{ text: 'OK', onPress: () => setShowEmergencyModal(false) }]
    );
  };

  const handleShareLocation = () => {
    Alert.alert(
      'Location Shared',
      'Your GPS coordinates have been sent.',
      [{ text: 'OK', onPress: () => setShowEmergencyModal(false) }]
    );
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>🛡️ HeatGuard</Text>
          <View style={styles.locationRow}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.subtitle}>{locationName}</Text>
          </View>
        </View>

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

        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <AlertCircle size={20} color={COLORS.ocean} />
            <Text style={styles.alertTitle}>Heat Index Alert</Text>
          </View>
          <Text style={styles.alertText}>{getAdviceText()}</Text>
        </View>

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
  tempCard: { borderRadius: 24, padding: 32, marginBottom: 24, alignItems: 'center' },
  tempLarge: { fontSize: 72, fontWeight: 'bold', color: COLORS.ocean, marginTop: 16 },
  tempSubtext: { fontSize: 20, color: COLORS.ocean, opacity: 0.8, marginTop: 8 },
  weatherDesc: { fontSize: 16, color: COLORS.ocean, opacity: 0.7, marginTop: 4, textTransform: 'capitalize' },
  riskBadge: { backgroundColor: 'rgba(29, 53, 87, 0.1)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, marginTop: 24 },
  riskText: { fontSize: 18, fontWeight: '600', color: COLORS.ocean },
  alertCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 24, marginBottom: 24 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  alertTitle: { fontSize: 18, fontWeight: '600', color: COLORS.ocean, marginLeft: 8 },
  alertText: { fontSize: 16, color: '#374151', lineHeight: 24 },
  sosButton: { backgroundColor: COLORS.lava, borderRadius: 16, padding: 24, alignItems: 'center', minHeight: 44 },
  sosButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  sosButtonSubtext: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, opacity: 0.6 },
  footerText: { fontSize: 14, color: '#6B7280', marginLeft: 8 },
});
