import { router, useLocalSearchParams } from 'expo-router';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiProductVerdict } from '@/components/AiProductVerdict';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { saveAssistantMessage, useAssistantHistory } from '@/hooks/useAssistantHistory';
import { useTheme } from '@/hooks/use-theme';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { AiRateLimitError, ask, isAiConfigured } from '@/lib/aiClient';
import { useAppState } from '@/lib/AppState';
import { buildSpokenReply } from '@/lib/spokenReply';
import type { AssistantChatMessage } from '@/types/ai';

const SUGGESTIONS = [
  'Is Cheerios gluten free?',
  'Can I eat Fage yogurt?',
  'What does "modified food starch" mean for celiacs?',
];

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

  // Never let speech outlive the screen.
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  // Adopt saved history once, and only if the user hasn't started typing into
  // a fresh conversation — never clobber an in-flight exchange.
  if (!hydratedRef.current && initialMessages && initialMessages.length > 0 && messages.length === 0) {
    hydratedRef.current = true;
    setMessages(initialMessages);
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
        // Speaks the deterministic verdict first, then the prose — so what you
        // hear matches the badge even if the model's wording wanders.
        Speech.speak(buildSpokenReply(response.answer, response.products, conditions));
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
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ThemedText type="title" style={styles.setupTitle}>
            Assistant not set up
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
            Deploy the worker in worker/ and add its URL as EXPO_PUBLIC_AI_PROXY_URL in .env. See
            worker/README.md.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ThemedView style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="linkPrimary">‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Ask about a food</ThemedText>
          <Pressable
            onPress={() => {
              if (speakAnswers) Speech.stop();
              setSpeakAnswers(!speakAnswers);
            }}
            hitSlop={12}
            style={styles.headerSpacer}
            accessibilityLabel={speakAnswers ? 'Turn off spoken answers' : 'Turn on spoken answers'}
          >
            <ThemedText type="default">{speakAnswers ? '🔊' : '🔇'}</ThemedText>
          </Pressable>
        </ThemedView>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, index) => String(index)}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <ThemedView style={styles.empty}>
                <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
                  Ask about any food or brand. Answers are checked against a product database where
                  possible, and safety verdicts use your saved diet.
                </ThemedText>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} onPress={() => send(s)} style={styles.suggestion}>
                    <ThemedText type="small">{s}</ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
            }
            renderItem={({ item }) => (
              <ThemedView
                style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}
              >
                <ThemedText type="default" style={item.role === 'user' ? styles.userText : undefined}>
                  {item.content}
                </ThemedText>
                {item.products?.map((product, i) => (
                  <AiProductVerdict key={i} product={product} conditions={conditions} />
                ))}
              </ThemedView>
            )}
          />

          {sending || voice.isBusy ? (
            <ThemedView style={styles.statusRow}>
              <ActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary">
                {voice.state === 'listening'
                  ? 'Listening… tap the mic when you’re done'
                  : voice.state === 'transcribing'
                    ? 'Transcribing…'
                    : 'Checking…'}
              </ThemedText>
            </ThemedView>
          ) : null}

          {error ? (
            <ThemedView style={styles.errorBox}>
              <ThemedText type="small" style={styles.errorText}>
                {error}
              </ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.inputRow}>
            <Pressable
              onPress={() => {
                Speech.stop();
                setError(null);
                voice.toggle();
              }}
              disabled={sending || voice.state === 'transcribing'}
              style={[
                styles.micButton,
                voice.state === 'listening' && styles.micButtonActive,
                (sending || voice.state === 'transcribing') && styles.sendButtonDisabled,
              ]}
              accessibilityLabel={voice.state === 'listening' ? 'Stop recording' : 'Ask by voice'}
            >
              <ThemedText type="default">{voice.state === 'listening' ? '■' : '🎤'}</ThemedText>
            </Pressable>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about a food…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              editable={!sending}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
              multiline
            />
            <Pressable
              onPress={() => send(input)}
              disabled={sending || input.trim().length === 0}
              style={[
                styles.sendButton,
                (sending || input.trim().length === 0) && styles.sendButtonDisabled,
              ]}
            >
              <ThemedText type="default" style={styles.sendButtonText}>
                Send
              </ThemedText>
            </Pressable>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerSpacer: { width: 44 },
  listContent: { padding: Spacing.three, gap: Spacing.three },
  empty: { gap: Spacing.two, paddingVertical: Spacing.five },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centeredText: { textAlign: 'center' },
  setupTitle: { fontSize: 24, textAlign: 'center' },
  suggestion: {
    borderWidth: 1,
    borderColor: '#B0B4BA',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  bubble: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    maxWidth: '92%',
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#208AEF' },
  userText: { color: '#FFFFFF' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: 'transparent', paddingHorizontal: 0 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  errorBox: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  errorText: { color: '#D93025' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#B0B4BA',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    maxHeight: 120,
    minHeight: 44,
  },
  sendButton: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    height: 44,
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#FFFFFF' },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#B0B4BA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: { backgroundColor: '#D93025', borderColor: '#D93025' },
});
