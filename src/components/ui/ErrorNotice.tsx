import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ErrorNoticeProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * Inline error with danger styling.
 *
 * Errors were previously rendered either as bare red text with no container,
 * or — on the label screen — in the same neutral box as ordinary content, so a
 * failure looked identical to a result.
 */
export function ErrorNotice({ message, onRetry, retryLabel = 'Try again' }: ErrorNoticeProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.dangerSurface, borderColor: theme.danger }]}>
      <View style={styles.row}>
        <Icon name="exclamationmark.triangle.fill" fallback="⚠︎" size={18} color={theme.danger} />
        <ThemedText type="small" style={[styles.message, { color: theme.danger }]}>
          {message}
        </ThemedText>
      </View>
      {onRetry ? <Button label={retryLabel} onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  message: { flex: 1 },
});
