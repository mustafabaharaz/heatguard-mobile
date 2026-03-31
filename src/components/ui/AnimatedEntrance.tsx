import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

interface AnimatedEntranceProps {
  children: React.ReactNode;
  /** Delay before the entrance starts, in ms. Use index * 60 for stagger. */
  delay?: number;
  /** Y offset to translate from. Default: 16 */
  fromY?: number;
  /** Duration of the animation. Default: 280 */
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps any content in a fade + slide-up entrance animation.
 *
 * Stagger pattern for lists:
 *   {items.map((item, i) => (
 *     <AnimatedEntrance key={item.id} delay={i * 60}>
 *       <ItemCard item={item} />
 *     </AnimatedEntrance>
 *   ))}
 *
 * Only translate and opacity are animated — no layout reflows.
 */
const AnimatedEntrance: React.FC<AnimatedEntranceProps> = ({
  children,
  delay = 0,
  fromY = 16,
  duration = 280,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        useNativeDriver: true,
        speed: 14,
        bounciness: 2,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[style, { opacity, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
};

export default AnimatedEntrance;
