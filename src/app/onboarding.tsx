import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput } from 'react-native';

import { DietSelector } from '@/components/DietSelector';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorNotice } from '@/components/ui/ErrorNotice';
import { Screen } from '@/components/ui/Screen';
import { Radius, Spacing } from '@/constants/theme';
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
    // The custom-restrictions input sits above the Continue button, so without
    // this the keyboard covers the very control the user needs next.
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen scroll>
        <ThemedText type="title">What should we watch for?</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Select every diet or allergy that applies. We&apos;ll flag scanned products that
          aren&apos;t safe for any of them.
        </ThemedText>

        <DietSelector selected={selected} onChange={setSelected} />

        <Card>
          <ThemedText type="smallBold">Other restrictions (optional)</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Comma-separated. Shown as a reminder on scan results, but not checked automatically yet.
          </ThemedText>
          <TextInput
            value={customText}
            onChangeText={setCustomText}
            placeholder="e.g. red dye 40, nightshades"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.background, borderColor: theme.border },
            ]}
            multiline
          />
        </Card>

        {error ? <ErrorNotice message={error} /> : null}

        <Button
          label={saving ? 'Saving…' : 'Continue'}
          onPress={handleContinue}
          disabled={selected.length === 0}
          loading={saving}
        />
        {selected.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Select at least one diet to continue.
          </ThemedText>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.twoHalf,
    minHeight: 48,
  },
  hint: { textAlign: 'center' },
});
