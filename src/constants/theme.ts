/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F5F5F7',
    backgroundSelected: '#E8E9ED',
    textSecondary: '#60646C',
    /** Hairline borders and separators. */
    border: '#D7DAE0',
    /** Brand/action color. Every button and link uses this — never a literal. */
    primary: '#0A7CE8',
    primaryPressed: '#0866C2',
    onPrimary: '#FFFFFF',
    danger: '#C5221F',
    dangerSurface: '#FDECEA',
    /** Scrim over camera feeds. */
    scrim: 'rgba(0,0,0,0.6)',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#1C1C1E',
    backgroundSelected: '#2C2C2E',
    textSecondary: '#A1A1A6',
    border: '#3A3A3C',
    // iOS system blue (dark); stays legible with white text on black.
    primary: '#0A84FF',
    primaryPressed: '#3D9BFF',
    onPrimary: '#FFFFFF',
    danger: '#FF6961',
    dangerSurface: '#3A1A18',
    scrim: 'rgba(0,0,0,0.6)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Same in light and dark mode — verdict meaning should stay recognizable
// regardless of theme (this is a food-safety signal, not decoration).
export const VerdictColors = {
  safe: { background: '#1E8E3E', text: '#FFFFFF' },
  unsafe: { background: '#D93025', text: '#FFFFFF' },
  caution: { background: '#F9AB00', text: '#000000' },
  unknown: { background: '#5F6368', text: '#FFFFFF' },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  /** The 8 -> 16 gap was missing; used for tighter stacks. */
  twoHalf: 12,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * Corner radii. Previously borrowed from Spacing, which coupled corner
 * roundness to layout spacing and produced magic numbers like 36 and 4.
 */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Opacity applied to disabled controls. */
export const DisabledOpacity = 0.4;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
