import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';


interface SkeletonProps {
  width?: number;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Single shimmer skeleton block.
 * Animates a highlight sweep from left to right.
 * Use SkeletonCard for full-card loading states.
 */
const Skeleton: React.FC<SkeletonProps> = ({
  width = 300,
  height = 16,
  borderRadius = 8,
  style,
}) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E5E7EB',
          opacity,
        },
        style,
      ]}
    />
  );
};

// ─── Preset Compositions ────────────────────────────────────────────────────

/** Loading skeleton for the main thermal card on the dashboard */
export const SkeletonThermalCard: React.FC = () => (
  <View style={skStyles.card}>
    <Skeleton width={120} height={12} style={{ marginBottom: 12 }} />
    <Skeleton width={80} height={48} borderRadius={8} style={{ marginBottom: 8 }} />
    <Skeleton width={160} height={12} />
  </View>
);

/** Loading skeleton for a standard info card */
export const SkeletonInfoCard: React.FC = () => (
  <View style={skStyles.card}>
    <View style={skStyles.row}>
      <Skeleton width={36} height={36} borderRadius={18} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width={180} height={14} style={{ marginBottom: 8 }} />
        <Skeleton width={120} height={11} />
      </View>
    </View>
    <Skeleton width={300} height={11} style={{ marginTop: 16 }} />
    <Skeleton width={240} height={11} style={{ marginTop: 6 }} />
  </View>
);

/** Loading skeleton for a community post row */
export const SkeletonPostRow: React.FC = () => (
  <View style={skStyles.postRow}>
    <Skeleton width={40} height={40} borderRadius={20} />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Skeleton width={150} height={13} style={{ marginBottom: 8 }} />
      <Skeleton width={270} height={11} style={{ marginBottom: 5 }} />
      <Skeleton width={210} height={11} />
    </View>
  </View>
);

/** Loading skeleton for an intelligence forecast row */
export const SkeletonForecastRow: React.FC = () => (
  <View style={skStyles.forecastRow}>
    <Skeleton width={50} height={50} borderRadius={8} />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Skeleton width={120} height={13} style={{ marginBottom: 8 }} />
      <Skeleton width={195} height={11} />
    </View>
    <Skeleton width={48} height={28} borderRadius={14} />
  </View>
);

const skStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
});

export default Skeleton;
