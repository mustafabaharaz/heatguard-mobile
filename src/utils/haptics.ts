import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isHapticsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Haptic feedback system for HeatGuard.
 * All haptic calls are no-ops on web — never throws.
 *
 * Usage philosophy:
 *  - light:    routine navigation (tab switch, card tap, toggle)
 *  - medium:   confirmations (check-in complete, setting saved)
 *  - heavy:    critical actions (SOS trigger, alert acknowledged)
 *  - success:  positive completion (wellness score improved)
 *  - warning:  threshold breached, heat alert issued
 *  - error:    failed action, invalid input
 */

const safe = (fn: () => Promise<void>) => {
  if (!isHapticsSupported) return;
  fn().catch(() => {});
};

export const haptics = {
  /** Subtle tap — routine navigation, card press */
  light: () =>
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** Standard confirmation — toggle, save, check-in */
  medium: () =>
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** Strong impact — SOS trigger, critical alert */
  heavy: () =>
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),

  /** Positive outcome — wellness improvement, safe confirmation */
  success: () =>
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),

  /** Caution — heat threshold warning, high-risk activity */
  warning: () =>
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),

  /** Failure — network error, invalid action */
  error: () =>
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),

  /** Selection change — picker, segmented control, filter tab */
  selection: () =>
    safe(() => Haptics.selectionAsync()),
};

export default haptics;
