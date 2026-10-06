// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Emergency SOS sheet
// Opens straight to the actions (the press-and-hold already confirmed intent):
//   Call 911 · Text my contacts + location · Call primary contact · Share location
// "Not sure how serious it is?" leads to the optional symptom check.
// Theme-aware: High Sun (light) / Night Shift (dark).
// ─────────────────────────────────────────────────────────────────────────────

import { Modal, View, Text, Pressable, StyleSheet, Linking, ScrollView } from 'react-native';
import { X, Phone, Users, MapPin, AlertTriangle, Check, ChevronRight, ChevronLeft, Clock, Stethoscope } from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import { getPrimaryContact } from '../../features/emergency/storage/contactStorage';
import { textContacts, shareLocation, call911 } from '../../features/emergency/emergencyMessaging';
import { useSettings } from '../../context/SettingsContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── Skins ────────────────────────────────────────────────────────────────────

const SKIN = {
  light: {
    sheet: '#FFFFFF',
    text: '#0A0A0A',
    muted: '#3F3F3A',
    border: '#D4D4CF',
    strong: '#0A0A0A',
    subtle: '#F4F4F0',
    danger: '#C81E1E',
    onDanger: '#FFFFFF',
    primary: '#0B4FD6',
    onPrimary: '#FFFFFF',
    severe: '#C2410C',
    mild: '#92400E',
    pressed: '#E8E8E2',
  },
  dark: {
    sheet: '#131C2E',
    text: '#F1F5F9',
    muted: '#A3B1C9',
    border: '#2D3B5E',
    strong: '#3B4B70',
    subtle: '#1A2540',
    danger: '#DC2626',
    onDanger: '#FFFFFF',
    primary: '#38BDF8',
    onPrimary: '#04121F',
    severe: '#FB923C',
    mild: '#FBBF24',
    pressed: '#1F2B49',
  },
};

type Skin = typeof SKIN.light;

// ─── Symptom definitions ──────────────────────────────────────────────────────

interface Symptom {
  id: string;
  label: string;
  severity: 'mild' | 'severe' | 'critical';
  description: string;
}

const SYMPTOMS: Symptom[] = [
  { id: 'dizzy',     label: 'Dizziness',            severity: 'mild',     description: 'Feeling lightheaded or unsteady' },
  { id: 'thirst',    label: 'Extreme thirst',       severity: 'mild',     description: 'Unusually strong thirst' },
  { id: 'fatigue',   label: 'Heavy fatigue',        severity: 'mild',     description: 'Unusual tiredness or weakness' },
  { id: 'nausea',    label: 'Nausea / vomiting',    severity: 'severe',   description: 'Feeling sick to stomach' },
  { id: 'headache',  label: 'Severe headache',      severity: 'severe',   description: 'Intense, pounding headache' },
  { id: 'skin',      label: 'Hot, dry skin',        severity: 'severe',   description: 'Skin hot to touch, not sweating' },
  { id: 'confusion', label: 'Confusion',            severity: 'critical', description: 'Difficulty thinking clearly' },
  { id: 'chest',     label: 'Chest pain',           severity: 'critical', description: 'Pain or pressure in chest' },
  { id: 'faint',     label: 'Fainting / collapsed', severity: 'critical', description: 'Lost or losing consciousness' },
];

type SeverityLevel = 'none' | 'mild' | 'severe' | 'critical';

function assessSeverity(selectedIds: string[]): SeverityLevel {
  if (!selectedIds.length) return 'none';
  const selected = SYMPTOMS.filter(s => selectedIds.includes(s.id));
  if (selected.some(s => s.severity === 'critical')) return 'critical';
  if (selected.some(s => s.severity === 'severe')) return 'severe';
  return 'mild';
}

function severityColor(level: SeverityLevel | Symptom['severity'], c: Skin): string {
  if (level === 'critical') return c.danger;
  if (level === 'severe') return c.severe;
  if (level === 'mild') return c.mild;
  return c.muted;
}

function severityCopy(level: SeverityLevel) {
  switch (level) {
    case 'critical': return { label: 'Critical', subtext: 'These can be signs of heat stroke. Call 911.' };
    case 'severe':   return { label: 'Serious', subtext: 'Get to a cool place and contact someone now.' };
    case 'mild':     return { label: 'Mild', subtext: 'Cool down, drink water, and keep watching how you feel.' };
    default:         return { label: '', subtext: '' };
  }
}

type Step = 'actions' | 'symptom-check' | 'escalation';

const COUNTDOWN_S = 30;

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmergencySOSModal({ visible, onClose }: Props) {
  const { isDark } = useSettings();
  const c = isDark ? SKIN.dark : SKIN.light;

  const [step, setStep] = useState<Step>('actions');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(COUNTDOWN_S);
  const [countdownActive, setCountdownActive] = useState(false);
  const [primary, setPrimary] = useState<ReturnType<typeof getPrimaryContact>>(null as any);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset on open/close
  useEffect(() => {
    if (visible) {
      setStep('actions');
      setSelectedSymptoms([]);
      setCountdown(COUNTDOWN_S);
      setCountdownActive(false);
      try { setPrimary(getPrimaryContact()); } catch { setPrimary(null as any); }
    } else {
      stopCountdown();
    }
  }, [visible]);

  // Countdown timer (critical symptoms only)
  useEffect(() => {
    if (countdownActive) {
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            stopCountdown();
            onClose();
            call911(); // iOS shows its own Call confirmation
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [countdownActive]);

  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdownActive(false);
  };

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
  };

  const handleCall911 = () => {
    stopCountdown();
    onClose();
    call911(); // iOS shows its own Call confirmation
  };

  const handleTextContacts = () => {
    stopCountdown();
    textContacts();
  };

  const handleCallPrimary = () => {
    if (!primary) return;
    stopCountdown();
    onClose();
    Linking.openURL(`tel:${primary.phoneNumber}`);
  };

  const handleShareLocation = () => {
    stopCountdown();
    shareLocation();
  };

  const handleSymptomsNext = () => {
    const level = assessSeverity(selectedSymptoms);
    if (level === 'none') {
      setStep('actions');
      return;
    }
    setStep('escalation');
    if (level === 'critical') {
      setCountdown(COUNTDOWN_S);
      setCountdownActive(true);
    }
  };

  const severity = assessSeverity(selectedSymptoms);
  const sevCopy = severityCopy(severity);
  const sevColor = severityColor(severity, c);

  // ── Shared pieces ──────────────────────────────────────────────────────────

  const CloseButton = () => (
    <Pressable
      onPress={() => { stopCountdown(); onClose(); }}
      style={styles.iconBtn}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={8}
    >
      <X size={26} color={c.text} />
    </Pressable>
  );

  const BigAction = ({
    label, sub, icon, bg, fg, onPress,
  }: { label: string; sub: string; icon: React.ReactNode; bg: string; fg: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${sub}`}
      style={({ pressed }) => [styles.bigAction, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }]}
    >
      {icon}
      <View style={styles.bigActionText}>
        <Text style={[styles.bigActionLabel, { color: fg }]}>{label}</Text>
        <Text style={[styles.bigActionSub, { color: fg }]}>{sub}</Text>
      </View>
    </Pressable>
  );

  const OutlineAction = ({
    label, icon, onPress, color,
  }: { label: string; icon: React.ReactNode; onPress: () => void; color?: string }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.outlineAction,
        { borderColor: color ?? c.strong, backgroundColor: pressed ? c.pressed : 'transparent' },
      ]}
    >
      {icon}
      <Text style={[styles.outlineLabel, { color: color ?? c.text }]}>{label}</Text>
    </Pressable>
  );

  // ── Step: Actions (default) ────────────────────────────────────────────────

  const renderActions = () => (
    <>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Get help now</Text>
        <CloseButton />
      </View>

      <View style={styles.stack}>
        <BigAction
          label="Call 911"
          sub="Emergency services"
          icon={<Phone size={30} color={c.onDanger} />}
          bg={c.danger}
          fg={c.onDanger}
          onPress={handleCall911}
        />
        <BigAction
          label="Text my contacts"
          sub="Sends where you are with a map link"
          icon={<Users size={30} color={c.onPrimary} />}
          bg={c.primary}
          fg={c.onPrimary}
          onPress={handleTextContacts}
        />
        {primary ? (
          <OutlineAction
            label={`Call ${primary.name}`}
            icon={<Phone size={20} color={c.text} />}
            onPress={handleCallPrimary}
          />
        ) : null}
        <OutlineAction
          label="Share my location"
          icon={<MapPin size={20} color={c.text} />}
          onPress={handleShareLocation}
        />
      </View>

      <Pressable
        onPress={() => setStep('symptom-check')}
        style={styles.linkRow}
        accessibilityRole="button"
        accessibilityLabel="Not sure how serious it is? Check symptoms"
      >
        <Stethoscope size={18} color={c.text} />
        <Text style={[styles.linkText, { color: c.text }]}>Not sure how serious it is? Check symptoms</Text>
        <ChevronRight size={18} color={c.text} />
      </Pressable>

      <Text style={[styles.footnote, { color: c.muted }]}>
        HeatGuard doesn't contact emergency services for you. Calls and texts open ready to go, and you tap to send.
      </Text>
    </>
  );

  // ── Step: Symptom check ────────────────────────────────────────────────────

  const renderSymptomCheck = () => (
    <>
      <View style={styles.header}>
        <Pressable onPress={() => setStep('actions')} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeft size={22} color={c.text} />
          <Text style={[styles.backText, { color: c.text }]}>Back</Text>
        </Pressable>
        <CloseButton />
      </View>

      <Text style={[styles.sectionTitle, { color: c.text }]}>What are you feeling right now?</Text>

      <ScrollView style={styles.symptomScroll} showsVerticalScrollIndicator={false}>
        {SYMPTOMS.map(symptom => {
          const selected = selectedSymptoms.includes(symptom.id);
          const chipColor = severityColor(symptom.severity, c);
          return (
            <Pressable
              key={symptom.id}
              style={[
                styles.symptomRow,
                { borderColor: selected ? chipColor : c.border, backgroundColor: selected ? c.subtle : 'transparent' },
              ]}
              onPress={() => toggleSymptom(symptom.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${symptom.label}. ${symptom.description}`}
            >
              <View
                style={[
                  styles.symptomCheck,
                  { borderColor: selected ? chipColor : c.strong, backgroundColor: selected ? chipColor : 'transparent' },
                ]}
              >
                {selected && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <View style={styles.symptomInfo}>
                <Text style={[styles.symptomLabel, { color: c.text }]}>{symptom.label}</Text>
                <Text style={[styles.symptomDesc, { color: c.muted }]}>{symptom.description}</Text>
              </View>
              {symptom.severity === 'critical' && (
                <Text style={[styles.criticalTag, { color: c.danger }]}>Critical</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {severity !== 'none' && (
        <View style={[styles.previewBanner, { borderColor: sevColor }]}>
          <AlertTriangle size={18} color={sevColor} />
          <Text style={[styles.previewText, { color: c.text }]}>
            <Text style={{ color: sevColor, fontWeight: '800' }}>{sevCopy.label}: </Text>
            {sevCopy.subtext}
          </Text>
        </View>
      )}

      <Pressable
        onPress={handleSymptomsNext}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.primaryBtn,
          { backgroundColor: severity === 'critical' ? c.danger : c.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.primaryBtnText, { color: severity === 'critical' ? c.onDanger : c.onPrimary }]}>
          {severity === 'none' ? 'Back to help options' : 'See what to do'}
        </Text>
      </Pressable>
    </>
  );

  // ── Step: Escalation ───────────────────────────────────────────────────────

  const renderEscalation = () => {
    const isCritical = severity === 'critical';
    return (
      <>
        <View style={styles.header}>
          <Pressable
            onPress={() => { stopCountdown(); setStep('symptom-check'); }}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={22} color={c.text} />
            <Text style={[styles.backText, { color: c.text }]}>Back</Text>
          </Pressable>
          <CloseButton />
        </View>

        <View style={[styles.severityBanner, { borderColor: sevColor, backgroundColor: c.subtle }]}>
          <AlertTriangle size={26} color={sevColor} />
          <View style={styles.severityTextBlock}>
            <Text style={[styles.severityLabel, { color: sevColor }]}>{sevCopy.label}</Text>
            <Text style={[styles.severitySubtext, { color: c.text }]}>{sevCopy.subtext}</Text>
          </View>
        </View>

        {isCritical && countdownActive && (
          <View style={[styles.countdownBanner, { borderColor: c.danger }]}>
            <Clock size={18} color={c.danger} />
            <Text style={[styles.countdownText, { color: c.text }]}>
              Opening a 911 call in <Text style={{ color: c.danger, fontWeight: '800' }}>{countdown}s</Text>
            </Text>
            <Pressable
              onPress={stopCountdown}
              style={[styles.countdownCancel, { borderColor: c.strong }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel automatic 911 call"
            >
              <Text style={[styles.countdownCancelText, { color: c.text }]}>Cancel</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.stack}>
          {isCritical ? (
            <BigAction
              label="Call 911 now"
              sub="Heat stroke is life-threatening"
              icon={<Phone size={30} color={c.onDanger} />}
              bg={c.danger}
              fg={c.onDanger}
              onPress={handleCall911}
            />
          ) : (
            <BigAction
              label="Text my contacts"
              sub="Sends where you are with a map link"
              icon={<Users size={30} color={c.onPrimary} />}
              bg={c.primary}
              fg={c.onPrimary}
              onPress={handleTextContacts}
            />
          )}
          {isCritical && (
            <OutlineAction label="Also text my contacts" icon={<Users size={20} color={c.text} />} onPress={handleTextContacts} />
          )}
          <OutlineAction label="Share my location" icon={<MapPin size={20} color={c.text} />} onPress={handleShareLocation} />
          {!isCritical && (
            <OutlineAction
              label="Call 911 instead"
              icon={<Phone size={20} color={c.danger} />}
              onPress={handleCall911}
              color={c.danger}
            />
          )}
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: c.sheet }]}>
          {step === 'actions' && renderActions()}
          {step === 'symptom-check' && renderSymptomCheck()}
          {step === 'escalation' && renderEscalation()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 40, maxHeight: '92%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, minHeight: 44 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingRight: 12 },
  backText: { fontSize: 17, fontWeight: '600' },

  stack: { gap: 10 },
  bigAction: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 20, minHeight: 80 },
  bigActionText: { flex: 1 },
  bigActionLabel: { fontSize: 21, fontWeight: '800' },
  bigActionSub: { fontSize: 14, marginTop: 2, opacity: 0.92 },
  outlineAction: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 2, paddingHorizontal: 16, minHeight: 54 },
  outlineLabel: { fontSize: 17, fontWeight: '700' },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, marginTop: 14 },
  linkText: { flex: 1, fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
  footnote: { fontSize: 13, lineHeight: 19, marginTop: 6 },

  sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  symptomScroll: { maxHeight: 360, marginBottom: 12 },
  symptomRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, marginBottom: 8, gap: 12, minHeight: 56 },
  symptomCheck: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  symptomInfo: { flex: 1 },
  symptomLabel: { fontSize: 16, fontWeight: '700' },
  symptomDesc: { fontSize: 13, marginTop: 1 },
  criticalTag: { fontSize: 12, fontWeight: '800' },

  previewBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 2, marginBottom: 12 },
  previewText: { fontSize: 14, flex: 1, lineHeight: 20 },
  primaryBtn: { minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 17, fontWeight: '800' },

  severityBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 2, padding: 16, marginBottom: 14, gap: 12 },
  severityTextBlock: { flex: 1 },
  severityLabel: { fontSize: 19, fontWeight: '800' },
  severitySubtext: { fontSize: 15, marginTop: 2, lineHeight: 21 },

  countdownBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 2, padding: 12, marginBottom: 14, gap: 8 },
  countdownText: { flex: 1, fontSize: 15, fontWeight: '600' },
  countdownCancel: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  countdownCancelText: { fontSize: 15, fontWeight: '700' },
});
