import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';

import { transcribe } from '@/lib/aiClient';

/** Hard stop so a pocketed phone can't upload a long recording. */
const MAX_RECORDING_MS = 30_000;

export type VoiceState = 'idle' | 'listening' | 'transcribing';

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}

/**
 * Tap to start talking, tap again to stop. The recording is uploaded to the
 * worker, transcribed by Whisper, and handed back as text.
 *
 * LOW_QUALITY is deliberate: it's AAC/m4a at 64 kbps, which is plenty for
 * speech recognition and keeps a 30-second clip small enough for the worker's
 * upload cap.
 */
export function useVoiceInput({ onTranscript, onError }: UseVoiceInputOptions) {
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [state, setState] = useState<VoiceState>('idle');
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Kept in a ref so the auto-stop timer always calls the current stop().
  const stopRef = useRef<() => Promise<void>>(async () => {});

  const clearTimer = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);

  const stop = useCallback(async () => {
    clearTimer();
    setState('transcribing');
    try {
      await recorder.stop();
      // iOS keeps the audio session in record mode otherwise, which routes
      // text-to-speech to the quiet earpiece instead of the speaker.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

      const uri = recorder.uri;
      if (!uri) throw new Error('No recording was captured.');

      const audioBase64 = await new File(uri).base64();
      const text = await transcribe({ audioBase64 });
      onTranscript(text);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not process that recording.');
    } finally {
      setState('idle');
    }
  }, [clearTimer, onError, onTranscript, recorder]);

  // Assigned in an effect rather than during render: refs must not be written
  // while rendering.
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const start = useCallback(async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        onError('Microphone access is needed to ask by voice. You can enable it in Settings.');
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState('listening');

      autoStopRef.current = setTimeout(() => {
        void stopRef.current();
      }, MAX_RECORDING_MS);
    } catch (err) {
      setState('idle');
      onError(err instanceof Error ? err.message : 'Could not start recording.');
    }
  }, [onError, recorder]);

  const toggle = useCallback(() => {
    if (state === 'listening') void stop();
    else if (state === 'idle') void start();
  }, [start, state, stop]);

  useEffect(() => clearTimer, [clearTimer]);

  return { state, toggle, isBusy: state !== 'idle' };
}
