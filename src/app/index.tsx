import { Redirect } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { useAppState } from '@/lib/AppState';

/**
 * Not a real screen — routes to onboarding (no profile yet) or straight to
 * scanning (returning user), once auth + the profile doc have resolved.
 */
export default function Index() {
  const { loading, error, profile } = useAppState();

  if (error) {
    return (
      <Screen centered>
        <ThemedText type="title" style={styles.centered}>
          Can&apos;t start up
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.centered}>
          Food Scanner couldn&apos;t reach its account service. Check your internet connection, then
          reopen the app.
        </ThemedText>
        {/* Technical detail kept, but de-emphasized — it's for debugging, not the user. */}
        <ThemedText type="caption" themeColor="textSecondary" style={styles.centered}>
          {error}
        </ThemedText>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen centered>
        <ThemedText type="title">Food Scanner</ThemedText>
        <LoadingState label="Getting things ready…" />
      </Screen>
    );
  }

  return <Redirect href={profile ? '/scan' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
});
