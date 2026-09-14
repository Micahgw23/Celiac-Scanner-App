import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Platform, type ColorValue } from 'react-native';

import { ThemedText } from '@/components/themed-text';

interface IconProps {
  /** SF Symbol name, used on iOS. */
  name: SFSymbol;
  /** Shown on Android/web, where SF Symbols don't exist. */
  fallback: string;
  size?: number;
  color?: ColorValue;
}

/**
 * Renders an SF Symbol on iOS and a text glyph elsewhere.
 *
 * The app previously used raw emoji (🔊 🎤 ✓ ‹) as icons. Emoji can't be
 * tinted to match the theme and render differently on each platform, so they
 * never matched the surrounding text color.
 */
export function Icon({ name, fallback, size = 20, color }: IconProps) {
  if (Platform.OS === 'ios') {
    return <SymbolView name={name} size={size} tintColor={color} resizeMode="scaleAspectFit" />;
  }

  return <ThemedText style={{ fontSize: size, color: color as string | undefined }}>{fallback}</ThemedText>;
}
