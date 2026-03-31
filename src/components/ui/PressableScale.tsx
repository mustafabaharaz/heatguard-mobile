import React, { useCallback, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';
import haptics from '../../utils/haptics';

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  /** Scale factor on press. Default: 0.96 */
  scale?: number;
  /** Haptic style on press. Default: 'light'. Set to null to disable. */
  hapticStyle?: 'light' | 'medium' | 'heavy' | 'selection' | null;
  disabled?: boolean;
  /** Duration of the press-in animation in ms. Default: 100 */
  inDuration?: number;
  /** Duration of the press-out animation in ms. Default: 150 */
  outDuration?: number;
  /** Accessible label */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
  testID?: string;
}

/**
 * Drop-in replacement for Pressable that adds:
 *  - Smooth 0.96 scale animation on press (spring physics)
 *  - Haptic feedback on press-in
 *  - Disabled state at reduced opacity
 *
 * Use everywhere you'd use Pressable for interactive cards, buttons, rows.
 */
const PressableScale: React.FC<PressableScaleProps> = ({
  children,
  onPress,
  onLongPress,
  style,
  scale = 0.96,
  hapticStyle = 'light',
  disabled = false,
  inDuration = 100,
  outDuration = 180,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  testID,
}) => {
  const animatedScale = useRef(new Animated.Value(1)).current;

  const pressIn = useCallback(() => {
    if (hapticStyle) (haptics as any)[hapticStyle]();
    Animated.spring(animatedScale, {
      toValue: scale,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [animatedScale, scale, hapticStyle]);

  const pressOut = useCallback(() => {
    Animated.spring(animatedScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  }, [animatedScale]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      testID={testID}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <Animated.View style={[style, { transform: [{ scale: animatedScale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default PressableScale;
