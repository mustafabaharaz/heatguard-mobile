// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Emergency messaging
//
// Honest, iOS-compatible ways to reach people in an emergency:
//  - textContacts(): opens the native message composer, pre-addressed to ALL
//    emergency contacts, with a live map link. The user taps Send.
//  - shareLocation(): opens the system share sheet with a map link.
//  - call911(): opens the phone app's call prompt for 911.
//
// iOS does not let apps send texts or place calls without the user's tap.
// Nothing here claims a message was sent unless the composer reports it.
// ─────────────────────────────────────────────────────────────────────────────

import { Alert, Linking, Platform, Share } from 'react-native';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import { getContacts } from './storage/contactStorage';

export type TextResult = 'sent' | 'cancelled' | 'unknown' | 'no-contacts' | 'unavailable';

/** Best-effort current location as an Apple Maps link (null if unavailable). */
export async function getLocationLink(timeoutMs = 6000): Promise<string | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== 'granted') return null;
    }
    const recent = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000 });
    const pos =
      recent ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
      ]));
    if (!pos) return null;
    const { latitude, longitude } = pos.coords;
    return `https://maps.apple.com/?ll=${latitude.toFixed(5)},${longitude.toFixed(5)}&q=My%20location`;
  } catch {
    return null;
  }
}

function buildMessage(locationLink: string | null, reason: string): string {
  const lines = [`🆘 HeatGuard emergency: ${reason}`];
  lines.push(locationLink ? `My location: ${locationLink}` : 'I could not get my exact location.');
  lines.push('Please call or come check on me right away. If you can’t reach me, call 911.');
  return lines.join('\n');
}

/**
 * Open the message composer addressed to every emergency contact,
 * with the user's live location. Returns what actually happened.
 */
export async function textContacts(
  reason = 'I may be suffering from heat illness and need help.',
): Promise<TextResult> {
  const contacts = getContacts();
  if (contacts.length === 0) {
    Alert.alert(
      'No emergency contacts',
      'Add at least one contact in Profile → Emergency Contacts so HeatGuard can reach them.',
    );
    return 'no-contacts';
  }

  const numbers = contacts.map(c => c.phoneNumber).filter(Boolean);
  const body = buildMessage(await getLocationLink(), reason);

  try {
    if (await SMS.isAvailableAsync()) {
      const { result } = await SMS.sendSMSAsync(numbers, body);
      return result === 'sent' ? 'sent' : result === 'cancelled' ? 'cancelled' : 'unknown';
    }
  } catch {
    // fall through to the sms: URL fallback
  }

  // Fallback: open Messages for the primary (or first) contact
  const primary = contacts.find(c => c.isPrimary) ?? contacts[0];
  const sep = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${primary.phoneNumber}${sep}body=${encodeURIComponent(body)}`;
  try {
    await Linking.openURL(url);
    return 'unknown';
  } catch {
    Alert.alert(
      'Messaging unavailable',
      `This device can’t send texts. Call ${primary.name} at ${primary.phoneNumber}, or call 911.`,
    );
    return 'unavailable';
  }
}

/** Open the share sheet with the user's current location. */
export async function shareLocation(): Promise<void> {
  const link = await getLocationLink();
  if (!link) {
    Alert.alert(
      'Location unavailable',
      'HeatGuard couldn’t get your location. Check that Location is allowed in Settings, or describe where you are by phone.',
    );
    return;
  }
  await Share.share({ message: `🆘 HeatGuard — this is my current location: ${link}` });
}

/** Open the phone's 911 call prompt (iOS always asks the user to confirm). */
export async function call911(): Promise<void> {
  try {
    await Linking.openURL('tel:911');
  } catch {
    Alert.alert('Unable to open the phone app', 'Please dial 911 directly.');
  }
}
