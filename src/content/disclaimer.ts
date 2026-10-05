// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Safety & medical disclaimer (shown in onboarding and Settings)
// Bump DISCLAIMER_VERSION when the text changes materially — users will be
// asked to acknowledge it again.
// ─────────────────────────────────────────────────────────────────────────────

export const DISCLAIMER_VERSION = 1;

export const DISCLAIMER_TITLE = 'Before you start';

export const DISCLAIMER_POINTS: { icon: string; text: string }[] = [
  {
    icon: 'medkit-outline',
    text: 'HeatGuard is not a medical device. It doesn’t diagnose or treat any condition. Its risk levels and advice are general estimates based on weather forecasts and what you tell the app.',
  },
  {
    icon: 'call-outline',
    text: 'In an emergency, call 911. Don’t wait for an alert from HeatGuard.',
  },
  {
    icon: 'thermometer-outline',
    text: 'Confusion, fainting, a fast pulse, or hot, red skin with a body temperature of 103°F or higher can mean heat stroke — a medical emergency.',
  },
  {
    icon: 'notifications-off-outline',
    text: 'Alerts and reminders depend on your phone’s settings, battery, location access, and internet connection. They may not always arrive.',
  },
  {
    icon: 'hand-left-outline',
    text: 'HeatGuard can’t send texts or place calls by itself. You’ll always tap to send a message or start a call.',
  },
  {
    icon: 'people-outline',
    text: 'Talk with your doctor about how heat affects your health and any medications you take.',
  },
];
