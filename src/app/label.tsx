import { CameraView, useCameraPermissions } from 'expo-camera';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerdictBadge } from '@/components/VerdictBadge';
import { Spacing } from '@/constants/theme';
import { verdictForExtractedProduct } from '@/lib/aiExtraction';
import { isAiConfigured, readLabel } from '@/lib/aiClient';
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
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ThemedText type="title" style={styles.bigTitle}>
            Label reading not set up
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
            Deploy the worker in worker/ and add its URL as EXPO_PUBLIC_AI_PROXY_URL in .env.
          </ThemedText>
          <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
            <ThemedText type="linkPrimary">Go back</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!permission) return <ThemedView style={styles.container} />;

  if (!permission.granted) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ThemedText type="title" style={styles.bigTitle}>
            Camera access needed
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
            We use the camera to photograph the ingredient list. The photo is sent to be read and
            is not stored.
          </ThemedText>
          {permission.canAskAgain ? (
            <Pressable onPress={requestPermission} style={styles.primaryButton}>
              <ThemedText type="default" style={styles.primaryButtonText}>
                Grant camera access
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable onPress={() => Linking.openSettings()} style={styles.primaryButton}>
              <ThemedText type="default" style={styles.primaryButtonText}>
                Open Settings
              </ThemedText>
            </Pressable>
          )}
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (phase.kind === 'result' || phase.kind === 'error') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {phase.kind === 'result' && phase.product ? (
              <LabelResult product={phase.product} answer={phase.answer} conditions={conditions} />
            ) : (
              <ThemedView type="backgroundElement" style={styles.reasonBox}>
                <ThemedText type="default">
                  {phase.kind === 'error' ? phase.message : phase.answer}
                </ThemedText>
              </ThemedView>
            )}

            <Pressable onPress={() => setPhase({ kind: 'camera' })} style={styles.primaryButton}>
              <ThemedText type="default" style={styles.primaryButtonText}>
                {phase.kind === 'result' && phase.product ? 'Scan another label' : 'Retake photo'}
              </ThemedText>
            </Pressable>

            {phase.kind === 'result' && phase.product ? (
              <Pressable
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
                style={styles.secondaryButton}
              >
                <ThemedText type="linkPrimary">Ask the assistant about this</ThemedText>
              </Pressable>
            ) : null}

            <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
              <ThemedText type="linkPrimary">Back to scanner</ThemedText>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const busy = phase.kind === 'working';

  return (
    <ThemedView style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <ThemedView type="backgroundElement" style={styles.hintBar}>
          <ThemedText type="default">
            {busy
              ? phase.step === 'capturing'
                ? 'Taking photo…'
                : 'Reading the label…'
              : 'Fill the frame with the ingredient list'}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.controls}>
          {busy ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <Pressable onPress={capture} style={styles.shutter} accessibilityLabel="Take photo" />
          )}
          <Pressable onPress={() => router.back()} style={styles.overlayButton} disabled={busy}>
            <ThemedText type="linkPrimary">Cancel</ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
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
        <ThemedText type="subtitle" style={styles.productName}>
          {product.productName}
          {product.brand ? ` — ${product.brand}` : ''}
        </ThemedText>
      ) : null}

      <ThemedView type="backgroundElement" style={styles.reasonBox}>
        <ThemedText type="default">{verdict.reason}</ThemedText>
      </ThemedView>

      <ThemedText type="small" themeColor="textSecondary" style={styles.caveat}>
        ⚠︎ Read from your photo by AI. Compare it against the package before eating.
      </ThemedText>

      {answer ? (
        <ThemedText type="default" themeColor="textSecondary">
          {answer}
        </ThemedText>
      ) : null}

      {product.ingredientsText ? (
        <ThemedView type="backgroundElement" style={styles.reasonBox}>
          <ThemedText type="smallBold">What we read</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {product.ingredientsText}
          </ThemedText>
        </ThemedView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  camera: { flex: 1 },
  scrollContent: { padding: Spacing.four, gap: Spacing.three },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  hintBar: {
    alignSelf: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  controls: { alignItems: 'center', gap: Spacing.three, backgroundColor: 'transparent' },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#00000055',
  },
  overlayButton: {
    backgroundColor: '#00000099',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centeredText: { textAlign: 'center' },
  bigTitle: { fontSize: 24, textAlign: 'center' },
  productName: { fontSize: 20 },
  reasonBox: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  caveat: { fontStyle: 'italic' },
  primaryButton: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF' },
  secondaryButton: { alignItems: 'center', paddingVertical: Spacing.two },
});
