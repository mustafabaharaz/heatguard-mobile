// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/onboarding/index.tsx
// HeatGuard · Onboarding
// Three short intro slides → "Who are you protecting?" → "Your home" (only
// for older adults, people living alone, or with a health condition) →
// required safety & medical acknowledgment. Shown on first launch (and again
// if the disclaimer version changes).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HeatGuardMark from '../../src/components/brand/HeatGuardMark';
import HouseholdQuestions from '../../src/components/profile/HouseholdQuestions';
import HomeSurroundingsQuestions, {
  answersFromDraft, draftFromAnswers, isDraftComplete, type HomeDraft,
} from '../../src/components/profile/HomeSurroundingsQuestions';
import { DISCLAIMER_POINTS, DISCLAIMER_TITLE } from '../../src/content/disclaimer';
import { acceptDisclaimer } from '../../src/features/settings/appPrefs';
import {
  getHeatProfile,
  getHouseholdAnswers,
  saveHouseholdAnswers,
  getHomeAnswers,
  saveHomeAnswers,
  isHomeVulnerable,
  type HouseholdAnswers,
} from '../../src/features/profile/storage/profileStorage';

const COLORS = {
  ocean: '#1D3557',
  glacier: '#8ECAE6',
  ember: '#E76F51',
  lava: '#E63946',
  accent: '#0B4FD6',
  text: '#1D3557',
  textSecondary: '#4B5563',
  border: '#E5E7EB',
  surface: '#F9FAFB',
  white: '#FFFFFF',
  selectedBg: '#EAF0FF',
};

const HOUSEHOLD_COLORS = {
  text: COLORS.text,
  muted: COLORS.textSecondary,
  card: COLORS.white,
  border: '#D1D5DB',
  accent: COLORS.accent,
  onAccent: COLORS.white,
  selectedBg: COLORS.selectedBg,
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SLIDES: { icon: IconName; color: string; title: string; body: string }[] = [
  {
    icon: 'thermometer-outline',
    color: COLORS.ember,
    title: 'Know the heat where you are',
    body: 'Live local conditions and a 5-day forecast, with risk based on how hot it actually feels.',
  },
  {
    icon: 'person-circle-outline',
    color: COLORS.ocean,
    title: 'A plan made for you',
    body: 'Add your age, health, and activity level to get personal risk levels, safe outdoor windows, and a daily water target.',
  },
  {
    icon: 'call-outline',
    color: COLORS.lava,
    title: 'Help with one hold',
    body: 'Press and hold the red SOS button to call 911 or text your emergency contacts your location. Add your contacts in Profile.',
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const [household, setHousehold] = useState<HouseholdAnswers>(() => getHouseholdAnswers());
  const [home, setHome] = useState<HomeDraft>(() => {
    const p = getHeatProfile();
    return draftFromAnswers(getHomeAnswers(p), p.homeAnswered);
  });

  // "Your home" page only for older adults, living alone, or health conditions
  const showHome = isHomeVulnerable({ ...getHeatProfile(), ...household });

  const householdIndex = SLIDES.length;                     // after the intro slides
  const homeIndex = showHome ? SLIDES.length + 1 : -1;
  const disclaimerIndex = SLIDES.length + (showHome ? 2 : 1); // last page
  const onHousehold = index === householdIndex;
  const onHome = index === homeIndex;
  const onDisclaimer = index === disclaimerIndex;
  const pageCount = disclaimerIndex + 1;

  const goTo = (i: number) => {
    setIndex(i);
    scrollRef.current?.scrollTo({ x: width * i, animated: true });
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const handleAccept = () => {
    saveHouseholdAnswers(household);
    if (showHome && isDraftComplete(home)) saveHomeAnswers(answersFromDraft(home));
    acceptDisclaimer();
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="dark" />

      <View style={styles.topBar}>
        <HeatGuardMark size={26} />
        {index < householdIndex && (
          <TouchableOpacity
            onPress={() => goTo(householdIndex)}
            style={styles.skipButton}
            accessibilityRole="button"
            accessibilityLabel="Skip intro"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pager}
      >
        {SLIDES.map(slide => (
          <View key={slide.title} style={[styles.page, { width }]}>
            <View style={[styles.iconCircle, { backgroundColor: slide.color + '1A' }]}>
              <Ionicons name={slide.icon} size={64} color={slide.color} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}

        {/* Who are you protecting? */}
        <ScrollView style={{ width }} contentContainerStyle={styles.formPage}>
          <Text style={styles.formTitle}>Who are you protecting?</Text>
          <Text style={styles.formIntro}>
            Tap everything that fits. HeatGuard puts the right tools on your home screen. You can change this anytime in Profile.
          </Text>
          <HouseholdQuestions value={household} onChange={setHousehold} colors={HOUSEHOLD_COLORS} />
        </ScrollView>

        {/* Your home (vulnerable households only) */}
        {showHome && (
          <ScrollView style={{ width }} contentContainerStyle={styles.formPage}>
            <Text style={styles.formTitle}>Your home</Text>
            <Text style={styles.formIntro}>
              Most heat deaths happen at home. Tell us about your cooling so HeatGuard can look out for you. You can skip this.
            </Text>
            <HomeSurroundingsQuestions value={home} onChange={setHome} colors={HOUSEHOLD_COLORS} />
          </ScrollView>
        )}

        {/* Safety & medical acknowledgment */}
        <ScrollView style={{ width }} contentContainerStyle={styles.formPage}>
          <Text style={styles.formTitle}>{DISCLAIMER_TITLE}</Text>
          <Text style={styles.formIntro}>Please read this once. It matters for your safety.</Text>
          {DISCLAIMER_POINTS.map(point => (
            <View key={point.text} style={styles.point}>
              <Ionicons name={point.icon as IconName} size={22} color={COLORS.ocean} style={styles.pointIcon} />
              <Text style={styles.pointText}>{point.text}</Text>
            </View>
          ))}
        </ScrollView>
      </ScrollView>

      <View style={styles.dots} accessibilityElementsHidden>
        {Array.from({ length: pageCount }).map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        {onDisclaimer ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleAccept}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="I understand. Continue to HeatGuard"
          >
            <Text style={styles.primaryButtonText}>I understand</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => goTo(index + 1)}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              {onHome && !isDraftComplete(home) ? 'Skip for now' : onHousehold || onHome ? 'Continue' : 'Next'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    minHeight: 52,
  },
  skipButton: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '500' },
  pager: { flex: 1 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 14 },
  body: { fontSize: 17, lineHeight: 26, color: COLORS.textSecondary, textAlign: 'center', maxWidth: 360 },
  formPage: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  formTitle: { fontSize: 28, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  formIntro: { fontSize: 16, lineHeight: 23, color: COLORS.textSecondary, marginBottom: 20 },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  pointIcon: { marginRight: 12, marginTop: 1 },
  pointText: { flex: 1, fontSize: 15, lineHeight: 22, color: COLORS.text },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive: { width: 24, backgroundColor: COLORS.ocean },
  footer: { paddingHorizontal: 24 },
  primaryButton: {
    backgroundColor: COLORS.ocean,
    minHeight: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: COLORS.white, fontSize: 17, fontWeight: '600' },
});
