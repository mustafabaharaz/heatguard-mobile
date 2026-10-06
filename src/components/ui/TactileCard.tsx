// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/components/ui/TactileCard.tsx   (NEW FILE)
// HeatGuard · Bold tactile card
// A card that looks like a physical button: a solid "ledge" sits behind it,
// offset down and to the right. On press the face sinks into the ledge,
// with a light haptic tap. Use for anything on Home that opens or does
// something. High Sun: black outline + black ledge. Night Shift: softer
// navy edge (pass the skin's colors).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  Pressable, View, StyleSheet, type StyleProp, type ViewStyle, type AccessibilityRole,
} from 'react-native';
import haptics from '../../utils/haptics';

export const LEDGE_X = 4;
export const LEDGE_Y = 5;

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  /** Card face background */
  faceColor: string;
  /** Outline color */
  borderColor: string;
  /** Ledge (the "depth") color */
  ledgeColor: string;
  borderWidth?: number;
  radius?: number;
  /** Extra styles for the face (padding, layout, minHeight…) */
  style?: StyleProp<ViewStyle>;
  /** Styles for the outer wrapper (flex, margins) */
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
}

export default function TactileCard({
  children,
  onPress,
  faceColor,
  borderColor,
  ledgeColor,
  borderWidth = 2,
  radius = 16,
  style,
  containerStyle,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
}: Props) {
  return (
    <View style={[styles.wrap, containerStyle]}>
      <View
        pointerEvents="none"
        style={[styles.ledge, { backgroundColor: ledgeColor, borderRadius: radius }]}
      />
      <Pressable
        onPress={onPress}
        onPressIn={() => haptics.light()}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => [
          styles.face,
          {
            backgroundColor: faceColor,
            borderColor,
            borderWidth,
            borderRadius: radius,
            transform: pressed ? [{ translateX: LEDGE_X - 1 }, { translateY: LEDGE_Y - 1 }] : [],
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingRight: LEDGE_X, paddingBottom: LEDGE_Y },
  ledge: { position: 'absolute', left: LEDGE_X, top: LEDGE_Y, right: 0, bottom: 0 },
  face: { overflow: 'hidden' },
});
