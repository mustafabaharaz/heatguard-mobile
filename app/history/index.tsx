import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { TrendingUp, TrendingDown, AlertCircle, Sun, Moon } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import TemperatureChart from '../../src/components/charts/TemperatureChart';
import { generateHistoricalData, getHottestTime, getCoolestTime, TemperatureReading } from '../../src/services/api/historicalWeather';

const COLORS = {
  glacier: '#8ECAE6',
  desert: '#F4A261',
  ember: '#E76F51',
  lava: '#E63946',
  ocean: '#1D3557',
};

export default function HeatHistoryScreen() {
  const router = useRouter();
  const [data, setData] = useState<TemperatureReading[]>([]);
  const [hottestTime, setHottestTime] = useState<{ time: Date; temp: number } | null>(null);
  const [coolestTime, setCoolestTime] = useState<{ time: Date; temp: number } | null>(null);

  useEffect(() => {
    const historicalData = generateHistoricalData();
    setData(historicalData);
    setHottestTime(getHottestTime(historicalData));
    setCoolestTime(getCoolestTime(historicalData));
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getRiskHours = (level: string) => {
    return data.filter(r => r.riskLevel === level).length;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>24-Hour Heat Trends</Text>
        <Text style={styles.subtitle}>Temperature & Risk Analysis</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Temperature Timeline</Text>
          <Text style={styles.chartSubtitle}>Last 24 hours</Text>
          <TemperatureChart data={data} />
        </View>

        {/* Insights */}
        <View style={styles.insightsGrid}>
          {/* Hottest Time */}
          {hottestTime && (
            <View style={[styles.insightCard, { borderLeftColor: COLORS.lava }]}>
              <View style={styles.insightHeader}>
                <Sun size={24} color={COLORS.lava} />
                <Text style={styles.insightLabel}>Hottest</Text>
              </View>
              <Text style={styles.insightValue}>{hottestTime.temp}°C</Text>
              <Text style={styles.insightTime}>{formatTime(hottestTime.time)}</Text>
            </View>
          )}

          {/* Coolest Time */}
          {coolestTime && (
            <View style={[styles.insightCard, { borderLeftColor: COLORS.glacier }]}>
              <View style={styles.insightHeader}>
                <Moon size={24} color={COLORS.glacier} />
                <Text style={styles.insightLabel}>Coolest</Text>
              </View>
              <Text style={styles.insightValue}>{coolestTime.temp}°C</Text>
              <Text style={styles.insightTime}>{formatTime(coolestTime.time)}</Text>
            </View>
          )}
        </View>

        {/* Risk Breakdown */}
        <View style={styles.riskCard}>
          <View style={styles.riskHeader}>
            <AlertCircle size={20} color={COLORS.ocean} />
            <Text style={styles.riskTitle}>Risk Level Breakdown</Text>
          </View>

          <View style={styles.riskBreakdown}>
            <View style={styles.riskRow}>
              <View style={styles.riskLabelRow}>
                <View style={[styles.riskDot, { backgroundColor: COLORS.lava }]} />
                <Text style={styles.riskLabel}>Critical (≥40°C)</Text>
              </View>
              <Text style={styles.riskHours}>{getRiskHours('critical')}h</Text>
            </View>

            <View style={styles.riskRow}>
              <View style={styles.riskLabelRow}>
                <View style={[styles.riskDot, { backgroundColor: COLORS.ember }]} />
                <Text style={styles.riskLabel}>High Risk (35-39°C)</Text>
              </View>
              <Text style={styles.riskHours}>{getRiskHours('high')}h</Text>
            </View>

            <View style={styles.riskRow}>
              <View style={styles.riskLabelRow}>
                <View style={[styles.riskDot, { backgroundColor: COLORS.desert }]} />
                <Text style={styles.riskLabel}>Caution (30-34°C)</Text>
              </View>
              <Text style={styles.riskHours}>{getRiskHours('caution')}h</Text>
            </View>

            <View style={styles.riskRow}>
              <View style={styles.riskLabelRow}>
                <View style={[styles.riskDot, { backgroundColor: COLORS.glacier }]} />
                <Text style={styles.riskLabel}>Safe (&lt;30°C)</Text>
              </View>
              <Text style={styles.riskHours}>{getRiskHours('safe')}h</Text>
            </View>
          </View>
        </View>

        {/* Recommendations */}
        <View style={styles.recommendationsCard}>
          <Text style={styles.recommendationsTitle}>📋 Planning Recommendations</Text>
          
          {hottestTime && (
            <View style={styles.recommendation}>
              <Text style={styles.recommendationText}>
                • Avoid outdoor activities between {formatTime(new Date(hottestTime.time.getTime() - 60 * 60 * 1000))} - {formatTime(new Date(hottestTime.time.getTime() + 60 * 60 * 1000))}
              </Text>
            </View>
          )}

          {coolestTime && (
            <View style={styles.recommendation}>
              <Text style={styles.recommendationText}>
                • Best time for outdoor activities: around {formatTime(coolestTime.time)}
              </Text>
            </View>
          )}

          {getRiskHours('critical') > 0 && (
            <View style={styles.recommendation}>
              <Text style={styles.recommendationText}>
                • Critical heat expected for {getRiskHours('critical')} hours - stay indoors
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: 'white', paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 16, color: COLORS.ocean },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.ocean },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  scrollView: { flex: 1 },
  content: { padding: 24 },
  chartCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  chartTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.ocean, marginBottom: 4 },
  chartSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  insightsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  insightCard: { flex: 1, backgroundColor: 'white', borderRadius: 16, padding: 16, borderLeftWidth: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  insightLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  insightValue: { fontSize: 32, fontWeight: 'bold', color: COLORS.ocean, marginBottom: 4 },
  insightTime: { fontSize: 14, color: '#6B7280' },
  riskCard: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  riskHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  riskTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.ocean },
  riskBreakdown: { gap: 12 },
  riskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  riskLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  riskDot: { width: 12, height: 12, borderRadius: 6 },
  riskLabel: { fontSize: 15, color: '#374151' },
  riskHours: { fontSize: 16, fontWeight: '600', color: COLORS.ocean },
  recommendationsCard: { backgroundColor: '#FEF3C7', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#FDE68A' },
  recommendationsTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.ocean, marginBottom: 12 },
  recommendation: { marginBottom: 8 },
  recommendationText: { fontSize: 15, color: '#374151', lineHeight: 22 },
});
