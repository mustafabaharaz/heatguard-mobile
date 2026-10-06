// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/components/brief/BriefHeroCard.tsx   (NEW FILE + NEW FOLDER)
// HeatGuard · Daily brief hero card (shared)
// The risk card from the top of the Daily brief: gradient by risk level,
// NWS heat category badge, headline, forecast line, a ring showing the
// risk level (1–4 of 4 — not a clinical score), and a calm personal note. Shown at the top of Home; tapping it opens app/risk.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { TriangleAlert, MapPin } from 'lucide-react-native';
import { getRiskColor, getRiskGradient, type DailyBrief } from '../../features/brief/briefEngine';
import { RISK_LABEL, NWS_LABEL } from '../../features/risk/riskEngine';

function ScoreRing({ score, color, label }: { score: number; color: string; label: string }) {
  const size = 160;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - score / 100);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill as object}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{ fontSize: 30, fontWeight: '700', color, maxWidth: 120, textAlign: 'center' }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {label}
          </Text>
          <Text style={{ fontSize: 11, color: '#94A3B8', letterSpacing: 1.5, marginTop: 2 }}>RISK LEVEL</Text>
          <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{Math.round(score / 25)} of 4</Text>
        </View>
      </View>
    </View>
  );
}

interface Props {
  brief: DailyBrief;
  style?: StyleProp<ViewStyle>;
  /** Optional location + current reading, shown centered under the ring */
  now?: { location: string; reading: string };
}

export default function BriefHeroCard({ brief, style, now }: Props) {
  const riskColor = getRiskColor(brief.riskLevel);
  const gradient = getRiskGradient(brief.riskLevel);
  return (
    <LinearGradient
      colors={[gradient[0], gradient[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.heroCard, style]}
    >
      <View style={styles.heroContent}>
        <View style={styles.heroLeft}>
          <View style={[styles.riskBadge, { backgroundColor: `${riskColor}25`, borderColor: `${riskColor}50` }]}>
            <Text style={[styles.riskBadgeText, { color: riskColor }]}>
              {(brief.nwsCategory && brief.nwsCategory !== 'none'
                ? `NWS · ${NWS_LABEL[brief.nwsCategory]}`
                : `${RISK_LABEL[brief.riskLevel] ?? 'High'} risk`
              ).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.heroHeadline}>{brief.headline}</Text>
          <Text style={styles.heroForecast}>{brief.forecastSummary}</Text>
        </View>
        <View style={styles.ringCol}>
          <ScoreRing score={brief.overallScore} color={riskColor} label={RISK_LABEL[brief.riskLevel] ?? 'High'} />
          {now && (
            <View style={styles.now}>
              <View style={styles.nowLoc}>
                <MapPin size={12} color="rgba(248,250,252,0.75)" />
                <Text style={styles.nowLocText} numberOfLines={1}>{now.location}</Text>
              </View>
              <Text style={styles.nowReading} numberOfLines={1} adjustsFontSizeToFit>{now.reading}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.personalNote}>
        <TriangleAlert size={15} color="#FBBF24" style={{ marginTop: 1 }} />
        <Text style={styles.personalNoteText}>{brief.personalRiskNote}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  heroCard: { borderRadius: 20, padding: 24, overflow: 'hidden' },
  heroContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  heroLeft: { flex: 1, marginRight: 16 },
  ringCol: { width: 160, alignItems: 'center' },
  now: { marginTop: 8, alignItems: 'center', gap: 2, maxWidth: 160 },
  nowLoc: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nowLocText: { color: 'rgba(248,250,252,0.75)', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  nowReading: { color: '#F8FAFC', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  riskBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 12,
  },
  riskBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  heroHeadline: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', lineHeight: 25, marginBottom: 8 },
  heroForecast: { color: 'rgba(248,250,252,0.7)', fontSize: 13, lineHeight: 18 },
  personalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  personalNoteText: { color: 'rgba(248,250,252,0.85)', fontSize: 13, lineHeight: 18, flex: 1 },
});
