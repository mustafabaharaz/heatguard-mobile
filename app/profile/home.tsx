// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/profile/home.tsx   (NEW FILE)
// HeatGuard · Home surroundings
//  - AC at home? Reliable? Ever turned off to save on bills?
//  - If cooling can't be counted on: free cooling tips + Arizona bill help
//  - Shortcut to the daily check-in, recommended for these households
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, ExternalLink, Phone, BellRing, MapPin, Lightbulb } from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';
import HomeSurroundingsQuestions, {
  answersFromDraft, draftFromAnswers, isDraftComplete, type HomeDraft,
} from '../../src/components/profile/HomeSurroundingsQuestions';
import {
  getHeatProfile, getHomeAnswers, saveHomeAnswers, hasCoolingRisk,
} from '../../src/features/profile/storage/profileStorage';
import { getDailyCheckIn } from '../../src/features/checkin/dailyCheckIn';
import { COOLING_TIPS, AZ_BILL_HELP, AZ_SHUTOFF_NOTE } from '../../src/content/homeSafety';

const SKIN = {
  light: {
    bg: '#F4F4F0',
    card: '#FFFFFF',
    border: '#0A0A0A',
    divider: '#E2E2DC',
    text: '#0A0A0A',
    muted: '#3F3F3A',
    accent: '#0B4FD6',
    onAccent: '#FFFFFF',
    selectedBg: '#EAF0FF',
    noteBg: '#FFF4CC',
    noteText: '#5C4300',
    pressed: '#ECECE6',
  },
  dark: {
    bg: '#0B1220',
    card: '#131C2E',
    border: '#2D3B5E',
    divider: '#24314F',
    text: '#F1F5F9',
    muted: '#A3B1C9',
    accent: '#38BDF8',
    onAccent: '#04121F',
    selectedBg: '#13263D',
    noteBg: '#2A2410',
    noteText: '#FBBF24',
    pressed: '#1A2540',
  },
};

async function open(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open link', url);
  }
}

export default function HomeSurroundingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const c = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  const [draft, setDraft] = useState<HomeDraft>(() => {
    const p = getHeatProfile();
    return draftFromAnswers(getHomeAnswers(p), p.homeAnswered);
  });

  const answers = answersFromDraft(draft);
  const complete = isDraftComplete(draft);
  const coolingRisk = complete && hasCoolingRisk({ ...getHeatProfile(), ...answers });
  const checkInOn = getDailyCheckIn().enabled;

  const handleSave = () => {
    if (complete) saveHomeAnswers(answers);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
        <ChevronLeft size={24} color={c.accent} />
        <Text style={[styles.backText, { color: c.accent }]}>Back</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Home surroundings</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>
          Most heat deaths happen at home, often when the AC is off or broken. A few answers help HeatGuard look out for you.
        </Text>

        <HomeSurroundingsQuestions value={draft} onChange={setDraft} colors={c} />

        {coolingRisk && (
          <>
            {/* ── Check-in ─────────────────────────────────────────────────── */}
            {!checkInOn && (
              <Pressable
                onPress={() => { saveHomeAnswers(answers); router.push('/checkin/settings'); }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.callout,
                  { backgroundColor: pressed ? c.pressed : c.noteBg, borderColor: c.border, borderWidth },
                ]}
              >
                <BellRing size={24} color={c.text} />
                <View style={styles.flex1}>
                  <Text style={[styles.calloutTitle, { color: c.text }]}>Turn on daily check-ins</Text>
                  <Text style={[styles.calloutSub, { color: c.text }]}>
                    "Are you OK?" up to 3 times a day, with a quick home safety check.
                  </Text>
                </View>
                <ChevronRight size={20} color={c.text} />
              </Pressable>
            )}

            {/* ── Free cooling tips ────────────────────────────────────────── */}
            <View style={styles.sectionHead}>
              <Lightbulb size={18} color={c.muted} />
              <Text style={[styles.sectionLabel, { color: c.muted }]}>Free ways to stay cool</Text>
            </View>
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
              {COOLING_TIPS.map((t, i) => (
                <View
                  key={t.title}
                  style={[styles.tip, { borderBottomColor: c.divider, borderBottomWidth: i < COOLING_TIPS.length - 1 ? 1 : 0 }]}
                >
                  <Text style={[styles.tipTitle, { color: c.text }]}>{t.title}</Text>
                  <Text style={[styles.tipBody, { color: c.muted }]}>{t.body}</Text>
                </View>
              ))}
              <Pressable
                onPress={() => router.push('/map')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.inlineBtn, { borderTopColor: c.divider, backgroundColor: pressed ? c.pressed : 'transparent' }]}
              >
                <MapPin size={20} color={c.accent} />
                <Text style={[styles.inlineBtnText, { color: c.accent }]}>Find Cool Spots near you</Text>
              </Pressable>
            </View>

            {/* ── Arizona bill help ────────────────────────────────────────── */}
            <Text style={[styles.sectionLabel, { color: c.muted, marginTop: 8 }]}>Help with your power bill · Arizona</Text>
            <View style={[styles.note, { backgroundColor: c.noteBg }]}>
              <Text style={[styles.noteText, { color: c.noteText }]}>{AZ_SHUTOFF_NOTE}</Text>
            </View>
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
              {AZ_BILL_HELP.map((h, i) => (
                <View
                  key={h.title}
                  style={[styles.help, { borderBottomColor: c.divider, borderBottomWidth: i < AZ_BILL_HELP.length - 1 ? 1 : 0 }]}
                >
                  <Text style={[styles.tipTitle, { color: c.text }]}>{h.title}</Text>
                  <Text style={[styles.tipBody, { color: c.muted }]}>{h.detail}</Text>
                  <View style={styles.helpActions}>
                    <Pressable
                      onPress={() => open(h.url)}
                      accessibilityRole="link"
                      accessibilityLabel={`Open ${h.title} website`}
                      style={({ pressed }) => [styles.chip, { borderColor: c.border, borderWidth, backgroundColor: pressed ? c.pressed : c.card }]}
                    >
                      <ExternalLink size={16} color={c.accent} />
                      <Text style={[styles.chipText, { color: c.accent }]}>Website</Text>
                    </Pressable>
                    {h.phone && (
                      <Pressable
                        onPress={() => open(`tel:${h.phone!.replace(/[^0-9]/g, '')}`)}
                        accessibilityRole="button"
                        accessibilityLabel={`Call ${h.phone}`}
                        style={({ pressed }) => [styles.chip, { borderColor: c.border, borderWidth, backgroundColor: pressed ? c.pressed : c.card }]}
                      >
                        <Phone size={16} color={c.accent} />
                        <Text style={[styles.chipText, { color: c.accent }]}>{h.phone}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>
            <Text style={[styles.fine, { color: c.muted }]}>
              Programs and amounts change. HeatGuard isn't connected to these programs; check details with them directly.
            </Text>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleSave}
          accessibilityRole="button"
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.saveText, { color: c.onAccent }]}>{complete ? 'Save' : 'Done'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 17, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  flex1: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.3, marginTop: 8 },
  subtitle: { fontSize: 16, lineHeight: 23, marginTop: -4, marginBottom: 6 },

  callout: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, marginTop: 6 },
  calloutTitle: { fontSize: 17, fontWeight: '800' },
  calloutSub: { fontSize: 14, lineHeight: 19, marginTop: 2 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  card: { borderRadius: 16, overflow: 'hidden' },
  tip: { paddingHorizontal: 16, paddingVertical: 12, gap: 3 },
  tipTitle: { fontSize: 16, fontWeight: '800' },
  tipBody: { fontSize: 15, lineHeight: 21 },
  inlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, minHeight: 52, borderTopWidth: 1 },
  inlineBtnText: { fontSize: 16, fontWeight: '800' },

  note: { borderRadius: 12, padding: 12 },
  noteText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  help: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  helpActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 999 },
  chipText: { fontSize: 15, fontWeight: '800' },
  fine: { fontSize: 13, lineHeight: 19 },

  footer: { paddingHorizontal: 20, paddingTop: 8 },
  saveBtn: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 18, fontWeight: '800' },
});
