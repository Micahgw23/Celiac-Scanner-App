import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/ProductCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerdictBadge } from '@/components/VerdictBadge';
import { Spacing } from '@/constants/theme';
import { recordScan } from '@/hooks/useScanHistory';
import { useAppState } from '@/lib/AppState';
import { fetchProductByBarcode, OffRequestError } from '@/lib/openFoodFacts';
import { evaluateProduct } from '@/lib/rulesEngine';
import type { VerdictResult } from '@/types/verdict';

// Distinct from "unknown" (product not found / insufficient data) — this
// means the *request itself* failed, e.g. no signal in a grocery store.
type LoadState = { kind: 'loading' } | { kind: 'network-error'; message: string } | { kind: 'ready' };

export default function Result() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const { uid, profile } = useAppState();

  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [productName, setProductName] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);
  const hasRecordedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    hasRecordedRef.current = false;

    async function run() {
      setLoadState({ kind: 'loading' });
      try {
        const response = await fetchProductByBarcode(barcode);
        if (cancelled) return;

        const product = response.status === 1 ? response.product ?? null : null;
        const result = evaluateProduct(product, profile?.conditions ?? []);

        setProductName(product?.product_name ?? null);
        setBrand(product?.brands ?? null);
        setImageUrl(product?.image_front_small_url ?? null);
        setVerdict(result);
        setLoadState({ kind: 'ready' });

        if (uid && !hasRecordedRef.current) {
          hasRecordedRef.current = true;
          recordScan(uid, {
            barcode,
            productName: product?.product_name ?? null,
            brand: product?.brands ?? null,
            imageUrl: product?.image_front_small_url ?? null,
            verdict: result.status,
            triggeredTags: result.triggeredTags,
            triggeredDiets: result.triggeredDiets,
          }).catch(() => {
            // Fire-and-forget: history is a convenience, not the primary flow.
          });
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof OffRequestError
            ? err.message
            : 'Something went wrong looking up this product.';
        setLoadState({ kind: 'network-error', message });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [barcode, profile, uid]);

  if (loadState.kind === 'loading') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator size="large" />
          <ThemedText type="default" themeColor="textSecondary">
            Looking up barcode {barcode}…
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (loadState.kind === 'network-error') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ThemedText type="title" style={styles.errorTitle}>
            Couldn&apos;t check this product
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.errorBody}>
            {loadState.message}
          </ThemedText>
          <RetryAndScanAgainButtons barcode={barcode} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!verdict) return null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <VerdictBadge status={verdict.status} />
          <ProductCard name={productName} brand={brand} imageUrl={imageUrl} />
          <ThemedView type="backgroundElement" style={styles.reasonBox}>
            <ThemedText type="default">{verdict.reason}</ThemedText>
          </ThemedView>
          <Pressable onPress={() => router.replace('/scan')} style={styles.primaryButton}>
            <ThemedText type="default" style={styles.primaryButtonText}>
              Scan Another
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/assistant',
                params: productName ? { prefill: `Tell me about ${productName}` } : {},
              })
            }
            style={styles.secondaryButton}
          >
            <ThemedText type="linkPrimary">Ask the assistant about this</ThemedText>
          </Pressable>
          <Pressable onPress={() => router.push('/history')} style={styles.secondaryButton}>
            <ThemedText type="linkPrimary">View scan history</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function RetryAndScanAgainButtons({ barcode }: { barcode: string }) {
  return (
    <ThemedView style={styles.buttonRow}>
      <Pressable
        onPress={() => router.replace({ pathname: '/result', params: { barcode } })}
        style={styles.primaryButton}
      >
        <ThemedText type="default" style={styles.primaryButtonText}>
          Retry
        </ThemedText>
      </Pressable>
      <Pressable onPress={() => router.replace('/scan')} style={styles.secondaryButton}>
        <ThemedText type="linkPrimary">Scan a different item</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  errorTitle: { fontSize: 24, textAlign: 'center' },
  errorBody: { textAlign: 'center' },
  reasonBox: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  buttonRow: { gap: Spacing.three, alignItems: 'center' },
  primaryButton: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF' },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
