import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DietSelector } from '@/components/DietSelector';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/AppState';
import type { DietId } from '@/types/diet';

export default function Onboarding() {
  const theme = useTheme();
  const { saveProfile } = useAppState();
  const [selected, setSelected] = useState<DietId[]>([]);
  const [customText, setCustomText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setSaving(true);
    setError(null);
    try {
      const customRestrictions = customText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await saveProfile({ conditions: selected, customRestrictions });
      router.replace('/scan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile. Try again.');
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>
            What should we watch for?
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Select every diet or allergy that applies. We&apos;ll flag scanned products that
            aren&apos;t safe for any of them.
          </ThemedText>

          <DietSelector selected={selected} onChange={setSelected} />

          <ThemedView type="backgroundElement" style={styles.customSection}>
            <ThemedText type="smallBold">Other restrictions (optional)</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Comma-separated. Shown as a reminder on scan results, but not checked
              automatically yet.
            </ThemedText>
            <TextInput
              value={customText}
              onChangeText={setCustomText}
              placeholder="e.g. red dye 40, nightshades"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              multiline
            />
          </ThemedView>

          {error ? (
            <ThemedText type="default" themeColor="text" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={handleContinue}
            disabled={saving || selected.length === 0}
            style={[styles.button, (saving || selected.length === 0) && styles.buttonDisabled]}
          >
            <ThemedText type="default" style={styles.buttonText}>
              {saving ? 'Saving…' : 'Continue'}
            </ThemedText>
          </Pressable>
          {selected.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Select at least one diet to continue.
            </ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  title: { fontSize: 28, lineHeight: 34 },
  customSection: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderColor: '#B0B4BA',
    borderRadius: Spacing.two,
    padding: Spacing.two,
    minHeight: 44,
  },
  error: { color: '#D93025' },
  button: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF' },
  hint: { textAlign: 'center' },
});
