import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface LoadingStateProps {
  label?: string;
  /** Set when shown over a camera feed or other dark surface. */
  onDark?: boolean;
}

/**
 * Centered spinner with a label.
 *
 * Always sets an explicit color — four of the app's five spinners previously
 * left it unset, which renders a dark gray spinner on a black background in
 * dark mode.
 */
export function LoadingState({ label, onDark = false }: LoadingStateProps) {
  const theme = useTheme();
  const color = onDark ? '#FFFFFF' : theme.text;

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={color} />
      {label ? (
        <ThemedText type="default" themeColor="textSecondary" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  label: { textAlign: 'center' },
});
