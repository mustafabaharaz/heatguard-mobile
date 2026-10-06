// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/checkin/heatBuddy.ts   (NEW FILE)
// HeatGuard · Heat buddy (v1, phone-only)
//  - Buddies are emergency contacts marked "heat buddy".
//  - After a check-in, "Share with my buddy" opens the message composer
//    addressed to every buddy with the results. The user taps Send.
// v1.1 (server): automatic buddy alerts on a missed check-in, and a
// "check on them" prompt on the buddy's phone.
// ─────────────────────────────────────────────────────────────────────────────

import { Alert, Linking, Platform } from 'react-native';
import * as SMS from 'expo-sms';
import { getBuddies } from '../emergency/storage/contactStorage';
import { getHeatProfile } from '../profile/storage/profileStorage';
import { SAFETY_QUESTIONS } from '../../content/homeSafety';
import { formatNextCheckIn, type CheckInResult } from './dailyCheckIn';

export type ShareResult = 'sent' | 'cancelled' | 'unknown' | 'no-buddies' | 'unavailable';

export { getBuddies };

/** The text a buddy receives. */
export function buildBuddyMessage(result: CheckInResult): string {
  const name = getHeatProfile().name.trim().split(' ')[0];
  const time = new Date(result.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const lines: string[] = [`HeatGuard check-in${name ? ` from ${name}` : ''} · ${time}`];

  lines.push(result.ok ? "I'm OK." : "I'm not feeling well in the heat. Please call me.");

  if (result.safety) {
    const answered = SAFETY_QUESTIONS.filter(q => result.safety?.[q.key] && result.safety[q.key] !== 'na');
    if (answered.length) {
      lines.push(answered.map(q => `${q.short}: ${result.safety![q.key] === 'yes' ? 'yes' : 'NO'}`).join(' · '));
    }
    const missing = answered.filter(q => result.safety![q.key] === 'no');
    if (missing.length && result.ok) lines.push('Could use a hand with the items marked NO.');
  }

  const next = formatNextCheckIn();
  if (next) lines.push(`Next check-in: ${next}.`);
  lines.push("If you can't reach me, please check on me.");
  return lines.join('\n');
}

/** Open the composer addressed to all buddies. Returns what actually happened. */
export async function shareWithBuddies(result: CheckInResult): Promise<ShareResult> {
  const buddies = getBuddies();
  if (!buddies.length) return 'no-buddies';

  const numbers = buddies.map(b => b.phoneNumber).filter(Boolean);
  const body = buildBuddyMessage(result);

  try {
    if (await SMS.isAvailableAsync()) {
      const { result: r } = await SMS.sendSMSAsync(numbers, body);
      return r === 'sent' ? 'sent' : r === 'cancelled' ? 'cancelled' : 'unknown';
    }
  } catch {
    // fall through to sms: URL
  }

  const sep = Platform.OS === 'ios' ? '&' : '?';
  try {
    await Linking.openURL(`sms:${numbers[0]}${sep}body=${encodeURIComponent(body)}`);
    return 'unknown';
  } catch {
    Alert.alert('Messaging unavailable', `This device can't send texts. Call ${buddies[0].name} at ${buddies[0].phoneNumber}.`);
    return 'unavailable';
  }
}
