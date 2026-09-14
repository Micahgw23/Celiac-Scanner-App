import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/Card';
import { VerdictBadge } from '@/components/VerdictBadge';
import { Spacing } from '@/constants/theme';
import { verdictForExtractedProduct } from '@/lib/aiExtraction';
import type { DietId } from '@/types/diet';
import type { ExtractedProduct } from '@/types/ai';

interface AiProductVerdictProps {
  product: ExtractedProduct;
  conditions: DietId[];
}

/**
 * Renders the deterministic verdict for a product the assistant mentioned.
 *
 * The badge here is computed on-device by the same rules engine the barcode
 * scanner uses — the model never supplies it. That's why a chat answer and a
 * barcode scan of the same product agree.
 */
export function AiProductVerdict({ product, conditions }: AiProductVerdictProps) {
  const verdict = verdictForExtractedProduct(product, conditions);
  const title = product.productName ?? 'Unnamed product';

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="smallBold" numberOfLines={2} style={styles.title}>
          {title}
          {product.brand ? ` — ${product.brand}` : ''}
        </ThemedText>
        <VerdictBadge status={verdict.status} compact />
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {verdict.reason}
      </ThemedText>

      {product.source === 'model-knowledge' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.caveat}>
          ⚠︎ Not verified against a product database — always check the physical label.
        </ThemedText>
      ) : null}

      {product.source === 'label-photo' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.caveat}>
          ⚠︎ Read from your photo by AI. Compare it against the package before eating.
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.two },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: { flex: 1 },
  caveat: { fontStyle: 'italic' },
});
