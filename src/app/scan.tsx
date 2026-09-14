import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/Button';
import { CameraOverlay, OverlayButton } from '@/components/ui/CameraOverlay';
import { Icon } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Radius, Spacing } from '@/constants/theme';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] as const;

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
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
    // Confirms the read without making the user look away from the shelf.
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    router.push({ pathname: '/result', params: { barcode: data } });
  }

  if (!permission) {
    return (
      <Screen centered>
        <LoadingState label="Starting the camera…" />
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
          We use the camera to scan a product&apos;s barcode. Nothing is recorded or shared beyond
          looking up the product.
        </ThemedText>
        {permission.canAskAgain ? (
          <Button label="Grant camera access" onPress={requestPermission} fullWidth={false} />
        ) : (
          <Button label="Open Settings" onPress={() => Linking.openSettings()} fullWidth={false} />
        )}
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <CameraOverlay
        hint="Line the barcode up inside the frame"
        showReticle
        topRight={
          <Pressable
            onPress={() => setTorchOn((on) => !on)}
            accessibilityRole="switch"
            accessibilityState={{ checked: torchOn }}
            accessibilityLabel={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
            style={({ pressed }) => [
              styles.torch,
              torchOn && styles.torchOn,
              pressed && styles.torchPressed,
            ]}
          >
            <Icon
              name={torchOn ? 'bolt.fill' : 'bolt.slash.fill'}
              fallback={torchOn ? '🔦' : '🔦'}
              size={20}
              color={torchOn ? '#000000' : '#FFFFFF'}
            />
          </Pressable>
        }
      >
        <OverlayButton label="Scan label" onPress={() => router.push('/label')} />
        <OverlayButton label="Ask about a food" onPress={() => router.push('/assistant')} />
        <OverlayButton label="History" onPress={() => router.push('/history')} />
      </CameraOverlay>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
  centered: { textAlign: 'center' },
  torch: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.half,
  },
  torchOn: { backgroundColor: '#FFFFFF' },
  torchPressed: { opacity: 0.7 },
});
