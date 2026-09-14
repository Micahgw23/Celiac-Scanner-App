import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AiProductVerdict } from '@/components/AiProductVerdict';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/Card';
import { ErrorNotice } from '@/components/ui/ErrorNotice';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Radius, Spacing } from '@/constants/theme';
import { saveAssistantMessage, useAssistantHistory } from '@/hooks/useAssistantHistory';
import { useTheme } from '@/hooks/use-theme';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { AiRateLimitError, ask, isAiConfigured } from '@/lib/aiClient';
import { useAppState } from '@/lib/AppState';
import { buildSpokenReply } from '@/lib/spokenReply';
import { SPEECH_OPTIONS, hasHighQualityVoice, pickBestVoice } from '@/lib/speechVoice';
import type { AssistantChatMessage } from '@/types/ai';

const SUGGESTIONS = [
  'Is Cheerios gluten free?',
  'Can I eat Fage yogurt?',
  'What does "modified food starch" mean?',
];

const VOICE_TIP_KEY = 'voiceQualityTipDismissed';

export default function Assistant() {
  const theme = useTheme();
  const { uid, profile } = useAppState();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const { initialMessages } = useAssistantHistory(uid);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  // Seeded from the result screen ("Ask the assistant about this") so the user
  // lands with the question already typed, but free to edit it before sending.
  const [input, setInput] = useState(prefill ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakAnswers, setSpeakAnswers] = useState(true);
  const [voiceId, setVoiceId] = useState<string | undefined>(undefined);
  const [showVoiceTip, setShowVoiceTip] = useState(false);
  const listRef = useRef<FlatList<AssistantChatMessage>>(null);
  const hydratedRef = useRef(false);

  const conditions = profile?.conditions ?? [];

  // Voice questions are sent as soon as the recording is transcribed, so the
  // transcript lands in the chat as the user's own bubble — if a word was
  // misheard, it's visible right next to the answer it produced.
  const voice = useVoiceInput({
    onTranscript: (text) => send(text),
    onError: (message) => setError(message),
  });

  // Pick the best installed voice once. iOS ships only compact voices by
  // default, so if nothing better is installed we offer the Settings tip.
  useEffect(() => {
    let active = true;

    (async () => {
      const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
      if (!active) return;
      setVoiceId(pickBestVoice(voices));

      if (!hasHighQualityVoice(voices)) {
        const dismissed = await AsyncStorage.getItem(VOICE_TIP_KEY).catch(() => null);
        if (active && !dismissed) setShowVoiceTip(true);
      }
    })();

    return () => {
      active = false;
      Speech.stop(); // never let speech outlive the screen
    };
  }, []);

  // Adopt saved history once, and only if the user hasn't started typing into
  // a fresh conversation — never clobber an in-flight exchange. This lives in
  // an effect because history arrives asynchronously from Firestore, and the
  // ref keeps it a one-time adoption even if that query re-emits.
  useEffect(() => {
    if (hydratedRef.current || !initialMessages || initialMessages.length === 0) return;
    hydratedRef.current = true;
    setMessages((current) => (current.length === 0 ? initialMessages : current));
  }, [initialMessages]);

  async function dismissVoiceTip() {
    setShowVoiceTip(false);
    await AsyncStorage.setItem(VOICE_TIP_KEY, '1').catch(() => {});
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;

    hydratedRef.current = true;
    setInput('');
    setError(null);
    const userMessage: AssistantChatMessage = { role: 'user', content: question };
    const nextMessages: AssistantChatMessage[] = [...messages, userMessage];
    setMessages(nextMessages);
    setSending(true);

    try {
      const response = await ask({
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        conditions,
        customRestrictions: profile?.customRestrictions ?? [],
      });
      const assistantMessage: AssistantChatMessage = {
        role: 'assistant',
        content: response.answer,
        products: response.products,
      };
      setMessages([...nextMessages, assistantMessage]);

      if (speakAnswers) {
        // Speaks the deterministic verdict first, then one sentence — so what
        // you hear matches the badge even if the model's wording wanders.
        Speech.speak(buildSpokenReply(response.answer, response.products, conditions), {
          ...SPEECH_OPTIONS,
          voice: voiceId,
        });
      }

      if (uid) {
        // Fire-and-forget: saved history is a convenience, not the main flow.
        saveAssistantMessage(uid, userMessage).catch(() => {});
        saveAssistantMessage(uid, assistantMessage).catch(() => {});
      }
    } catch (err) {
      const message =
        err instanceof AiRateLimitError || err instanceof Error
          ? err.message
          : 'Something went wrong. Try again.';
      setError(message);
      // Keep the user's message on screen so they can retry without retyping.
    } finally {
      setSending(false);
    }
  }

  if (!isAiConfigured()) {
    return (
      <Screen centered>
        <ThemedText type="title" style={styles.centeredText}>
          Assistant isn&apos;t available
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
          The app&apos;s AI service isn&apos;t switched on yet. You can still scan barcodes in the
          meantime.
        </ThemedText>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => {
                if (speakAnswers) Speech.stop();
                setSpeakAnswers(!speakAnswers);
              }}
              hitSlop={12}
              accessibilityRole="switch"
              accessibilityState={{ checked: speakAnswers }}
              accessibilityLabel={speakAnswers ? 'Turn off spoken answers' : 'Turn on spoken answers'}
            >
              <Icon
                name={speakAnswers ? 'speaker.wave.2.fill' : 'speaker.slash.fill'}
                fallback={speakAnswers ? '🔊' : '🔇'}
                size={20}
                color={theme.primary}
              />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            showVoiceTip ? (
              <Card style={styles.tip}>
                <ThemedText type="smallBold">Want a more natural voice?</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  iPhone ships with a basic robotic voice. For a much better one, go to Settings →
                  Accessibility → Spoken Content → Voices → English and download an
                  &quot;Enhanced&quot; voice. Also note: spoken answers stay silent while your phone
                  is on silent.
                </ThemedText>
                <Pressable onPress={dismissVoiceTip} hitSlop={8} style={styles.tipDismiss}>
                  <ThemedText type="linkPrimary">Got it</ThemedText>
                </Pressable>
              </Card>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
                Ask about any food or brand. Answers are checked against a product database where
                possible, and safety verdicts use your saved diet.
              </ThemedText>
              <View style={styles.chipWrap}>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => send(s)}
                    style={({ pressed }) => [
                      styles.chip,
                      { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                      pressed && { backgroundColor: theme.backgroundSelected },
                    ]}
                  >
                    <ThemedText type="small">{s}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) =>
            item.role === 'user' ? (
              <View style={[styles.bubble, styles.userBubble, { backgroundColor: theme.primary }]}>
                <ThemedText type="default" style={{ color: theme.onPrimary }}>
                  {item.content}
                </ThemedText>
              </View>
            ) : (
              // AI replies now get a real surface; they previously rendered on
              // bare background opposite solid blue user bubbles.
              <Card style={styles.aiBubble}>
                <ThemedText type="default">{item.content}</ThemedText>
                {item.products?.map((product, i) => (
                  <AiProductVerdict key={i} product={product} conditions={conditions} />
                ))}
              </Card>
            )
          }
        />

        {sending || voice.isBusy ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color={theme.text} />
            <ThemedText type="small" themeColor="textSecondary">
              {voice.state === 'listening'
                ? 'Listening… tap the square when you’re done'
                : voice.state === 'transcribing'
                  ? 'Transcribing…'
                  : 'Checking…'}
            </ThemedText>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorWrap}>
            <ErrorNotice message={error} />
          </View>
        ) : null}

        <View style={[styles.inputRow, { borderTopColor: theme.border }]}>
          <Pressable
            onPress={() => {
              Speech.stop();
              setError(null);
              voice.toggle();
            }}
            disabled={sending || voice.state === 'transcribing'}
            accessibilityRole="button"
            accessibilityLabel={voice.state === 'listening' ? 'Stop recording' : 'Ask by voice'}
            style={({ pressed }) => [
              styles.micButton,
              { borderColor: theme.border },
              voice.state === 'listening' && { backgroundColor: theme.danger, borderColor: theme.danger },
              (sending || voice.state === 'transcribing') && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name={voice.state === 'listening' ? 'stop.fill' : 'mic.fill'}
              fallback={voice.state === 'listening' ? '■' : '🎤'}
              size={20}
              color={voice.state === 'listening' ? theme.onPrimary : theme.text}
            />
          </Pressable>

          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about a food…"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
            editable={!sending}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            multiline
          />

          <Pressable
            onPress={() => send(input)}
            disabled={sending || input.trim().length === 0}
            accessibilityRole="button"
            accessibilityLabel="Send question"
            style={({ pressed }) => [
              styles.sendButton,
              { backgroundColor: theme.primary },
              (sending || input.trim().length === 0) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="arrow.up" fallback="↑" size={20} color={theme.onPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centeredText: { textAlign: 'center' },
  listContent: { padding: Spacing.three, gap: Spacing.three },
  empty: { gap: Spacing.three, paddingVertical: Spacing.five },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  tip: { marginBottom: Spacing.three },
  tipDismiss: { alignSelf: 'flex-start', paddingTop: Spacing.one },
  bubble: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    maxWidth: '92%',
  },
  userBubble: { alignSelf: 'flex-end' },
  aiBubble: { alignSelf: 'flex-start', maxWidth: '96%' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  errorWrap: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.twoHalf,
    maxHeight: 120,
    minHeight: 48,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
