import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/Icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ALL_DIETARY_RULES } from '@/lib/dietaryRules';
import type { DietId } from '@/types/diet';

interface DietSelectorProps {
  selected: DietId[];
  onChange: (next: DietId[]) => void;
}

/**
 * Checkbox-style list of every diet the rules engine knows about.
 *
 * All colors come from the theme. These were previously hardcoded light-mode
 * values, so in dark mode a selected row rendered white text on a near-white
 * bar and unchecked boxes were nearly invisible.
 */
export function DietSelector({ selected, onChange }: DietSelectorProps) {
  const theme = useTheme();

  function toggle(id: DietId) {
    onChange(selected.includes(id) ? selected.filter((d) => d !== id) : [...selected, id]);
  }

  return (
    <View style={styles.list}>
      {ALL_DIETARY_RULES.map((rule) => {
        const isSelected = selected.includes(rule.id);
        return (
          <Pressable
            key={rule.id}
            onPress={() => toggle(rule.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: theme.background },
              isSelected && { backgroundColor: theme.backgroundSelected },
              pressed && { backgroundColor: theme.backgroundElement },
            ]}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: theme.border },
                isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
            >
              {isSelected ? <Icon name="checkmark" fallback="✓" size={14} color={theme.onPrimary} /> : null}
            </View>
            <ThemedText type="default" style={styles.label}>
              {rule.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    minHeight: 56,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
