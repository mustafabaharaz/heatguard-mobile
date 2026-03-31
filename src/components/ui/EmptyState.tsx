import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import PressableScale from './PressableScale';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface EmptyStateProps {
  /** Ionicons icon name */
  icon: IconName;
  title: string;
  description: string;
  /** Optional CTA button */
  action?: {
    label: string;
    onPress: () => void;
  };
  /** Use 'danger' for error states, 'default' for empty states */
  variant?: 'default' | 'danger';
}

/**
 * Purposeful empty state shown when a screen has no content to display.
 * Always provides context and a next action — never leaves the user stranded.
 *
 * Canonical usage by screen:
 *  - Community feed:    icon="people-outline"
 *  - Check-in history: icon="calendar-outline"
 *  - Exposure history: icon="time-outline"
 *  - Resources:        icon="book-outline"
 *  - Error states:     icon="wifi-outline", variant="danger"
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  variant = 'default',
}) => {
  const iconColor =
    variant === 'danger' ? '#E63946' : '#6B7280';
  const iconBg =
    variant === 'danger'
      ? '#E63946' + '18'
      : '#E5E7EB' + '60';

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={32} color={iconColor} />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {action && (
        <PressableScale
          onPress={action.onPress}
          accessibilityLabel={action.label}
          accessibilityRole="button"
        >
          <View style={styles.actionButton}>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </View>
        </PressableScale>
      )}
    </View>
  );
};

// ─── Preset Empty States ─────────────────────────────────────────────────────

export const EmptyStateCommunityFeed: React.FC<{ onPost: () => void }> = ({ onPost }) => (
  <EmptyState
    icon="people-outline"
    title="Your neighborhood is quiet"
    description="Be the first to share a safety update, resource tip, or wellness check for your community."
    action={{ label: 'Post an update', onPress: onPost }}
  />
);

export const EmptyStateCheckInHistory: React.FC<{ onCheckIn: () => void }> = ({ onCheckIn }) => (
  <EmptyState
    icon="calendar-outline"
    title="No check-ins yet"
    description="Daily check-ins help track your heat exposure over time and alert trusted contacts."
    action={{ label: 'Check in now', onPress: onCheckIn }}
  />
);

export const EmptyStateExposureHistory: React.FC = () => (
  <EmptyState
    icon="time-outline"
    title="Exposure data will appear here"
    description="HeatGuard begins tracking after your first full day of use. Come back tomorrow."
  />
);

export const EmptyStateResources: React.FC = () => (
  <EmptyState
    icon="book-outline"
    title="No resources nearby"
    description="Cooling centers and emergency shelters will appear here when available in your area."
  />
);

export const EmptyStateNetworkError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <EmptyState
    icon="wifi-outline"
    title="Can't reach the server"
    description="Check your connection and try again. Local data is still available."
    action={{ label: 'Retry', onPress: onRetry }}
    variant="danger"
  />
);

export const EmptyStateVolunteers: React.FC = () => (
  <EmptyState
    icon="hand-left-outline"
    title="No volunteer requests right now"
    description="When neighbors need assistance, requests will appear here. Thank you for being ready."
  />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#1D3557',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  actionLabel: {
    
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default EmptyState;
