import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking, Alert, ScrollView } from 'react-native';
import { X, Phone, Users, MapPin, AlertTriangle, CheckCircle, ChevronRight, Clock } from 'lucide-react-native';
import { useState, useEffect, useRef } from 'react';
import { getPrimaryContact } from '../../features/emergency/storage/contactStorage';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCallEmergency: () => void;
  onContactFamily: () => void;
  onShareLocation: () => void;
}

const COLORS = {
  lava: '#E63946',
  ocean: '#1D3557',
  glacier: '#8ECAE6',
  success: '#2D9B6F',
  ember: '#F4A261',
  warning: '#F59E0B',
  bg: '#F9FAFB',
  border: '#E5E7EB',
  muted: '#6B7280',
};

// ─── Symptom definitions ──────────────────────────────────────────────────────

interface Symptom {
  id: string;
  label: string;
  severity: 'mild' | 'severe' | 'critical';
  description: string;
}

const SYMPTOMS: Symptom[] = [
  { id: 'dizzy',       label: 'Dizziness',           severity: 'mild',     description: 'Feeling lightheaded or unsteady' },
  { id: 'thirst',      label: 'Extreme thirst',       severity: 'mild',     description: 'Unusually strong thirst' },
  { id: 'fatigue',     label: 'Heavy fatigue',        severity: 'mild',     description: 'Unusual tiredness or weakness' },
  { id: 'nausea',      label: 'Nausea / vomiting',    severity: 'severe',   description: 'Feeling sick to stomach' },
  { id: 'headache',    label: 'Severe headache',      severity: 'severe',   description: 'Intense, pounding headache' },
  { id: 'skin',        label: 'Hot, dry skin',        severity: 'severe',   description: 'Skin hot to touch, not sweating' },
  { id: 'confusion',   label: 'Confusion',            severity: 'critical', description: 'Difficulty thinking clearly' },
  { id: 'chest',       label: 'Chest pain',           severity: 'critical', description: 'Pain or pressure in chest' },
  { id: 'faint',       label: 'Fainting / collapsed', severity: 'critical', description: 'Lost or losing consciousness' },
];

// ─── Severity assessment ──────────────────────────────────────────────────────

type SeverityLevel = 'none' | 'mild' | 'severe' | 'critical';

function assessSeverity(selectedIds: string[]): SeverityLevel {
  if (!selectedIds.length) return 'none';
  const selected = SYMPTOMS.filter(s => selectedIds.includes(s.id));
  if (selected.some(s => s.severity === 'critical')) return 'critical';
  if (selected.some(s => s.severity === 'severe')) return 'severe';
  return 'mild';
}

function getSeverityConfig(level: SeverityLevel) {
  switch (level) {
    case 'critical': return { color: COLORS.lava,    label: 'CRITICAL',    icon: '🚨', action: 'Call 911 immediately',       subtext: 'Life-threatening symptoms detected' };
    case 'severe':   return { color: COLORS.ember,   label: 'SEVERE',      icon: '⚠️', action: 'Contact emergency contacts',  subtext: 'Serious symptoms — act now' };
    case 'mild':     return { color: COLORS.warning, label: 'MILD',        icon: '🌡️', action: 'Rest and hydrate',            subtext: 'Monitor symptoms closely' };
    default:         return { color: COLORS.muted,   label: '',            icon: '',   action: '',                           subtext: '' };
  }
}

// ─── Step components ──────────────────────────────────────────────────────────

type Step = 'symptom-check' | 'escalation' | 'actions';

export default function EmergencySOSModal({ visible, onClose, onCallEmergency, onContactFamily, onShareLocation }: Props) {
  const [step, setStep] = useState<Step>('symptom-check');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(30);
  const [countdownActive, setCountdownActive] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset on open/close
  useEffect(() => {
    if (visible) {
      setStep('symptom-check');
      setSelectedSymptoms([]);
      setCountdown(30);
      setCountdownActive(false);
    } else {
      stopCountdown();
    }
  }, [visible]);

  // Countdown timer
  useEffect(() => {
    if (countdownActive) {
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            stopCountdown();
            handleCall911();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => stopCountdown();
  }, [countdownActive]);

  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdownActive(false);
  };

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    const severity = assessSeverity(selectedSymptoms);
    if (severity === 'none') {
      setStep('actions');
      return;
    }
    setStep('escalation');
    if (severity === 'critical') {
      setCountdown(30);
      setCountdownActive(true);
    }
  };

  const handleCall911 = () => {
    stopCountdown();
    Alert.alert('Call 911?', 'This will immediately call emergency services.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call Now', style: 'destructive', onPress: () => { onClose(); Linking.openURL('tel:911'); } },
    ]);
  };

  const handleContactFamily = () => {
    stopCountdown();
    const primaryContact = getPrimaryContact();
    if (!primaryContact) {
      Alert.alert('No Emergency Contacts', 'Please add contacts in Profile → Emergency Contacts.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add Now', onPress: onClose },
      ]);
      return;
    }
    Alert.alert(`Contact ${primaryContact.name}?`, `Call or text ${primaryContact.phoneNumber}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call', onPress: () => { onClose(); Linking.openURL(`tel:${primaryContact.phoneNumber}`); } },
      { text: 'Text', onPress: () => { onClose(); Linking.openURL(`sms:${primaryContact.phoneNumber}?body=🆘 Emergency alert from HeatGuard. I need help due to heat conditions. Please check on me.`); } },
    ]);
  };

  const handleShareLocation = () => {
    stopCountdown();
    onShareLocation();
  };

  const severity = assessSeverity(selectedSymptoms);
  const severityConfig = getSeverityConfig(severity);

  // ── Step 1: Symptom Check ────────────────────────────────────────────────
  const renderSymptomCheck = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>🆘 Emergency SOS</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
          <X size={24} color={COLORS.ocean} />
        </TouchableOpacity>
      </View>

      <Text style={styles.stepLabel}>STEP 1 OF 2 — SYMPTOMS</Text>
      <Text style={styles.subtitle}>Select any symptoms you are experiencing right now:</Text>

      <ScrollView style={styles.symptomScroll} showsVerticalScrollIndicator={false}>
        {SYMPTOMS.map(symptom => {
          const selected = selectedSymptoms.includes(symptom.id);
          const chipColor = symptom.severity === 'critical' ? COLORS.lava : symptom.severity === 'severe' ? COLORS.ember : COLORS.warning;
          return (
            <TouchableOpacity
              key={symptom.id}
              style={[styles.symptomRow, selected && { borderColor: chipColor, backgroundColor: `${chipColor}10` }]}
              onPress={() => toggleSymptom(symptom.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={symptom.label}
            >
              <View style={[styles.symptomCheck, selected && { backgroundColor: chipColor, borderColor: chipColor }]}>
                {selected && <CheckCircle size={16} color="white" />}
              </View>
              <View style={styles.symptomInfo}>
                <Text style={[styles.symptomLabel, selected && { color: chipColor }]}>{symptom.label}</Text>
                <Text style={styles.symptomDesc}>{symptom.description}</Text>
              </View>
              {symptom.severity === 'critical' && (
                <View style={styles.criticalChip}><Text style={styles.criticalChipText}>Critical</Text></View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Live severity preview */}
      {severity !== 'none' && (
        <View style={[styles.previewBanner, { backgroundColor: `${severityConfig.color}15`, borderColor: severityConfig.color }]}>
          <AlertTriangle size={16} color={severityConfig.color} />
          <Text style={[styles.previewText, { color: severityConfig.color }]}>
            {severityConfig.label}: {severityConfig.subtext}
          </Text>
        </View>
      )}

      <View style={styles.stepActions}>
        <TouchableOpacity style={styles.skipBtn} onPress={() => setStep('actions')}>
          <Text style={styles.skipBtnText}>Skip to actions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: severity === 'none' ? COLORS.muted : severityConfig.color }]}
          onPress={handleNext}
          accessibilityRole="button"
        >
          <Text style={styles.nextBtnText}>
            {severity === 'none' ? 'Continue' : `Get ${severityConfig.label === 'CRITICAL' ? 'Help Now' : 'Guidance'}`}
          </Text>
          <ChevronRight size={18} color="white" />
        </TouchableOpacity>
      </View>

      {/* Always-visible 911 */}
      <TouchableOpacity style={styles.directCall} onPress={handleCall911}>
        <Phone size={16} color={COLORS.lava} />
        <Text style={styles.directCallText}>Call 911 directly</Text>
      </TouchableOpacity>
    </>
  );

  // ── Step 2: Escalation ───────────────────────────────────────────────────
  const renderEscalation = () => {
    const isCritical = severity === 'critical';
    const affectedSymptoms = SYMPTOMS.filter(s => selectedSymptoms.includes(s.id));

    return (
      <>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { stopCountdown(); setStep('symptom-check'); }} style={styles.closeBtn} accessibilityLabel="Back">
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { stopCountdown(); onClose(); }} style={styles.closeBtn} accessibilityLabel="Close">
            <X size={24} color={COLORS.ocean} />
          </TouchableOpacity>
        </View>

        <Text style={styles.stepLabel}>STEP 2 OF 2 — RECOMMENDED ACTION</Text>

        {/* Severity banner */}
        <View style={[styles.severityBanner, { backgroundColor: severityConfig.color }]}>
          <Text style={styles.severityIcon}>{severityConfig.icon}</Text>
          <View style={styles.severityTextBlock}>
            <Text style={styles.severityLabel}>{severityConfig.label} SEVERITY</Text>
            <Text style={styles.severitySubtext}>{severityConfig.subtext}</Text>
          </View>
        </View>

        {/* Detected symptoms summary */}
        <Text style={styles.detectedLabel}>Symptoms detected:</Text>
        <View style={styles.detectedRow}>
          {affectedSymptoms.map(s => (
            <View key={s.id} style={[styles.detectedChip, { borderColor: severityConfig.color }]}>
              <Text style={[styles.detectedChipText, { color: severityConfig.color }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Auto-escalation countdown for critical */}
        {isCritical && countdownActive && (
          <View style={styles.countdownBanner}>
            <Clock size={18} color={COLORS.lava} />
            <Text style={styles.countdownText}>
              Auto-calling 911 in <Text style={styles.countdownNum}>{countdown}s</Text>
            </Text>
            <TouchableOpacity onPress={stopCountdown} style={styles.countdownCancelBtn}>
              <Text style={styles.countdownCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recommended action */}
        <Text style={styles.recommendLabel}>Recommended action:</Text>

        {isCritical ? (
          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: COLORS.lava }]} onPress={handleCall911}>
            <Phone size={28} color="white" />
            <View style={styles.actionTextBlock}>
              <Text style={styles.actionTitle}>Call 911 Now</Text>
              <Text style={styles.actionSub}>Heat stroke is life-threatening</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: COLORS.ocean }]} onPress={handleContactFamily}>
            <Users size={28} color="white" />
            <View style={styles.actionTextBlock}>
              <Text style={styles.actionTitle}>Contact Emergency Contact</Text>
              <Text style={styles.actionSub}>Alert your family or caregiver</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Secondary actions */}
        <View style={styles.secondaryActions}>
          {isCritical && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleContactFamily}>
              <Users size={18} color={COLORS.ocean} />
              <Text style={styles.secondaryBtnText}>Also contact family</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleShareLocation}>
            <MapPin size={18} color={COLORS.ocean} />
            <Text style={styles.secondaryBtnText}>Share my location</Text>
          </TouchableOpacity>
          {!isCritical && (
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: COLORS.lava }]} onPress={handleCall911}>
              <Phone size={18} color={COLORS.lava} />
              <Text style={[styles.secondaryBtnText, { color: COLORS.lava }]}>Call 911 instead</Text>
            </TouchableOpacity>
          )}
        </View>
      </>
    );
  };

  // ── Step 3: Direct Actions (no symptoms selected) ────────────────────────
  const renderActions = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>🆘 Emergency SOS</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
          <X size={24} color={COLORS.ocean} />
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>Choose an emergency action:</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.lava }]} onPress={handleCall911}>
          <Phone size={32} color="white" />
          <Text style={styles.actionText}>Call 911</Text>
          <Text style={styles.actionSubtext}>Emergency services</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.ocean }]} onPress={handleContactFamily}>
          <Users size={32} color="white" />
          <Text style={styles.actionText}>Contact Family</Text>
          <Text style={styles.actionSubtext}>Alert contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.success }]} onPress={handleShareLocation}>
          <MapPin size={32} color="white" />
          <Text style={styles.actionText}>Share Location</Text>
          <Text style={styles.actionSubtext}>Send GPS coordinates</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.backToSymptoms} onPress={() => setStep('symptom-check')}>
        <Text style={styles.backToSymptomsText}>← Check symptoms first</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {step === 'symptom-check' && renderSymptomCheck()}
          {step === 'escalation' && renderEscalation()}
          {step === 'actions' && renderActions()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modal: { backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.lava },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 15, color: COLORS.ocean, fontWeight: '600' },
  stepLabel: { fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1, marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#374151', marginBottom: 16, lineHeight: 22 },

  // Symptom list
  symptomScroll: { maxHeight: 340, marginBottom: 12 },
  symptomRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, marginBottom: 8, gap: 12 },
  symptomCheck: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' },
  symptomInfo: { flex: 1 },
  symptomLabel: { fontSize: 15, fontWeight: '600', color: COLORS.ocean },
  symptomDesc: { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  criticalChip: { backgroundColor: `${COLORS.lava}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  criticalChipText: { fontSize: 11, fontWeight: '700', color: COLORS.lava },

  // Preview banner
  previewBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 12 },
  previewText: { fontSize: 13, fontWeight: '600', flex: 1 },

  // Step actions
  stepActions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  skipBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border },
  skipBtnText: { fontSize: 15, color: COLORS.muted, fontWeight: '500' },
  nextBtn: { flex: 2, flexDirection: 'row', paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 12, gap: 6 },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: 'white' },

  // Direct 911
  directCall: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  directCallText: { fontSize: 14, color: COLORS.lava, fontWeight: '600' },

  // Severity banner
  severityBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, marginBottom: 16, gap: 12 },
  severityIcon: { fontSize: 28 },
  severityTextBlock: { flex: 1 },
  severityLabel: { fontSize: 17, fontWeight: '800', color: 'white' },
  severitySubtext: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  // Detected symptoms
  detectedLabel: { fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  detectedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  detectedChip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  detectedChipText: { fontSize: 12, fontWeight: '600' },

  // Countdown
  countdownBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 14, gap: 8, borderWidth: 1, borderColor: `${COLORS.lava}40` },
  countdownText: { flex: 1, fontSize: 14, color: COLORS.ocean, fontWeight: '500' },
  countdownNum: { fontWeight: '800', color: COLORS.lava, fontSize: 16 },
  countdownCancelBtn: { backgroundColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  countdownCancelText: { fontSize: 13, fontWeight: '600', color: COLORS.ocean },

  // Actions
  recommendLabel: { fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  primaryAction: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 18, gap: 16, marginBottom: 12 },
  actionTextBlock: { flex: 1 },
  actionTitle: { fontSize: 18, fontWeight: '700', color: 'white' },
  actionSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  secondaryActions: { gap: 8 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border },
  secondaryBtnText: { fontSize: 15, color: COLORS.ocean, fontWeight: '500' },

  // Direct actions step
  actionsGrid: { gap: 12, marginBottom: 16 },
  actionButton: { borderRadius: 16, padding: 20, alignItems: 'center', minHeight: 44 },
  actionText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginTop: 12 },
  actionSubtext: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  backToSymptoms: { alignItems: 'center', paddingVertical: 8 },
  backToSymptomsText: { fontSize: 14, color: COLORS.ocean, fontWeight: '600' },
});
