// ─────────────────────────────────────────────
// OfflineBanner
// Persistent top banner when offline or degraded.
// Shows cache age and tap-to-dismiss.
// ─────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useNetworkStatus } from '../../utils/networkStatus';
import { getLastFullSync } from '../../features/offline/offlineCache';

const C = {
  OFFLINE_BG:   '#1E1B16',
  OFFLINE_BORDER: '#78350F',
  OFFLINE_TEXT: '#FCD34D',
  DEGRADED_BG:  '#1C1A28',
  DEGRADED_BORDER: '#4C1D95',
  DEGRADED_TEXT: '#C4B5FD',
  MUTED: '#94A3B8',
} as const;

function buildAgeLabel(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function OfflineBanner() {
  const network = useNetworkStatus();
  const [cacheAge, setCacheAge] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;

  const shouldShow = !dismissed && (network.isOffline || network.isDegraded);

  useEffect(() => {
    if (shouldShow) {
      setDismissed(false);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
      // Load cache age
      getLastFullSync().then((ts) => {
        if (ts) setCacheAge(buildAgeLabel(Date.now() - ts));
        else setCacheAge(null);
      });
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [shouldShow]);

  // Reset dismissed when back online
  useEffect(() => {
    if (network.isOnline && !network.isDegraded) {
      setDismissed(false);
    }
  }, [network.isOnline, network.isDegraded]);

  if (!shouldShow && !network.isOffline && !network.isDegraded) return null;

  const isOffline = network.isOffline;
  const bg     = isOffline ? C.OFFLINE_BG    : C.DEGRADED_BG;
  const border = isOffline ? C.OFFLINE_BORDER : C.DEGRADED_BORDER;
  const color  = isOffline ? C.OFFLINE_TEXT   : C.DEGRADED_TEXT;
  const icon   = isOffline ? '⚡' : '~';
  const title  = isOffline ? 'No Connection' : 'Weak Signal';
  const detail = isOffline
    ? cacheAge
      ? `Showing cached data from ${cacheAge}`
      : 'Showing cached data — connect to refresh'
    : 'Some data may be delayed';

  return (
    <Animated.View style={[styles.banner, { backgroundColor: bg, borderBottomColor: border, opacity }]}>
      <View style={styles.left}>
        <Text style={[styles.icon, { color }]}>{icon}</Text>
        <View>
          <Text style={[styles.title, { color }]}>{title}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => setDismissed(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[styles.dismiss, { color }]}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  icon: {
    fontSize: 18,
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  detail: {
    fontSize: 11,
    color: C.MUTED,
    marginTop: 1,
  },
  dismiss: {
    fontSize: 16,
    paddingHorizontal: 4,
  },
});
