// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Tab Layout
// Home · Cool Spots · [SOS] · Plan · Profile
// The center SOS button is not a screen: press and hold for 2 seconds to open
// the emergency sheet. VoiceOver users can activate it directly.
// Skins: "High Sun" (light) and "Night Shift" (dark), following Settings.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Animated, Pressable, StyleSheet, Text, View, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import haptics from '../../src/utils/haptics';
import { hasAcceptedDisclaimer } from '../../src/features/settings/appPrefs';
import { useSettings } from '../../src/context/SettingsContext';
import EmergencySOSModal from '../../src/components/emergency/EmergencySOSModal';

// ─── Skins ────────────────────────────────────────────────────────────────────

const SKIN = {
  light: {
    bar: '#FFFFFF',
    border: '#0A0A0A',
    active: '#0B4FD6',
    inactive: '#3F3F3A',
    sos: '#C81E1E',
    sosFill: '#7F1212',
    sosLabel: '#9B1C1C',
  },
  dark: {
    bar: '#0F1829',
    border: '#1E2A44',
    active: '#38BDF8',
    inactive: '#8796B3',
    sos: '#DC2626',
    sosFill: '#7F1D1D',
    sosLabel: '#FCA5A5',
  },
};

type Skin = typeof SKIN.light;

const HOLD_MS = 2000;

// ─── Tab Item ─────────────────────────────────────────────────────────────────

type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabItemProps {
  focused: boolean;
  label: string;
  icon: TabIconName;
  focusedIcon: TabIconName;
  colors: Skin;
}

const TabItem: React.FC<TabItemProps> = ({ focused, label, icon, focusedIcon, colors }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const prevFocused = useRef(focused);

  useEffect(() => {
    if (focused && !prevFocused.current) {
      haptics.selection();
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.12, useNativeDriver: true, speed: 50, bounciness: 8 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }),
      ]).start();
    }
    prevFocused.current = focused;
  }, [focused]);

  const color = focused ? colors.active : colors.inactive;

  return (
    <Animated.View style={[tabItemStyles.container, { transform: [{ scale }] }]}>
      <Ionicons name={focused ? focusedIcon : icon} size={25} color={color} />
      <Text
        style={[tabItemStyles.label, { color, fontWeight: focused ? '700' : '600' }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Animated.View>
  );
};

const tabItemStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    gap: 3,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
});

// ─── SOS Hold Button ──────────────────────────────────────────────────────────

interface SOSButtonProps {
  colors: Skin;
  onTrigger: () => void;
}

const SOSTabButton: React.FC<SOSButtonProps> = ({ colors, onTrigger }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const [holding, setHolding] = useState(false);

  const startHold = () => {
    setHolding(true);
    haptics.selection();
    progress.setValue(0);
    holdAnim.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: true,
    });
    holdAnim.current.start(({ finished }) => {
      if (finished) {
        Vibration.vibrate(300);
        setHolding(false);
        progress.setValue(0);
        onTrigger();
      }
    });
  };

  const cancelHold = () => {
    holdAnim.current?.stop();
    holdAnim.current = null;
    setHolding(false);
    Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: true }).start();
  };

  return (
    <View style={sosStyles.slot} pointerEvents="box-none">
      <Pressable
        onPressIn={startHold}
        onPressOut={cancelHold}
        accessibilityRole="button"
        accessibilityLabel="Emergency SOS"
        accessibilityHint="Press and hold for two seconds to get help"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={e => {
          if (e.nativeEvent.actionName === 'activate') onTrigger();
        }}
        style={[sosStyles.button, { backgroundColor: colors.sos, borderColor: colors.bar }]}
      >
        <Animated.View
          style={[
            sosStyles.fill,
            { backgroundColor: colors.sosFill, transform: [{ scale: progress }] },
          ]}
        />
        <Text style={sosStyles.text}>SOS</Text>
      </Pressable>
      <Text style={[sosStyles.label, { color: colors.sosLabel }]}>
        {holding ? 'Keep holding' : 'Hold'}
      </Text>
    </View>
  );
};

const sosStyles = StyleSheet.create({
  slot: {
    flex: 1,
    alignItems: 'center',
    marginTop: -26,
  },
  button: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#C81E1E',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  fill: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
});

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = isDark ? SKIN.dark : SKIN.light;
  const [sosVisible, setSosVisible] = useState(false);

  // First launch (or updated safety notice): show onboarding + disclaimer first
  if (!hasAcceptedDisclaimer()) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: colors.bar,
            borderTopWidth: isDark ? StyleSheet.hairlineWidth : 1.5,
            borderTopColor: colors.border,
            height: 62 + insets.bottom,
            paddingBottom: insets.bottom,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarIconStyle: { width: '100%', height: '100%' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => (
              <TabItem focused={focused} label="Home" icon="home-outline" focusedIcon="home" colors={colors} />
            ),
            tabBarAccessibilityLabel: 'Home',
          }}
        />

        <Tabs.Screen
          name="map"
          options={{
            title: 'Cool Spots',
            tabBarIcon: ({ focused }) => (
              <TabItem focused={focused} label="Cool Spots" icon="location-outline" focusedIcon="location" colors={colors} />
            ),
            tabBarAccessibilityLabel: 'Cool Spots, cooling centers near you',
          }}
        />

        <Tabs.Screen
          name="sos"
          options={{
            title: 'SOS',
            tabBarButton: () => (
              <SOSTabButton colors={colors} onTrigger={() => setSosVisible(true)} />
            ),
          }}
          listeners={{
            tabPress: e => {
              e.preventDefault();
            },
          }}
        />

        <Tabs.Screen
          name="plan"
          options={{
            title: 'Plan',
            tabBarIcon: ({ focused }) => (
              <TabItem focused={focused} label="Plan" icon="calendar-outline" focusedIcon="calendar" colors={colors} />
            ),
            tabBarAccessibilityLabel: 'Plan, forecast and activity preparation',
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => (
              <TabItem focused={focused} label="Profile" icon="person-outline" focusedIcon="person" colors={colors} />
            ),
            tabBarAccessibilityLabel: 'Profile, heat profile and emergency contacts',
          }}
        />
      </Tabs>

      <EmergencySOSModal visible={sosVisible} onClose={() => setSosVisible(false)} />
    </>
  );
}
