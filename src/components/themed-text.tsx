import { StyleSheet, Text, type TextProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The app's type scale.
 *
 * Every variant sets its own lineHeight. Previously screens overrode `fontSize`
 * on `title` while silently inheriting its 52px lineHeight, which left ~28px of
 * phantom leading on five screens — so sizes live here, not in screen overrides.
 */
export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'subtitle' | 'small' | 'smallBold' | 'caption' | 'linkPrimary';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'subtitle' && styles.subtitle,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'caption' && styles.caption,
        // Links follow the one brand color rather than a second hardcoded blue.
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.primary }],
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  /** Screen headings. */
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
  },
  /** Section headings and product names. */
  subtitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
  },
  /** Body copy. Regular weight — the whole app previously sat at 500. */
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  linkPrimary: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
});
