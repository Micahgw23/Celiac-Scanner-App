import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Linking, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] as const;

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  // onBarcodeScanned fires repeatedly while a code stays in frame — this
  // guard makes sure we only navigate once per code. Reset on focus (rather
  // than on mount) so coming back from the result screen — whether that
  // reused this screen instance or created a new one — always re-arms it.
  const hasScannedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      hasScannedRef.current = false;
    }, []),
  );

  function handleBarcodeScanned({ data }: { data: string }) {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;
    router.push({ pathname: '/result', params: { barcode: data } });
  }

  if (!permission) {
    // Permission status is still loading.
    return <ThemedView style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centeredSafeArea}>
          <ThemedText type="title" style={styles.permissionTitle}>
            Camera access needed
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.permissionBody}>
            We use the camera to scan a product&apos;s barcode. Nothing is recorded or shared
            beyond looking up the product.
          </ThemedText>
          {permission.canAskAgain ? (
            <Pressable onPress={requestPermission} style={styles.button}>
              <ThemedText type="default" style={styles.buttonText}>
                Grant camera access
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable onPress={() => Linking.openSettings()} style={styles.button}>
              <ThemedText type="default" style={styles.buttonText}>
                Open Settings
              </ThemedText>
            </Pressable>
          )}
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <ThemedView type="backgroundElement" style={styles.hintBar}>
          <ThemedText type="default">Point the camera at a barcode</ThemedText>
        </ThemedView>
        <ThemedView style={styles.actionRow}>
          <Pressable onPress={() => router.push('/assistant')} style={styles.overlayButton}>
            <ThemedText type="linkPrimary">Ask about a food</ThemedText>
          </Pressable>
          <Pressable onPress={() => router.push('/history')} style={styles.overlayButton}>
            <ThemedText type="linkPrimary">Scan history</ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
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
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  overlayButton: {
    backgroundColor: '#00000099',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  centeredSafeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  permissionTitle: { fontSize: 24, textAlign: 'center' },
  permissionBody: { textAlign: 'center' },
  button: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  buttonText: { color: '#FFFFFF' },
});
