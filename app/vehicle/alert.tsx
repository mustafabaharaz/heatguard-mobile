import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  startVehicleSession,
  dismissVehicleSession,
  getActiveVehicleSession,
  getAlertState,
  estimateInteriorTempF,
  getOccupantLabel,
  type VehicleOccupant,
  type VehicleSession,
} from '../../src/features/vehicle/vehicleAlertEngine';

const COLORS = {
  background: '#0A1628',
  surface: '#1A2942',
  surfaceElevated: '#243352',
  surfaceHigh: '#2D3F5C',
  text: { primary: '#F8FAFC', secondary: '#94A3B8', tertiary: '#64748B' },
  border: '#2D3F5C',
  borderLight: '#374B6D',
  primary: '#3B82F6',
  success: '#22C55E',
  error: '#EF4444',
};

const CURRENT_TEMP_F = 108; // TODO: wire to live weather

const OCCUPANT_OPTIONS: { value: VehicleOccupant; label: string; sublabel: string; icon: string }[] = [
  { value: 'alone', label: 'Just Me', sublabel: 'No vulnerable passengers', icon: '🧑' },
  { value: 'child', label: 'Child Inside', sublabel: 'Reminder at 5 minutes', icon: '👶' },
  { value: 'pet', label: 'Pet Inside', sublabel: 'Reminder at 5 minutes', icon: '🐾' },
  { value: 'child_and_pet', label: 'Child & Pet', sublabel: 'Immediate reminders', icon: '👨‍👧' },
];

// ─── Active Alert View ────────────────────────────────────────────────────────

function ActiveAlertView({
  session,
  onDismiss,
}: {
  session: VehicleSession;
  onDismiss: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Compute initial elapsed
    const initial = Math.floor(
      (Date.now() - new Date(session.startTime).getTime()) / 60_000,
    );
    setElapsed(initial);

    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [session.startTime]);

  const alertState = getAlertState(session, elapsed);
  const isEmergency = alertState.level === 'emergency';

  // Auto-countdown to 911 at emergency level
  useEffect(() => {
    if (isEmergency && countdown === null) {
      setCountdown(30);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            Linking.openURL('tel:911');
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (!isEmergency && countdownRef.current) {
        clearInterval(countdownRef.current);
        setCountdown(null);
      }
    };
  }, [isEmergency, countdown]);

  const alertColor = alertState.color;

  return (
    <View style={[styles.activeCard, { borderColor: alertColor }]}>
      {/* Alert level banner */}
      <View style={[styles.alertBanner, { backgroundColor: `${alertColor}20` }]}>
        <View style={[styles.alertDot, { backgroundColor: alertColor }]} />
        <Text style={[styles.alertBannerText, { color: alertColor }]}>
          {alertState.title}
        </Text>
      </View>

      {/* Interior temp display */}
      <View style={styles.tempDisplay}>
        <Text style={[styles.tempValue, { color: alertColor }]}>
          {alertState.interiorEstimateF}°F
        </Text>
        <Text style={styles.tempLabel}>EST. INTERIOR TEMP</Text>
        <Text style={styles.exteriorLabel}>
          Exterior: {session.exteriorTempF}°F · {elapsed} min parked
        </Text>
      </View>

      {/* Message */}
      <Text style={styles.alertMessage}>{alertState.message}</Text>

      {/* Emergency countdown */}
      {isEmergency && countdown !== null && (
        <View style={styles.countdownCard}>
          <Text style={styles.countdownTitle}>Auto-calling 911 in</Text>
          <Text style={styles.countdownValue}>{countdown}s</Text>
          <TouchableOpacity
            style={styles.countdownCancel}
            onPress={() => {
              if (countdownRef.current) clearInterval(countdownRef.current);
              setCountdown(null);
            }}
          >
            <Text style={styles.countdownCancelText}>Cancel Auto-Call</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Actions */}
      <View style={styles.activeActions}>
        {isEmergency && (
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => Linking.openURL('tel:911')}
            activeOpacity={0.8}
          >
            <Text style={styles.callButtonText}>📞  Call 911 Now</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => {
            Alert.alert(
              'Stop Timer?',
              'Are you back at your vehicle?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Yes, I\'m back', onPress: onDismiss },
              ],
            );
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.dismissButtonText}>✓  I'm Back at the Vehicle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function VehicleAlertScreen() {
  const [session, setSession] = useState<VehicleSession | null>(null);
  const [selectedOccupant, setSelectedOccupant] = useState<VehicleOccupant>('alone');

  useFocusEffect(
    useCallback(() => {
      setSession(getActiveVehicleSession());
    }, []),
  );

  const handleStart = () => {
    const s = startVehicleSession(selectedOccupant, CURRENT_TEMP_F);
    setSession(s);
  };

  const handleDismiss = () => {
    dismissVehicleSession();
    setSession(null);
  };

  // Interior temperature projection data
  const projections = [5, 10, 15, 20, 30].map((min) => ({
    min,
    tempF: estimateInteriorTempF(CURRENT_TEMP_F, min),
  }));

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerLabel}>SAFETY</Text>
            <Text style={styles.headerTitle}>Vehicle Heat Alert</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Active session ──────────────────────────────────────────────── */}
        {session ? (
          <View style={{ marginHorizontal: 20 }}>
            <ActiveAlertView session={session} onDismiss={handleDismiss} />
          </View>
        ) : (
          <>
            {/* ── Setup Card ────────────────────────────────────────────── */}
            <View style={styles.setupCard}>
              <Text style={styles.setupTitle}>Who is in the vehicle?</Text>
              <Text style={styles.setupSubtitle}>
                Starting the timer alerts you before conditions become dangerous.
              </Text>

              <View style={styles.occupantGrid}>
                {OCCUPANT_OPTIONS.map((opt) => {
                  const isSelected = selectedOccupant === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.occupantCard,
                        isSelected && styles.occupantCardSelected,
                      ]}
                      onPress={() => setSelectedOccupant(opt.value)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.occupantIcon}>{opt.icon}</Text>
                      <Text
                        style={[
                          styles.occupantLabel,
                          isSelected && { color: COLORS.primary },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.occupantSublabel}>{opt.sublabel}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.startButton}
                onPress={handleStart}
                activeOpacity={0.8}
              >
                <Text style={styles.startButtonText}>
                  Start Timer · {CURRENT_TEMP_F}°F Outside
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Temperature Projection ────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>INTERIOR TEMPERATURE PROJECTION</Text>
              <View style={styles.projectionCard}>
                <Text style={styles.projectionNote}>
                  At {CURRENT_TEMP_F}°F outside, your vehicle interior reaches:
                </Text>
                {projections.map((p) => {
                  const danger = p.tempF >= 120 ? '#7C3AED' : p.tempF >= 110 ? '#EF4444' : p.tempF >= 100 ? '#F97316' : '#F59E0B';
                  return (
                    <View key={p.min} style={styles.projRow}>
                      <Text style={styles.projMin}>{p.min} min</Text>
                      <View style={styles.projBarTrack}>
                        <View
                          style={[
                            styles.projBarFill,
                            {
                              width: `${Math.min(((p.tempF - 100) / 50) * 100, 100)}%`,
                              backgroundColor: danger,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.projTemp, { color: danger }]}>
                        {p.tempF}°F
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── Safety Facts ──────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CRITICAL FACTS</Text>
              <View style={styles.factsCard}>
                {[
                  'Children\'s body temperature rises 3–5× faster than adults in heat.',
                  'A car can reach 120°F in 20 minutes on a 90°F day.',
                  'Cracking the windows has minimal effect on interior temperature.',
                  '37 children die from vehicle heat stroke every year in the US.',
                ].map((fact, i) => (
                  <View key={i} style={styles.factRow}>
                    <Text style={styles.factIcon}>⚠</Text>
                    <Text style={styles.factText}>{fact}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: COLORS.text.primary, fontSize: 22 },
  headerLabel: { color: COLORS.text.tertiary, fontSize: 11, letterSpacing: 2, fontWeight: '600', textAlign: 'center' },
  headerTitle: { color: COLORS.text.primary, fontSize: 18, fontWeight: '700', marginTop: 2, textAlign: 'center' },

  // Active alert
  activeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    gap: 20,
    paddingBottom: 24,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  alertDot: { width: 10, height: 10, borderRadius: 5 },
  alertBannerText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  tempDisplay: { alignItems: 'center', paddingHorizontal: 20 },
  tempValue: { fontSize: 72, fontWeight: '700', lineHeight: 80 },
  tempLabel: { fontSize: 11, color: COLORS.text.tertiary, letterSpacing: 2, marginTop: 4 },
  exteriorLabel: { fontSize: 12, color: COLORS.text.secondary, marginTop: 6 },
  alertMessage: {
    color: COLORS.text.primary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  countdownCard: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  countdownTitle: { color: '#C4B5FD', fontSize: 13 },
  countdownValue: { color: '#7C3AED', fontSize: 48, fontWeight: '700' },
  countdownCancel: { paddingVertical: 6, paddingHorizontal: 16 },
  countdownCancelText: { color: COLORS.text.secondary, fontSize: 13 },
  activeActions: { paddingHorizontal: 20, gap: 10 },
  callButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  callButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dismissButton: {
    backgroundColor: COLORS.success,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  dismissButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Setup
  setupCard: {
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 16,
  },
  setupTitle: { color: COLORS.text.primary, fontSize: 18, fontWeight: '700' },
  setupSubtitle: { color: COLORS.text.secondary, fontSize: 13, lineHeight: 19 },
  occupantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  occupantCard: {
    width: '47%',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    padding: 16,
    gap: 6,
  },
  occupantCardSelected: { borderColor: COLORS.primary },
  occupantIcon: { fontSize: 28 },
  occupantLabel: { color: COLORS.text.primary, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  occupantSublabel: { color: COLORS.text.tertiary, fontSize: 11, textAlign: 'center' },
  startButton: {
    backgroundColor: COLORS.error,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  startButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  section: { marginHorizontal: 20, marginTop: 24 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: COLORS.text.tertiary,
    marginBottom: 12,
  },

  // Projection
  projectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  projectionNote: { color: COLORS.text.secondary, fontSize: 13, marginBottom: 4 },
  projRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  projMin: { color: COLORS.text.tertiary, fontSize: 12, width: 42 },
  projBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 4,
    overflow: 'hidden',
  },
  projBarFill: { height: '100%', borderRadius: 4 },
  projTemp: { fontSize: 13, fontWeight: '700', width: 52, textAlign: 'right' },

  // Facts
  factsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 4,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  factIcon: { fontSize: 12, marginTop: 2, color: '#F97316' },
  factText: { color: COLORS.text.secondary, fontSize: 13, lineHeight: 19, flex: 1 },
});
