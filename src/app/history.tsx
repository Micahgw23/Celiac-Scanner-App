import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { Timestamp } from 'firebase/firestore';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorNotice } from '@/components/ui/ErrorNotice';
import { Icon } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { VerdictBadge } from '@/components/VerdictBadge';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useScanHistory } from '@/hooks/useScanHistory';
import { useAppState } from '@/lib/AppState';
import { formatRelativeDate } from '@/lib/formatDate';
import type { ScanRecord } from '@/types/scan';

function formatScannedAt(value: unknown): string {
  const timestamp = value as Timestamp | undefined;
  if (!timestamp || typeof timestamp.toDate !== 'function') return 'Just now';
  return formatRelativeDate(timestamp.toDate());
}

export default function History() {
  const { uid } = useAppState();
  const { records, loading, error } = useScanHistory(uid);
  const theme = useTheme();

  if (loading) {
    return (
      <Screen centered>
        <LoadingState label="Loading your scans…" />
      </Screen>
    );
  }

  // Previously this error was returned by the hook and silently dropped, so a
  // permissions or network failure looked identical to "no scans yet".
  if (error) {
    return (
      <Screen centered>
        <ErrorNotice message={`Couldn't load your history. ${error}`} />
      </Screen>
    );
  }

  if (records.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="clock.arrow.circlepath"
          iconFallback="🕘"
          title="No scans yet"
          body="Products you scan will appear here, so you can check something again later."
          actionLabel="Scan a product"
          onAction={() => router.replace('/scan')}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }: { item: ScanRecord & { id: string } }) => (
          // Tapping re-runs a live lookup rather than trusting the stored
          // verdict — ingredient formulations and OFF data can change.
          <Pressable
            onPress={() => router.push({ pathname: '/result', params: { barcode: item.barcode } })}
            style={({ pressed }) => [pressed && styles.rowPressed]}
            accessibilityRole="button"
          >
            <Card>
              <View style={styles.rowBody}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} contentFit="contain" />
                ) : (
                  <View
                    style={[
                      styles.thumb,
                      styles.thumbPlaceholder,
                      { borderColor: theme.border },
                    ]}
                  >
                    <Icon name="photo" fallback="🖼" size={18} color={theme.textSecondary} />
                  </View>
                )}

                <View style={styles.rowText}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {item.productName ?? 'Unnamed product'}
                  </ThemedText>
                  {item.brand ? (
                    <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                      {item.brand}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="caption" themeColor="textSecondary">
                    {formatScannedAt(item.scannedAt)}
                  </ThemedText>
                </View>

                <VerdictBadge status={item.verdict} compact />
                <Icon name="chevron.right" fallback="›" size={14} color={theme.textSecondary} />
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  rowPressed: { opacity: 0.6 },
  rowBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
  },
  thumbPlaceholder: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: Spacing.half },
});
