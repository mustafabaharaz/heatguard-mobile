import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getRiskColor,
  getRiskGradient,
  type DailyBrief,
} from '../../features/brief/briefEngine';

const COLORS = {
  surface: '#1A2942',
  border: '#2D3F5C',
  text: { primary: '#F8FAFC', secondary: '#94A3B8', tertiary: '#64748B' },
};

interface Props {
  brief: DailyBrief | null;
}

export function DailyBriefCard({ brief }: Props) {
  if (!brief) {
    return (
      <TouchableOpacity
        style={styles.emptyCard}
        onPress={() => router.push('/brief')}
        activeOpacity={0.75}
      >
        <Text style={styles.emptyIcon}>☀</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.emptyTitle}>Daily Safety Brief</Text>
          <Text style={styles.emptySubtitle}>Tap to generate your personalized daily brief</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  const riskColor = getRiskColor(brief.riskLevel);
  const gradient = getRiskGradient(brief.riskLevel);

  return (
    <TouchableOpacity
      onPress={() => router.push('/brief')}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={[gradient[0], gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.cardLabel}>DAILY BRIEF</Text>
            <Text style={styles.cardHeadline}>{brief.headline}</Text>
          </View>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreValue, { color: riskColor }]}>
              {brief.overallScore}
            </Text>
            <Text style={styles.scoreLabel}>risk</Text>
          </View>
        </View>

        <Text style={styles.forecastText}>{brief.forecastSummary}</Text>

        <View style={styles.pillsRow}>
          {brief.topRecommendations.slice(0, 2).map((rec, i) => (
            <View key={i} style={styles.pill}>
              <Text style={styles.pillText} numberOfLines={1}>{rec}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
          <Text style={[styles.riskText, { color: riskColor }]}>
            {brief.riskLevel.charAt(0).toUpperCase() + brief.riskLevel.slice(1)} Risk
          </Text>
          <Text style={styles.footerSep}>·</Text>
          <Text style={styles.footerRight}>{brief.forecastHighF}°F High</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.chevronWhite}>›</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 14,
  },
  emptyIcon: { fontSize: 24 },
  emptyTitle: { color: COLORS.text.primary, fontSize: 15, fontWeight: '600' },
  emptySubtitle: { color: COLORS.text.secondary, fontSize: 12, marginTop: 3 },
  chevron: { color: COLORS.text.tertiary, fontSize: 20 },

  card: { borderRadius: 18, padding: 18, gap: 14, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerLeft: { flex: 1, gap: 5 },
  cardLabel: {
    color: 'rgba(248,250,252,0.5)',
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
  },
  cardHeadline: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  scoreCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  scoreValue: { fontSize: 18, fontWeight: '700' },
  scoreLabel: { color: 'rgba(248,250,252,0.5)', fontSize: 9, letterSpacing: 0.5 },
  forecastText: { color: 'rgba(248,250,252,0.75)', fontSize: 13, lineHeight: 18 },
  pillsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  pillText: { color: 'rgba(248,250,252,0.75)', fontSize: 11 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  riskDot: { width: 7, height: 7, borderRadius: 3.5 },
  riskText: { fontSize: 12, fontWeight: '600' },
  footerSep: { color: 'rgba(248,250,252,0.3)', fontSize: 12 },
  footerRight: { color: 'rgba(248,250,252,0.5)', fontSize: 12 },
  chevronWhite: { color: 'rgba(248,250,252,0.5)', fontSize: 18 },
});
