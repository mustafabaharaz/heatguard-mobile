// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Brand mark
// The app icon's artwork (shade arc sheltering a desert sun, heat wave below),
// drawn with react-native-svg so it stays crisp at any size. `size` = height.
// Source artwork: assets/icon-source.svg
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Path, G } from 'react-native-svg';

interface Props {
  size?: number;
  /** 'onDark' uses the lighter glacier arc from the app icon. */
  variant?: 'onLight' | 'onDark';
}

export default function HeatGuardMark({ size = 32, variant = 'onLight' }: Props) {
  // Cropped to the artwork's bounds within the 1024 canvas
  const viewBox = '120 250 784 560';
  const width = size * (784 / 560);
  const arc = variant === 'onDark' ? '#8ECAE6' : '#4A9CC4';

  return (
    <Svg width={width} height={size} viewBox={viewBox} accessibilityLabel="HeatGuard logo">
      <Defs>
        <LinearGradient id="hgSun" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F6B26B" />
          <Stop offset="1" stopColor="#E63946" />
        </LinearGradient>
      </Defs>
      <G transform="translate(0,-44)">
        <Path d="M 292 690 A 220 220 0 0 1 732 690 Z" fill="url(#hgSun)" />
        <Path
          d="M 172 690 A 340 340 0 0 1 852 690"
          fill="none"
          stroke={arc}
          strokeWidth={76}
          strokeLinecap="round"
        />
        <Path
          d="M 352 800 q 40 -34 80 0 t 80 0 t 80 0 t 80 0"
          fill="none"
          stroke="#E76F51"
          strokeWidth={38}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}
