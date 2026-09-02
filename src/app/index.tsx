import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAppState } from '@/lib/AppState';

/**
 * Not a real screen — routes to onboarding (no profile yet) or straight to
 * scanning (returning user), once auth + the profile doc have resolved.
 */
export default function Index() {
  const { loading, error, profile } = useAppState();

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title" style={styles.errorTitle}>
            Setup needed
          </ThemedText>
          <ThemedText type="default">{error}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ActivityIndicator size="large" />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return <Redirect href={profile ? '/scan' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  errorTitle: { fontSize: 24, textAlign: 'center' },
});
