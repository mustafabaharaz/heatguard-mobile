// ─────────────────────────────────────────────
// app/watch/setup.tsx
// Apple Watch pairing, status, and management screen
// ─────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { watchBridge, type WatchBridgeStatus } from '../../src/features/watch/watchBridge';
import {
  initHeartRateEngine,
  getLatestHeartRate,
  getRestingHeartRate,
  getHeartRateRisk,
  formatBpm,
  getHrZoneLabel,
  type HeartRateReading,
} from '../../src/features/watch/heartRateEngine';
import { syncToWatch } from '../../src/features/watch/watchDataSync';
import { COLORS } from '../../theme';

// ── Feature row component ─────────────────────────────────────────────────

interface FeatureRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
  available: boolean;
}

function FeatureRow({ icon, iconColor, title, description, available }: FeatureRowProps) {
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIcon, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{description}</Text>
      </View>
      <Ionicons
        name={available ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={available ? COLORS.thermal.safe : COLORS.neutral[600]}
      />
    </View>
  );
}

// ── Heart rate section ────────────────────────────────────────────────────

interface HeartRatePanelProps {
  reading: HeartRateReading | null;
  restingBpm: number | null;
  loading: boolean;
}

function HeartRatePanel({ reading, restingBpm, loading }: HeartRatePanelProps) {
  const risk = getHeartRateRisk(reading?.bpm ?? null);

  const zoneColors: Record<string, string> = {
    normal:      COLORS.thermal.safe,
    elevated:    COLORS.thermal.caution,
    high:        COLORS.thermal.high,
    critical:    COLORS.thermal.extreme,
    unavailable: COLORS.neutral[500],
  };

  const zoneColor = zoneColors[risk.status] ?? COLORS.neutral[400];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Heart Rate</Text>

      <View style={styles.hrCard}>
        {loading ? (
          <ActivityIndicator color={COLORS.neutral[400]} />
        ) : (
          <>
            <View style={styles.hrMain}>
              <Ionicons name="heart" size={32} color="#EF4444" />
              <View style={styles.hrNumbers}>
                <Text style={styles.hrBpm}>
                  {reading ? reading.bpm : '—'}
                  <Text style={styles.hrUnit}> bpm</Text>
                </Text>
                <View style={[styles.hrZoneBadge, { backgroundColor: zoneColor + '22' }]}>
                  <Text style={[styles.hrZoneLabel, { color: zoneColor }]}>
                    {getHrZoneLabel(reading?.bpm ?? null)}
                  </Text>
                </View>
              </View>
            </View>

            {restingBpm && (
              <View style={styles.hrResting}>
                <Text style={styles.hrRestingLabel}>Resting HR</Text>
                <Text style={styles.hrRestingValue}>{restingBpm} bpm</Text>
              </View>
            )}

            {risk.recommendation && (
              <View style={[styles.hrAlert, { borderLeftColor: zoneColor }]}>
                <Text style={styles.hrAlertText}>{risk.recommendation}</Text>
              </View>
            )}

            {!reading && (
              <Text style={styles.hrUnavailable}>
                Open the Workout app on your Watch to see live heart rate.
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────

export default function WatchSetupScreen() {
  const [status, setStatus] = useState<WatchBridgeStatus | null>(null);
  const [hrReading, setHrReading] = useState<HeartRateReading | null>(null);
  const [restingBpm, setRestingBpm] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const s = await watchBridge.refreshStatus();
    setStatus(s);

    if (Platform.OS === 'ios') {
      const ok = await initHeartRateEngine();
      if (ok) {
        const [reading, resting] = await Promise.all([
          getLatestHeartRate(),
          getRestingHeartRate(),
        ]);
        setHrReading(reading);
        setRestingBpm(resting);
      }
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleManualSync = async () => {
    setSyncing(true);
    // In real usage, pull current weather from your weather store
    const mockWeather = { temperatureF: 105, feelsLikeF: 112, humidity: 18, heatIndexF: 112 };
    await syncToWatch(mockWeather);
    setSyncing(false);
    Alert.alert('Synced', 'Watch data has been updated.');
  };

  if (Platform.OS !== 'ios') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.unavailable}>
          <Ionicons name="watch-outline" size={60} color={COLORS.neutral[600]} />
          <Text style={styles.unavailableTitle}>iOS Only</Text>
          <Text style={styles.unavailableDesc}>
            Apple Watch integration is only available on iOS devices.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const conn = status?.connectionState ?? 'unavailable';
  const connColor =
    conn === 'reachable'   ? COLORS.thermal.safe :
    conn === 'paired'      ? COLORS.thermal.caution :
                             COLORS.neutral[500];

  const connLabel =
    conn === 'reachable'   ? 'Connected & Active' :
    conn === 'paired'      ? 'Paired — Not in Range' :
    conn === 'error'       ? 'Connection Error' :
                             'No Watch Paired';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Nav bar */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.neutral[100]} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Apple Watch</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.neutral[400]}
          />
        }
      >
        {/* Connection status hero */}
        <View style={styles.heroCard}>
          <View style={[styles.watchIcon, { borderColor: connColor + '44' }]}>
            <Ionicons name="watch" size={40} color={connColor} />
          </View>
          <Text style={[styles.connLabel, { color: connColor }]}>{connLabel}</Text>
          {status?.isPaired && (
            <Text style={styles.pairedSince}>
              Watch app {status.isWatchAppInstalled ? 'installed ✓' : 'not installed'}
            </Text>
          )}

          {/* Sync button */}
          <TouchableOpacity
            style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
            onPress={handleManualSync}
            disabled={syncing || !status?.isPaired}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={COLORS.neutral[100]} />
            ) : (
              <Ionicons name="sync" size={16} color={COLORS.neutral[100]} />
            )}
            <Text style={styles.syncBtnText}>
              {syncing ? 'Syncing…' : 'Sync Now'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Heart rate */}
        <HeartRatePanel
          reading={hrReading}
          restingBpm={restingBpm}
          loading={loading}
        />

        {/* Watch features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Watch Features</Text>
          <View style={styles.featuresCard}>
            <FeatureRow
              icon="thermometer"
              iconColor={COLORS.thermal.high}
              title="Thermal Alerts"
              description="Wrist haptic when heat level escalates"
              available={status?.isPaired ?? false}
            />
            <View style={styles.featureDivider} />
            <FeatureRow
              icon="heart"
              iconColor="#EF4444"
              title="Heart Rate Risk"
              description="Factors BPM into your composite heat risk"
              available={hrReading !== null}
            />
            <View style={styles.featureDivider} />
            <FeatureRow
              icon="water"
              iconColor="#3B82F6"
              title="Quick Hydration Log"
              description="Tap Watch to log a drink without phone"
              available={status?.isReachable ?? false}
            />
            <View style={styles.featureDivider} />
            <FeatureRow
              icon="sos"
              iconColor={COLORS.thermal.extreme}
              title="Wrist SOS"
              description="One-tap emergency from your Watch"
              available={status?.isReachable ?? false}
            />
            <View style={styles.featureDivider} />
            <FeatureRow
              icon="radio"
              iconColor={COLORS.thermal.caution}
              title="Watch Face Complication"
              description="Thermal gauge on your watch face"
              available={status?.isPaired ?? false}
            />
            <View style={styles.featureDivider} />
            <FeatureRow
              icon="person-circle"
              iconColor={COLORS.thermal.safe}
              title="Safety Check-In"
              description="Confirm you're OK from your Watch"
              available={status?.isReachable ?? false}
            />
          </View>
        </View>

        {/* Setup guide */}
        {!status?.isPaired && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How to Pair</Text>
            <View style={styles.setupCard}>
              {[
                'Open the Watch app on your iPhone',
                'Tap "My Watch" → "General" → "Watch App"',
                'Install HeatGuard on your Watch',
                'Return here and tap Refresh',
              ].map((step, i) => (
                <View key={i} style={styles.setupStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Complication instructions */}
        {status?.isPaired && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Watch Complication</Text>
            <View style={styles.setupCard}>
              {[
                'Long-press your Watch face',
                'Tap "Edit" → choose a complication slot',
                'Scroll to find HeatGuard',
                'The slot shows live thermal level + temperature',
              ].map((step, i) => (
                <View key={i} style={styles.setupStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.neutral[100],
    fontFamily: 'Inter-SemiBold',
  },
  content: {
    paddingBottom: 40,
  },

  // Hero
  heroCard: {
    margin: 16,
    padding: 24,
    backgroundColor: COLORS.surface.card,
    borderRadius: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  watchIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  connLabel: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  pairedSince: {
    fontSize: 13,
    color: COLORS.neutral[400],
    fontFamily: 'Inter-Regular',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.surface.elevated,
    borderRadius: 20,
    marginTop: 4,
  },
  syncBtnDisabled: { opacity: 0.4 },
  syncBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.neutral[200],
    fontFamily: 'Inter-SemiBold',
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.neutral[400],
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // HR card
  hrCard: {
    backgroundColor: COLORS.surface.card,
    borderRadius: 16,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  hrMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  hrNumbers: {
    gap: 6,
  },
  hrBpm: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.neutral[100],
    fontFamily: 'Inter-Bold',
  },
  hrUnit: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.neutral[400],
  },
  hrZoneBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  hrZoneLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  hrResting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  hrRestingLabel: {
    fontSize: 13,
    color: COLORS.neutral[400],
    fontFamily: 'Inter-Regular',
  },
  hrRestingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.neutral[200],
    fontFamily: 'Inter-SemiBold',
  },
  hrAlert: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
  },
  hrAlertText: {
    fontSize: 13,
    color: COLORS.neutral[300],
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  hrUnavailable: {
    fontSize: 13,
    color: COLORS.neutral[500],
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Features
  featuresCard: {
    backgroundColor: COLORS.surface.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.neutral[100],
    fontFamily: 'Inter-SemiBold',
  },
  featureDesc: {
    fontSize: 12,
    color: COLORS.neutral[400],
    fontFamily: 'Inter-Regular',
  },
  featureDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginLeft: 62,
  },

  // Setup steps
  setupCard: {
    backgroundColor: COLORS.surface.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  setupStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.neutral[300],
    fontFamily: 'Inter-Bold',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.neutral[200],
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },

  // Unavailable
  unavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  unavailableTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.neutral[200],
    fontFamily: 'Inter-Bold',
  },
  unavailableDesc: {
    fontSize: 15,
    color: COLORS.neutral[400],
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
  },
});
