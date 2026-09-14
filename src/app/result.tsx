import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ProductCard } from '@/components/ProductCard';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorNotice } from '@/components/ui/ErrorNotice';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { VerdictBadge } from '@/components/VerdictBadge';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { recordScan } from '@/hooks/useScanHistory';
import { DIETARY_RULES } from '@/lib/dietaryRules';
import { useAppState } from '@/lib/AppState';
import { fetchProductByBarcode, OffRequestError } from '@/lib/openFoodFacts';
import { evaluateProduct } from '@/lib/rulesEngine';
import type { DietId } from '@/types/diet';
import type { VerdictResult } from '@/types/verdict';

// Distinct from "unknown" (product not found / insufficient data) — this
// means the *request itself* failed, e.g. no signal in a grocery store.
type LoadState = { kind: 'loading' } | { kind: 'network-error'; message: string } | { kind: 'ready' };

/** "en:gluten" -> "Gluten", so the chips read like a label, not a database id. */
function tagLabel(tag: string): string {
  const bare = tag.replace(/^en:/, '').replace(/-/g, ' ');
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

export default function Result() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const { uid, profile } = useAppState();
  const theme = useTheme();

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
      <Screen centered>
        <LoadingState label="Checking this product…" />
        {/* The digits are for reassurance/debugging, not the headline. */}
        <ThemedText type="caption" themeColor="textSecondary">
          Barcode {barcode}
        </ThemedText>
      </Screen>
    );
  }

  if (loadState.kind === 'network-error') {
    return (
      <Screen centered>
        <ThemedText type="title" style={styles.centered}>
          Couldn&apos;t check this product
        </ThemedText>
        <ErrorNotice
          message={loadState.message}
          onRetry={() => router.replace({ pathname: '/result', params: { barcode } })}
          retryLabel="Retry"
        />
        <Button label="Scan a different item" variant="ghost" onPress={() => router.replace('/scan')} />
      </Screen>
    );
  }

  if (!verdict) return null;

  const triggeredDietLabels = verdict.triggeredDiets.map(
    (id: DietId) => DIETARY_RULES[id]?.label ?? id,
  );

  return (
    <Screen scroll>
      <VerdictBadge status={verdict.status} />
      <ProductCard name={productName} brand={brand} imageUrl={imageUrl} />

      <Card>
        <ThemedText type="default">{verdict.reason}</ThemedText>

        {/* Already computed for every scan, but never shown until now. */}
        {verdict.triggeredTags.length > 0 ? (
          <View style={styles.chipRow}>
            {verdict.triggeredTags.map((tag: string) => (
              <View
                key={tag}
                style={[styles.chip, { backgroundColor: theme.background, borderColor: theme.border }]}
              >
                <ThemedText type="caption">{tagLabel(tag)}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {triggeredDietLabels.length > 0 ? (
          <ThemedText type="caption" themeColor="textSecondary">
            Flagged for: {triggeredDietLabels.join(', ')}
          </ThemedText>
        ) : null}
      </Card>

      {/* A barcode we can't verify is exactly when the label itself is the
          better source — offer that instead of a dead end. */}
      {verdict.status === 'unknown' ? (
        <Button label="Scan the ingredient label instead" onPress={() => router.push('/label')} />
      ) : (
        <Button label="Scan another" onPress={() => router.replace('/scan')} />
      )}

      <View style={styles.secondaryActions}>
        {verdict.status === 'unknown' ? (
          <Button label="Scan another" variant="ghost" onPress={() => router.replace('/scan')} />
        ) : null}
        <Button
          label="Ask the assistant about this"
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: '/assistant',
              params: productName ? { prefill: `Tell me about ${productName}` } : {},
            })
          }
        />
        <Button label="View scan history" variant="ghost" onPress={() => router.push('/history')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.twoHalf,
  },
  secondaryActions: { gap: Spacing.one },
});
