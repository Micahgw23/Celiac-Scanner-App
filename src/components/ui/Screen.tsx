import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (for anything taller than the viewport). */
  scroll?: boolean;
  /** Center content vertically — for loading, permission, and error states. */
  centered?: boolean;
  padded?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
}

/**
 * Standard page wrapper.
 *
 * Replaces five separate copies of the same centered-page block (under three
 * different names) and standardizes page padding, which had drifted to 16 on
 * one screen and 24 on the rest. Also applies the width clamp that existed as
 * a token but was never used, so the layout doesn't sprawl on tablets/web.
 */
export function Screen({
  children,
  scroll = false,
  centered = false,
  padded = true,
  edges,
  contentStyle,
}: ScreenProps) {
  const theme = useTheme();

  const inner = (
    <View
      style={[
        styles.inner,
        padded && styles.padded,
        centered && styles.centered,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.flex} edges={edges}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, centered && styles.grow]}
            keyboardShouldPersistTaps="handled"
          >
            {inner}
          </ScrollView>
        ) : (
          inner
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  scrollContent: { flexGrow: 0 },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  padded: { padding: Spacing.four },
  centered: { justifyContent: 'center', alignItems: 'center', gap: Spacing.three },
});
