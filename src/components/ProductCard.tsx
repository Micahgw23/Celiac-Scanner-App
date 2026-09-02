import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface ProductCardProps {
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
}

export function ProductCard({ name, brand, imageUrl }: ProductCardProps) {
  return (
    <View style={styles.row}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" />
      ) : (
        <View style={styles.imagePlaceholder} />
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
    borderRadius: Spacing.two,
  },
  imagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: Spacing.two,
    backgroundColor: '#E0E1E6',
  },
  textColumn: {
    flex: 1,
    gap: Spacing.half,
  },
});
