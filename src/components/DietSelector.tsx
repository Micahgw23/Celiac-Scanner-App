import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ALL_DIETARY_RULES } from '@/lib/dietaryRules';
import type { DietId } from '@/types/diet';

interface DietSelectorProps {
  selected: DietId[];
  onChange: (next: DietId[]) => void;
}

/** Checkbox-style list of every diet the rules engine knows about. */
export function DietSelector({ selected, onChange }: DietSelectorProps) {
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
            style={[styles.row, isSelected && styles.rowSelected]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
          >
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected ? <ThemedText style={styles.checkmark}>✓</ThemedText> : null}
            </View>
            <ThemedText type="default">{rule.label}</ThemedText>
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
    borderRadius: Spacing.two,
  },
  rowSelected: {
    backgroundColor: '#E0E1E6',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Spacing.one,
    borderWidth: 2,
    borderColor: '#60646C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#208AEF',
    borderColor: '#208AEF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
