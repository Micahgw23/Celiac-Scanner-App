import { CameraView, useCameraPermissions } from 'expo-camera';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/Button';
import { CameraOverlay, OverlayButton } from '@/components/ui/CameraOverlay';
import { Card } from '@/components/ui/Card';
import { ErrorNotice } from '@/components/ui/ErrorNotice';
import { Screen } from '@/components/ui/Screen';
import { VerdictBadge } from '@/components/VerdictBadge';
import { Radius, Spacing } from '@/constants/theme';
import { isAiConfigured, readLabel } from '@/lib/aiClient';
import { verdictForExtractedProduct } from '@/lib/aiExtraction';
import { useAppState } from '@/lib/AppState';
import type { ExtractedProduct } from '@/types/ai';
import type { DietId } from '@/types/diet';

/**
 * Long edge the photo is resized to before upload. Big enough for small print
 * on an ingredient list, small enough to stay well inside the worker's 1 MB
 * body cap (and its 10 ms CPU budget).
 */
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.7;

type Phase =
  | { kind: 'camera' }
  | { kind: 'working'; step: 'capturing' | 'reading' }
  | { kind: 'result'; answer: string; product: ExtractedProduct | null }
  | { kind: 'error'; message: string };

export default function Label() {
  const [permission, requestPermission] = useCameraPermissions();
  const { profile } = useAppState();
  const cameraRef = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'camera' });

  const conditions = profile?.conditions ?? [];

  async function capture() {
    if (phase.kind === 'working') return;
    setPhase({ kind: 'working', step: 'capturing' });

    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (!photo?.uri) throw new Error('The camera did not return a photo.');

      // Downsize before upload: a full-resolution phone photo is several MB.
      const resized = await manipulateAsync(
        photo.uri,
        [{ resize: { width: MAX_DIMENSION } }],
        { compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: true },
      );
      if (!resized.base64) throw new Error('Could not prepare the photo.');

      setPhase({ kind: 'working', step: 'reading' });
      const response = await readLabel({
        imageBase64: resized.base64,
        conditions,
        customRestrictions: profile?.customRestrictions ?? [],
      });

      setPhase({
        kind: 'result',
        answer: response.answer,
        product: response.products[0] ?? null,
      });
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong reading the label.',
      });
    }
  }

  if (!isAiConfigured()) {
    return (
      <Screen centered>
        <ThemedText type="title" style={styles.centered}>
          Label reading isn&apos;t available
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.centered}>
          This feature needs the app&apos;s AI service, which isn&apos;t switched on yet. You can
          still scan barcodes in the meantime.
        </ThemedText>
        <Button label="Go back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (!permission) {
    return (
      <Screen centered>
        <ActivityIndicator size="large" />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen centered>
        <ThemedText type="title" style={styles.centered}>
          Camera access needed
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.centered}>
          We use the camera to photograph the ingredient list. The photo is sent to be read and is
          not stored.
        </ThemedText>
        {permission.canAskAgain ? (
          <Button label="Grant camera access" onPress={requestPermission} fullWidth={false} />
        ) : (
          <Button label="Open Settings" onPress={() => Linking.openSettings()} fullWidth={false} />
        )}
      </Screen>
    );
  }

  if (phase.kind === 'result' || phase.kind === 'error') {
    const readable = phase.kind === 'result' && phase.product;

    return (
      <Screen scroll>
        {readable ? (
          <LabelResult product={phase.product!} answer={phase.answer} conditions={conditions} />
        ) : (
          // A failure must not look like a result — this gets danger styling,
          // where it previously shared the same neutral box as real content.
          <ErrorNotice
            message={phase.kind === 'error' ? phase.message : phase.answer}
            onRetry={() => setPhase({ kind: 'camera' })}
            retryLabel="Retake photo"
          />
        )}

        {readable ? (
          <>
            <Button label="Scan another label" onPress={() => setPhase({ kind: 'camera' })} />
            <Button
              label="Ask the assistant about this"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: '/assistant',
                  params: {
                    prefill: phase.product?.productName
                      ? `Tell me more about ${phase.product.productName}`
                      : 'I just scanned an ingredient label — what should I watch out for?',
                  },
                })
              }
            />
          </>
        ) : null}

        <Button label="Back to scanner" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const busy = phase.kind === 'working';

  return (
    <Screen padded={false} edges={[]}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <CameraOverlay
        hint={
          busy
            ? phase.step === 'capturing'
              ? 'Taking photo…'
              : 'Reading the label…'
            : 'Fill the frame with the ingredient list'
        }
        showReticle={!busy}
      >
        <View style={styles.controls}>
          {/* The shutter keeps its footprint while busy, so the layout doesn't
              jump between tapping and the result arriving. */}
          <Pressable
            onPress={capture}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Take photo of the ingredient label"
            accessibilityState={{ disabled: busy, busy }}
            style={({ pressed }) => [
              styles.shutter,
              busy && styles.shutterBusy,
              pressed && !busy && styles.shutterPressed,
            ]}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : null}
          </Pressable>
          <OverlayButton label="Cancel" onPress={() => router.back()} disabled={busy} />
        </View>
      </CameraOverlay>
    </Screen>
  );
}

/**
 * The verdict shown here is computed on-device by the same rules engine the
 * barcode scanner uses, from the ingredient text the model transcribed — the
 * model never supplies the verdict itself.
 */
function LabelResult({
  product,
  answer,
  conditions,
}: {
  product: ExtractedProduct;
  answer: string;
  conditions: DietId[];
}) {
  const verdict = verdictForExtractedProduct(product, conditions);

  return (
    <>
      <VerdictBadge status={verdict.status} />

      {product.productName ? (
        <ThemedText type="subtitle">
          {product.productName}
          {product.brand ? ` — ${product.brand}` : ''}
        </ThemedText>
      ) : null}

      <Card>
        <ThemedText type="default">{verdict.reason}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.caveat}>
          ⚠︎ Read from your photo by AI. Compare it against the package before eating.
        </ThemedText>
      </Card>

      {answer ? (
        <ThemedText type="default" themeColor="textSecondary">
          {answer}
        </ThemedText>
      ) : null}

      {product.ingredientsText ? (
        <Card>
          <ThemedText type="smallBold">What we read</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {product.ingredientsText}
          </ThemedText>
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
  centered: { textAlign: 'center' },
  caveat: { fontStyle: 'italic' },
  controls: { alignItems: 'center', gap: Spacing.three },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBusy: { backgroundColor: 'rgba(0,0,0,0.55)', borderColor: 'rgba(255,255,255,0.5)' },
  shutterPressed: { opacity: 0.75 },
});
