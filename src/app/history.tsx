import type { Timestamp } from 'firebase/firestore';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerdictBadge } from '@/components/VerdictBadge';
import { Spacing } from '@/constants/theme';
import { useScanHistory } from '@/hooks/useScanHistory';
import { useAppState } from '@/lib/AppState';
import type { ScanRecord } from '@/types/scan';

function formatScannedAt(value: unknown): string {
  const timestamp = value as Timestamp | undefined;
  if (!timestamp || typeof timestamp.toDate !== 'function') return 'Just now';
  return timestamp.toDate().toLocaleString();
}

export default function History() {
  const { uid } = useAppState();
  const { records, loading } = useScanHistory(uid);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {loading ? (
          <ActivityIndicator style={styles.loading} size="large" />
        ) : records.length === 0 ? (
          <ThemedView style={styles.empty}>
            <ThemedText type="default" themeColor="textSecondary">
              No scans yet. Scan a product to see it here.
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={records}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }: { item: ScanRecord & { id: string } }) => (
              // Tapping re-runs a live lookup rather than trusting the stored
              // verdict — ingredient formulations and OFF data can change.
              <Pressable
                onPress={() => router.push({ pathname: '/result', params: { barcode: item.barcode } })}
                style={styles.row}
              >
                <ThemedView type="backgroundElement" style={styles.rowCard}>
                  <ThemedView style={styles.rowHeader}>
                    <ThemedText type="smallBold" numberOfLines={1} style={styles.rowTitle}>
                      {item.productName ?? `Barcode ${item.barcode}`}
                    </ThemedText>
                    <VerdictBadge status={item.verdict} compact />
                  </ThemedView>
                  {item.brand ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.brand}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatScannedAt(item.scannedAt)}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loading: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  listContent: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {},
  rowCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowTitle: { flex: 1 },
});
