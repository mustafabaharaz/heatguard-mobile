// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/risk/index.tsx   (NEW FILE + NEW FOLDER)
// HeatGuard · Your heat risk today (how it's measured)
// Opened by tapping the risk card on Home. Explains, in plain words:
//   1. Today's heat — peak feels-like and its National Weather Service
//      heat index category
//   2. You — whether a CDC higher-risk group raises the level one step
//      (groups listed only if the user taps "See why")
//   3. The four levels and what each means
//   4. Sources, with links, plus an honest disclaimer
// Logic lives in features/risk/riskEngine. (The Daily brief page was removed;
// Home's risk card is the summary, this page is the detail.)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronDown, ChevronUp, Thermometer, UserRound, Layers, BookOpen, ExternalLink, ArrowRight, Info,
} from 'lucide-react-native';
import { useSettings } from '../../src/context/SettingsContext';
import { useWeather } from '../../src/services/weather/useWeather';
import { fToC } from '../../src/services/weather/weatherStore';
import { getHeatProfile, type HeatProfile } from '../../src/features/profile/storage/profileStorage';
import {
  assessToday, LEVELS, RISK_LABEL, NWS_LABEL, NWS_BANDS, GROUP_LABEL, LEVEL_MEANING, type RiskLevel,
} from '../../src/features/risk/riskEngine';
import { getRiskColor } from '../../src/features/brief/briefEngine';
import { RISK_SOURCES, HEATRISK_LOOKUP_URL } from '../../src/content/riskSources';

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
    rowActive: '#FFF4CC',
    noteBg: '#EAF0FF',
    pressed: '#ECECE6',
  },
  dark: {
    bg: '#0B1220',
    card: '#131C2E',
    border: '#3A4C78',
    divider: '#24314F',
    text: '#F1F5F9',
    muted: '#A3B1C9',
    accent: '#38BDF8',
    onAccent: '#04121F',
    rowActive: '#1A2540',
    noteBg: '#13263D',
    pressed: '#1A2540',
  },
};

async function open(url: string) {
  try { await Linking.openURL(url); } catch { Alert.alert('Could not open link', url); }
}

export default function RiskExplainerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, formatTemp } = useSettings();
  const c = isDark ? SKIN.dark : SKIN.light;
  const bw = isDark ? 1.5 : 2;

  const { snapshot } = useWeather();
  const [profile, setProfile] = useState<HeatProfile>(getHeatProfile());
  const [showGroups, setShowGroups] = useState(false);
  useFocusEffect(useCallback(() => { setProfile(getHeatProfile()); }, []));

  const risk = assessToday(snapshot, profile);
  const fmtF = (f: number) => formatTemp(Math.round(fToC(f)));

  const card = [styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth: bw }];

  const SectionHead = ({ n, title, Icon }: { n: string; title: string; Icon: typeof Info }) => (
    <View style={styles.sectionHead}>
      <View style={[styles.stepNum, { backgroundColor: c.text }]}>
        <Text style={[styles.stepNumText, { color: c.bg }]}>{n}</Text>
      </View>
      <Icon size={20} color={c.text} />
      <Text style={[styles.sectionTitle, { color: c.text }]} accessibilityRole="header">{title}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
        <ChevronLeft size={24} color={c.accent} />
        <Text style={[styles.backText, { color: c.accent }]}>Back</Text>
      </Pressable>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Your heat risk today</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>
          How HeatGuard decides your level, in two steps, using National Weather Service and CDC guidance.
        </Text>

        {!risk ? (
          <View style={card}>
            <Text style={[styles.body, { color: c.text }]}>
              Today's forecast hasn't loaded yet. Pull down on Home to refresh, then come back.
            </Text>
          </View>
        ) : (
          <>
            {/* ── 1. Today's heat ──────────────────────────────────────────── */}
            <View style={card}>
              <SectionHead n="1" title="Today's heat" Icon={Thermometer} />
              <Text style={[styles.body, { color: c.text }]}>
                Today's hottest point should feel like <Text style={styles.strong}>{fmtF(risk.feelsLikeF)}</Text>.
                {risk.nws === 'none'
                  ? ' That is below the National Weather Service caution range.'
                  : <> The National Weather Service calls that <Text style={styles.strong}>{NWS_LABEL[risk.nws]}</Text>.</>}
              </Text>
              {risk.nws !== 'none' && (
                <Text style={[styles.body, { color: c.muted }]}>
                  {NWS_BANDS.find(b => b.category === risk.nws)?.meaning}
                </Text>
              )}
              <Text style={[styles.body, { color: c.text }]}>
                Weather alone puts today at <Text style={styles.strong}>{RISK_LABEL[risk.weatherLevel]}</Text>.
              </Text>
              {snapshot && (
                <Text style={[styles.small, { color: c.muted }]}>
                  Right now: {formatTemp(Math.round(fToC(snapshot.current.tempF)))}, feels like {formatTemp(Math.round(fToC(snapshot.current.feelsLikeF)))}.
                  Feels-like values assume shade; in direct sun it can feel up to 15°F hotter.
                </Text>
              )}
            </View>

            {/* ── 2. You ───────────────────────────────────────────────────── */}
            <View style={card}>
              <SectionHead n="2" title="You" Icon={UserRound} />
              {risk.groups.length ? (
                <>
                  <Text style={[styles.body, { color: c.text }]}>
                    Your profile puts you in a group the CDC says heat affects more. People in these groups
                    need to act at lower temperatures than everyone else, so HeatGuard raises your level one step.
                  </Text>
                  <View style={[styles.stepRow, { backgroundColor: c.rowActive }]}>
                    <Text style={[styles.stepText, { color: c.text }]}>{RISK_LABEL[risk.weatherLevel]}</Text>
                    <ArrowRight size={18} color={c.text} />
                    <Text style={[styles.stepText, styles.strong, { color: c.text }]}>{RISK_LABEL[risk.level]}</Text>
                    {!risk.stepped && (
                      <Text style={[styles.small, { color: c.muted, flex: 1 }]}>(already the highest level)</Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => setShowGroups(v => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showGroups }}
                    style={styles.toggle}
                  >
                    <Text style={[styles.toggleText, { color: c.accent }]}>{showGroups ? 'Hide why' : 'See why'}</Text>
                    {showGroups ? <ChevronUp size={18} color={c.accent} /> : <ChevronDown size={18} color={c.accent} />}
                  </Pressable>
                  {showGroups && (
                    <View style={styles.groupList}>
                      {risk.groups.map(g => (
                        <Text key={g} style={[styles.body, { color: c.text }]}>•  {GROUP_LABEL[g]}</Text>
                      ))}
                      <Pressable onPress={() => router.push('/(tabs)/profile')} accessibilityRole="button" style={styles.toggle}>
                        <Text style={[styles.toggleText, { color: c.accent }]}>Something changed? Update your profile</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              ) : (
                <Text style={[styles.body, { color: c.text }]}>
                  Nothing in your profile puts you in a CDC higher-risk group, so your level matches the weather.
                  If your health, age, or home cooling changes, update your profile and this will follow.
                </Text>
              )}
            </View>

            {/* ── 3. The four levels ───────────────────────────────────────── */}
            <View style={card}>
              <SectionHead n="3" title="The four levels" Icon={Layers} />
              {LEVELS.map((lvl: RiskLevel) => {
                const active = lvl === risk.level;
                return (
                  <View
                    key={lvl}
                    style={[styles.levelRow, active && { backgroundColor: c.rowActive, borderColor: c.border, borderWidth: bw }]}
                    accessibilityLabel={`${RISK_LABEL[lvl]}${active ? ', your level today' : ''}. ${LEVEL_MEANING[lvl]}`}
                  >
                    <View style={[styles.dot, { backgroundColor: getRiskColor(lvl) }]} />
                    <View style={styles.flex1}>
                      <Text style={[styles.levelName, { color: c.text }]}>
                        {RISK_LABEL[lvl]}{active ? '  · today' : ''}
                      </Text>
                      <Text style={[styles.small, { color: c.muted }]}>
                        {lvl === 'low' ? 'Feels like under 80°F' : lvl === 'moderate' ? 'Feels like 80–89°F' : lvl === 'high' ? 'Feels like 90–102°F' : 'Feels like 103°F or more'}
                        {' · '}{LEVEL_MEANING[lvl]}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <Text style={[styles.small, { color: c.muted }]}>
                In a higher-risk group? Your level is one step higher than the weather alone.
              </Text>
            </View>
          </>
        )}

        {/* ── Sources ──────────────────────────────────────────────────────── */}
        <View style={card}>
          <View style={styles.sectionHead}>
            <BookOpen size={20} color={c.text} />
            <Text style={[styles.sectionTitle, { color: c.text }]} accessibilityRole="header">Where this comes from</Text>
          </View>
          {RISK_SOURCES.map((s, i) => (
            <Pressable
              key={s.title}
              onPress={() => open(s.url)}
              accessibilityRole="link"
              accessibilityLabel={`${s.title}, ${s.who}. Opens website`}
              style={({ pressed }) => [
                styles.source,
                { borderTopColor: c.divider, borderTopWidth: i ? 1 : 0, backgroundColor: pressed ? c.pressed : 'transparent' },
              ]}
            >
              <View style={styles.flex1}>
                <Text style={[styles.sourceTitle, { color: c.text }]}>{s.title}</Text>
                <Text style={[styles.small, { color: c.muted }]}>{s.who}</Text>
                <Text style={[styles.small, { color: c.text }]}>{s.usedFor}</Text>
              </View>
              <ExternalLink size={18} color={c.accent} />
            </Pressable>
          ))}
        </View>

        {/* ── Honest note ──────────────────────────────────────────────────── */}
        <View style={[styles.note, { backgroundColor: c.noteBg }]}>
          <Info size={20} color={c.text} />
          <Text style={[styles.small, styles.flex1, { color: c.text }]}>
            HeatGuard's levels follow the National Weather Service heat categories. Raising the level one step for
            higher-risk groups is our simplification of NWS and CDC guidance, not a medical measurement. It's an
            estimate to help you plan your day, not medical advice. If you feel unwell in the heat, act on how you
            feel, not on this level.
          </Text>
        </View>

        <Pressable onPress={() => open(HEATRISK_LOOKUP_URL)} accessibilityRole="link" style={styles.toggle}>
          <Text style={[styles.toggleText, { color: c.accent }]}>Check the official NWS HeatRisk for your ZIP code</Text>
          <ExternalLink size={16} color={c.accent} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, alignSelf: 'flex-start' },
  backText: { fontSize: 17, fontWeight: '600' },
  content: { paddingHorizontal: 20, gap: 14 },
  flex1: { flex: 1 },
  strong: { fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.3, marginTop: 8 },
  subtitle: { fontSize: 16, lineHeight: 23, marginTop: -6 },

  card: { borderRadius: 16, padding: 16, gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 13, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '800', flexShrink: 1 },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 14, lineHeight: 20 },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  stepText: { fontSize: 17 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  toggleText: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  groupList: { gap: 4 },

  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 10 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  levelName: { fontSize: 16, fontWeight: '800' },

  source: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  sourceTitle: { fontSize: 15, fontWeight: '800' },

  note: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 14 },
});
