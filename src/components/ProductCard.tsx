import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/Icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ProductCardProps {
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
}

export function ProductCard({ name, brand, imageUrl }: ProductCardProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" />
      ) : (
        // Themed: this was a fixed light gray, which glowed on black in dark mode.
        <View
          style={[
            styles.imagePlaceholder,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          <Icon name="photo" fallback="🖼" size={22} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.textColumn}>
        <ThemedText type="subtitle" numberOfLines={2}>
          {name ?? 'Unknown product'}
        </ThemedText>
        {brand ? (
          <ThemedText type="default" themeColor="textSecondary">
            {brand}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    alignSelf: 'stretch',
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
  },
  imagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: Spacing.half,
  },
});
