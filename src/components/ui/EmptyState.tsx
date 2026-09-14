import type { SFSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface EmptyStateProps {
  icon: SFSymbol;
  iconFallback: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Empty list/first-run state: icon, explanation, and a way out of it. */
export function EmptyState({
  icon,
  iconFallback,
  title,
  body,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Icon name={icon} fallback={iconFallback} size={44} color={theme.textSecondary} />
      <ThemedText type="subtitle" style={styles.centered}>
        {title}
      </ThemedText>
      {body ? (
        <ThemedText type="default" themeColor="textSecondary" style={styles.centered}>
          {body}
        </ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centered: { textAlign: 'center' },
  action: { marginTop: Spacing.two },
});
