import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { DisabledOpacity, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Defaults to full width; set false for inline/overlay buttons. */
  fullWidth?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/**
 * The app's only button.
 *
 * Replaces four near-identical copies that had drifted apart (one was missing
 * horizontal padding, so its label touched the edges). The 48px minimum height
 * is deliberate: this app gets used one-handed in a grocery aisle.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const isInert = disabled || loading;

  const background: Record<Variant, string> = {
    primary: theme.primary,
    secondary: theme.backgroundElement,
    ghost: 'transparent',
    danger: theme.danger,
  };
  const pressedBackground: Record<Variant, string> = {
    primary: theme.primaryPressed,
    secondary: theme.backgroundSelected,
    ghost: theme.backgroundElement,
    danger: theme.primaryPressed,
  };
  const foreground: Record<Variant, string> = {
    primary: theme.onPrimary,
    secondary: theme.text,
    ghost: theme.primary,
    danger: theme.onPrimary,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isInert}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInert, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        variant === 'secondary' && { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
        { backgroundColor: pressed ? pressedBackground[variant] : background[variant] },
        isInert && { opacity: DisabledOpacity },
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator size="small" color={foreground[variant]} /> : null}
        <ThemedText type="default" style={[styles.label, { color: foreground[variant] }]}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.twoHalf,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { fontWeight: '600' },
});
