/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  // ColorSchemeName can be 'light' | 'dark' | 'unspecified' | null | undefined
  // depending on the SDK, so narrow to the two palettes we actually have.
  const theme = scheme === 'dark' ? 'dark' : 'light';

  return Colors[theme];
}
