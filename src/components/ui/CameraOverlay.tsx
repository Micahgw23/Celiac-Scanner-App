import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

/**
 * Shared chrome for the two camera screens (barcode + label).
 *
 * Colors here are intentionally fixed rather than themed: this sits on top of
 * a live camera feed, not on a page background, so it must stay legible
 * regardless of the app's light/dark setting. The previous overlay buttons
 * used the theme's link blue on translucent black, which was low contrast.
 */
const OVERLAY_TEXT = '#FFFFFF';
const OVERLAY_SURFACE = 'rgba(0,0,0,0.65)';

interface CameraOverlayProps {
  hint: string;
  /** Aiming frame, so the user knows where to put the barcode or label. */
  showReticle?: boolean;
  topRight?: ReactNode;
  children?: ReactNode;
}

export function CameraOverlay({ hint, showReticle = false, topRight, children }: CameraOverlayProps) {
  return (
    <SafeAreaView style={styles.overlay} pointerEvents="box-none">
      <View style={styles.topRow} pointerEvents="box-none">
        <View style={styles.hintBar}>
          <ThemedText type="small" style={styles.hintText}>
            {hint}
          </ThemedText>
        </View>
        {topRight ? <View style={styles.topRight}>{topRight}</View> : null}
      </View>

      {showReticle ? (
        <View style={styles.reticleWrap} pointerEvents="none">
          <View style={styles.reticle} />
        </View>
      ) : (
        <View />
      )}

      <View style={styles.actions} pointerEvents="box-none">
        {children}
      </View>
    </SafeAreaView>
  );
}

/** Pill-shaped button for use over a camera feed. */
export function OverlayButton({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.overlayButton,
        pressed && styles.overlayButtonPressed,
        disabled && styles.overlayButtonDisabled,
      ]}
    >
      <ThemedText type="smallBold" style={styles.hintText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  hintBar: {
    backgroundColor: OVERLAY_SURFACE,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    flexShrink: 1,
  },
  hintText: { color: OVERLAY_TEXT, textAlign: 'center' },
  topRight: { position: 'absolute', right: 0, top: 0 },
  reticleWrap: { alignItems: 'center', justifyContent: 'center' },
  reticle: {
    width: '80%',
    aspectRatio: 1.6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: Radius.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  overlayButton: {
    backgroundColor: OVERLAY_SURFACE,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.twoHalf,
    paddingHorizontal: Spacing.four,
    minHeight: 44,
    justifyContent: 'center',
  },
  overlayButtonPressed: { backgroundColor: 'rgba(255,255,255,0.25)' },
  overlayButtonDisabled: { opacity: 0.4 },
});
