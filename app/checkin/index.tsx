// ─────────────────────────────────────────────────────────────────────────────
// FILE: app/checkin/index.tsx   (NEW FILE)
// HeatGuard · Check-in
//  1. "Are you OK right now?"  →  I'm OK  /  I don't feel well
//  2. Safety check (flagged users or when turned on): water, medicine,
//     home cool, phone charged. A "no" shows one specific tip.
//  3. Done: "Share with my buddy" texts the results to heat buddies.
//  "I don't feel well" shows what to do now, 911, and texting contacts.
// Opened from check-in notifications, the Home card, and Profile.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X, CheckCircle2, Phone, MessageSquare, Users, MapPin, Snowflake, Send, ChevronRight, Settings2,
} from 'lucide-react-native';
import haptics from '../../src/utils/haptics';
import { useSettings } from '../../src/context/SettingsContext';
import {
  recordCheckIn, isSafetyCheckOn, formatNextCheckIn, getDailyCheckIn, type CheckInResult,
} from '../../src/features/checkin/dailyCheckIn';
import { shareWithBuddies, getBuddies } from '../../src/features/checkin/heatBuddy';
import { textContacts, call911 } from '../../src/features/emergency/emergencyMessaging';
import { getHeatProfile } from '../../src/features/profile/storage/profileStorage';
import { joinNames } from '../../src/features/profile/storage/dependentsStorage';
import {
  SAFETY_QUESTIONS, tipFor, UNWELL_GUIDANCE, type SafetyKey, type SafetyAnswer, type TipAction,
} from '../../src/content/homeSafety';

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
    btnDark: '#0A0A0A',
    onBtnDark: '#FFFFFF',
    ok: '#15803D',
    tipBg: '#FFF4CC',
    tipText: '#3D2E00',
    urgentBg: '#FDE2E2',
    urgentText: '#8A1414',
    danger: '#B91C1C',
    onDanger: '#FFFFFF',
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
    btnDark: '#38BDF8',
    onBtnDark: '#04121F',
    ok: '#4ADE80',
    tipBg: '#2A2410',
    tipText: '#FDE68A',
    urgentBg: '#2A1520',
    urgentText: '#FCA5A5',
    danger: '#F87171',
    onDanger: '#1A0505',
    pressed: '#1A2540',
  },
};

type Step = 'ask' | 'safety' | 'unwell' | 'done';

export default function CheckInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const c = isDark ? SKIN.dark : SKIN.light;
  const borderWidth = isDark ? 1 : 2;

  const profile = getHeatProfile();
  const safetyOn = isSafetyCheckOn();
  const firstName = profile.name.trim().split(' ')[0];

  const [step, setStep] = useState<Step>('ask');
  const [answers, setAnswers] = useState<Partial<Record<SafetyKey, SafetyAnswer>>>({});
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [shareState, setShareState] = useState<'idle' | 'sent' | 'cancelled'>('idle');
  const [busy, setBusy] = useState(false);

  const buddies = getBuddies();
  const allAnswered = SAFETY_QUESTIONS.every(q => answers[q.key]);
  const noCount = SAFETY_QUESTIONS.filter(q => answers[q.key] === 'no').length;

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const finish = async (ok: boolean, safety?: typeof answers) => {
    if (busy) return;
    setBusy(true);
    const r = await recordCheckIn({ ok, safety });
    setResult(r);
    setBusy(false);
    if (ok) {
      haptics.success();
      setStep('done');
    } else {
      haptics.warning();
      setStep('unwell');
    }
  };

  const onOK = () => {
    if (safetyOn) { haptics.selection(); setStep('safety'); }
    else finish(true);
  };

  const answer = (key: SafetyKey, v: SafetyAnswer) => {
    haptics.selection();
    setAnswers(prev => ({ ...prev, [key]: v }));
  };

  const share = async () => {
    if (!result) return;
    const r = await shareWithBuddies(result);
    if (r === 'sent') { setShareState('sent'); haptics.success(); }
    else if (r === 'cancelled') setShareState('cancelled');
  };

  const runAction = (a: TipAction) => {
    if (a === 'coolSpots') router.push('/map');
    if (a === 'billHelp') router.push('/profile/home');
  };

  // ── Shared pieces ───────────────────────────────────────────────────────────
  const solid = (label: string, onPress: () => void, opts: { bg?: string; fg?: string; Icon?: typeof Send; disabled?: boolean } = {}) => (
    <Pressable
      onPress={onPress}
      disabled={opts.disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!opts.disabled }}
      style={({ pressed }) => [
        styles.bigBtn,
        { backgroundColor: opts.bg ?? c.btnDark, opacity: opts.disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}
    >
      {opts.Icon && <opts.Icon size={22} color={opts.fg ?? c.onBtnDark} />}
      <Text style={[styles.bigBtnText, { color: opts.fg ?? c.onBtnDark }]}>{label}</Text>
    </Pressable>
  );

  const outline = (label: string, onPress: () => void, Icon?: typeof Send, color?: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.bigBtn,
        { backgroundColor: pressed ? c.pressed : c.card, borderColor: color ?? c.border, borderWidth },
      ]}
    >
      {Icon && <Icon size={22} color={color ?? c.text} />}
      <Text style={[styles.bigBtnText, { color: color ?? c.text }]}>{label}</Text>
    </Pressable>
  );

  const buddyBlock = () =>
    buddies.length ? (
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
        <View style={styles.cardHead}>
          <Users size={22} color={c.text} />
          <Text style={[styles.cardTitle, { color: c.text }]}>
            {shareState === 'sent' ? `Sent to ${joinNames(buddies.map(b => b.name))}` : 'Let your buddy know'}
          </Text>
        </View>
        {shareState !== 'sent' && (
          <>
            <Text style={[styles.cardBody, { color: c.muted }]}>
              Text {joinNames(buddies.map(b => b.name))} your check-in results. You'll see the message before it sends.
            </Text>
            {solid(shareState === 'cancelled' ? 'Try again' : 'Share with my buddy', share, { Icon: Send, bg: c.accent, fg: c.onAccent })}
          </>
        )}
      </View>
    ) : (
      <Pressable
        onPress={() => router.push('/emergency/contacts')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, styles.cardRow, { backgroundColor: pressed ? c.pressed : c.card, borderColor: c.border, borderWidth }]}
      >
        <Users size={22} color={c.text} />
        <View style={styles.flex1}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Add a heat buddy</Text>
          <Text style={[styles.cardBody, { color: c.muted }]}>Pick an emergency contact to share your check-ins with.</Text>
        </View>
        <ChevronRight size={20} color={c.muted} />
      </Pressable>
    );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.topBar}>
        <Text style={[styles.kicker, { color: c.muted }]}>Check-in</Text>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.closeBtn}>
          <X size={26} color={c.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {/* ── 1. Are you OK? ─────────────────────────────────────────────── */}
        {step === 'ask' && (
          <>
            <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
              {firstName ? `${firstName}, are you OK right now?` : 'Are you OK right now?'}
            </Text>
            <Text style={[styles.subtitle, { color: c.muted }]}>
              {safetyOn ? 'Then four quick questions about your home.' : 'One tap lets HeatGuard know you are safe.'}
            </Text>
            <View style={styles.stack}>
              {solid("I'm OK", onOK, { Icon: CheckCircle2, disabled: busy })}
              {outline("I don't feel well", () => finish(false), undefined, c.danger)}
            </View>
          </>
        )}

        {/* ── 2. Safety check ────────────────────────────────────────────── */}
        {step === 'safety' && (
          <>
            <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Quick safety check</Text>
            <Text style={[styles.subtitle, { color: c.muted }]}>Right now, do you have…</Text>

            {SAFETY_QUESTIONS.map(q => {
              const a = answers[q.key];
              const tip = a === 'no' ? tipFor(q.key, profile) : null;
              const opts: { label: string; v: SafetyAnswer }[] = [
                { label: 'Yes', v: 'yes' },
                { label: 'No', v: 'no' },
                ...(q.allowNA ? [{ label: "Don't take any", v: 'na' as SafetyAnswer }] : []),
              ];
              return (
                <View key={q.key} style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
                  <Text style={[styles.question, { color: c.text }]}>{q.question}</Text>
                  <View style={styles.options} accessibilityRole="radiogroup">
                    {opts.map(o => {
                      const active = a === o.v;
                      return (
                        <Pressable
                          key={o.v}
                          onPress={() => answer(q.key, o.v)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: active }}
                          accessibilityLabel={`${q.question} ${o.label}`}
                          style={({ pressed }) => [
                            styles.option,
                            {
                              flex: o.v === 'na' ? 1.6 : 1,
                              backgroundColor: active ? c.btnDark : pressed ? c.pressed : c.card,
                              borderColor: active ? c.btnDark : c.border,
                              borderWidth,
                            },
                          ]}
                        >
                          <Text style={[styles.optionText, { color: active ? c.onBtnDark : c.text }]} numberOfLines={1} adjustsFontSizeToFit>
                            {o.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {tip && (
                    <View style={[styles.tip, { backgroundColor: c.tipBg }]} accessibilityLiveRegion="polite">
                      <Text style={[styles.tipText, { color: c.tipText }]}>{tip.text}</Text>
                      {tip.action && (
                        <Pressable
                          onPress={() => runAction(tip.action)}
                          accessibilityRole="button"
                          style={styles.tipLink}
                        >
                          <Text style={[styles.tipLinkText, { color: c.tipText }]}>
                            {tip.action === 'coolSpots' ? 'Find Cool Spots near you' : 'See bill help & cooling tips'}
                          </Text>
                          <ChevronRight size={18} color={c.tipText} />
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            <View style={styles.stack}>
              {solid('Finish check-in', () => finish(true, answers), { disabled: !allAnswered || busy })}
              <Pressable onPress={() => finish(true)} accessibilityRole="button" style={styles.textBtn}>
                <Text style={[styles.textBtnText, { color: c.muted }]}>Skip questions, I'm OK</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* ── Not feeling well ───────────────────────────────────────────── */}
        {step === 'unwell' && (
          <>
            <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">Let's get you cooled down</Text>
            <View style={[styles.card, { backgroundColor: c.urgentBg, borderColor: c.danger, borderWidth }]} accessibilityRole="alert">
              <Text style={[styles.urgentText, { color: c.urgentText }]}>{UNWELL_GUIDANCE.call911}</Text>
              {solid('Call 911', call911, { Icon: Phone, bg: c.danger, fg: c.onDanger })}
            </View>

            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderWidth }]}>
              <Text style={[styles.cardTitle, { color: c.text }]}>Do this now</Text>
              {UNWELL_GUIDANCE.steps.map((s, i) => (
                <View key={s} style={styles.stepRow}>
                  <View style={[styles.stepNum, { backgroundColor: c.btnDark }]}>
                    <Text style={[styles.stepNumText, { color: c.onBtnDark }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: c.text }]}>{s}</Text>
                </View>
              ))}
            </View>

            <View style={styles.stack}>
              {outline('Text my emergency contacts', () => { textContacts("I'm not feeling well in the heat and may need help."); }, MessageSquare)}
              {buddies.length > 0 && shareState !== 'sent' && outline('Share check-in with my buddy', share, Users)}
              {outline('Start cool-down timer', () => router.push('/cooldown/timer'), Snowflake)}
              {outline('Find Cool Spots', () => router.push('/map'), MapPin)}
            </View>
          </>
        )}

        {/* ── 3. Done ────────────────────────────────────────────────────── */}
        {step === 'done' && (
          <>
            <View style={styles.doneHead}>
              <CheckCircle2 size={56} color={c.ok} />
              <Text style={[styles.title, { color: c.text, textAlign: 'center' }]} accessibilityRole="header">
                You're checked in
              </Text>
              <Text style={[styles.subtitle, { color: c.muted, textAlign: 'center' }]}>
                {noCount > 0
                  ? `Take care of the ${noCount === 1 ? 'item' : `${noCount} items`} you marked "no" when you can.`
                  : 'Thanks. Stay cool and keep water close.'}
                {getDailyCheckIn().enabled && formatNextCheckIn() ? ` Next check-in: ${formatNextCheckIn()}.` : ''}
              </Text>
            </View>

            {buddyBlock()}

            {!getDailyCheckIn().enabled && (
              <Pressable
                onPress={() => router.push('/checkin/settings')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.card, styles.cardRow, { backgroundColor: pressed ? c.pressed : c.card, borderColor: c.border, borderWidth }]}
              >
                <Settings2 size={22} color={c.text} />
                <View style={styles.flex1}>
                  <Text style={[styles.cardTitle, { color: c.text }]}>Get reminded</Text>
                  <Text style={[styles.cardBody, { color: c.muted }]}>Pick 1–3 check-in times a day.</Text>
                </View>
                <ChevronRight size={20} color={c.muted} />
              </Pressable>
            )}

            {solid('Done', close)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 52 },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  closeBtn: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  content: { paddingHorizontal: 20, gap: 14 },
  flex1: { flex: 1 },
  stack: { gap: 10, marginTop: 6 },

  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.4, lineHeight: 36 },
  subtitle: { fontSize: 17, lineHeight: 24 },

  bigBtn: {
    minHeight: 60, borderRadius: 14, flexDirection: 'row', gap: 10,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  bigBtnText: { fontSize: 19, fontWeight: '800' },
  textBtn: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  textBtnText: { fontSize: 16, fontWeight: '700', textDecorationLine: 'underline' },

  card: { borderRadius: 16, padding: 16, gap: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '800', flexShrink: 1 },
  cardBody: { fontSize: 15, lineHeight: 21 },

  question: { fontSize: 18, fontWeight: '800', lineHeight: 24 },
  options: { flexDirection: 'row', gap: 8 },
  option: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  optionText: { fontSize: 17, fontWeight: '800' },
  tip: { borderRadius: 12, padding: 12, gap: 6 },
  tipText: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  tipLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  tipLinkText: { fontSize: 15, fontWeight: '800', textDecorationLine: 'underline' },

  urgentText: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontSize: 15, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 17, lineHeight: 24 },

  doneHead: { alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 6 },
});
