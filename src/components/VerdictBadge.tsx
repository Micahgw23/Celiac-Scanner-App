import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, VerdictColors } from '@/constants/theme';
import type { VerdictStatus } from '@/types/verdict';

const LABELS: Record<VerdictStatus, string> = {
  safe: 'Safe',
  unsafe: 'Not Safe',
  caution: 'Caution',
  unknown: 'Unknown',
};

interface VerdictBadgeProps {
  status: VerdictStatus;
  /** Small pill for list rows, instead of the full-width hero badge. */
  compact?: boolean;
}

export function VerdictBadge({ status, compact = false }: VerdictBadgeProps) {
  const colors = VerdictColors[status];

  if (compact) {
    return (
      <View style={[styles.compactBadge, { backgroundColor: colors.background }]}>
        <ThemedText type="small" style={[styles.compactText, { color: colors.text }]}>
          {LABELS[status]}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]}>
      <ThemedText type="title" style={[styles.text, { color: colors.text }]}>
        {LABELS[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  text: {
    fontSize: 32,
    lineHeight: 38,
  },
  compactBadge: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    alignSelf: 'flex-start',
  },
  compactText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
});
