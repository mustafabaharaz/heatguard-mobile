import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    return finalStatus;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

export async function scheduleHeatAlert(temperature: number, riskLevel: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🌡️ Heat Alert',
      body: getAlertMessage(temperature, riskLevel),
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { temperature, riskLevel },
    },
    trigger: null, // Immediate
  });
}

export async function scheduleDailyCheck(hour: number = 14) {
  // Schedule daily check at 2 PM (hottest time)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🛡️ HeatGuard Daily Check',
      body: 'Time to check the temperature and stay safe!',
      sound: true,
    },
    trigger: {
      type: 'calendar' as any,
      hour,
      minute: 0,
      repeats: true,
    },
  });
}

function getAlertMessage(temp: number, riskLevel: string): string {
  if (temp >= 40) {
    return `CRITICAL: ${temp}°C - Extreme heat danger! Seek immediate shelter and hydration.`;
  }
  if (temp >= 35) {
    return `HIGH RISK: ${temp}°C - Heat exhaustion likely. Stay indoors and drink water.`;
  }
  if (temp >= 30) {
    return `CAUTION: ${temp}°C - Take breaks and stay hydrated in the heat.`;
  }
  return `Temperature: ${temp}°C - Stay aware of changing conditions.`;
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
