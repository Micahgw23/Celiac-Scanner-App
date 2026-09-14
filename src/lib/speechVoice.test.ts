import { hasHighQualityVoice, pickBestVoice, type SpeechVoiceLike } from '@/lib/speechVoice';

function voice(overrides: Partial<SpeechVoiceLike> = {}): SpeechVoiceLike {
  return {
    identifier: 'com.apple.voice.compact.en-US.Samantha',
    name: 'Samantha',
    language: 'en-US',
    quality: 'Default',
    ...overrides,
  };
}

const compactSamantha = voice();
const enhancedNoelle = voice({
  identifier: 'com.apple.voice.enhanced.en-US.Noelle',
  name: 'Noelle',
  quality: 'Enhanced',
});
const premiumAva = voice({
  identifier: 'com.apple.voice.premium.en-US.Ava',
  name: 'Ava',
  // Apple reports Premium here, but expo-speech collapses it to "Default".
  quality: 'Default',
});

describe('pickBestVoice', () => {
  it('prefers a premium voice over enhanced and compact', () => {
    expect(pickBestVoice([compactSamantha, enhancedNoelle, premiumAva])).toBe(premiumAva.identifier);
  });

  it('regression: a Premium voice reporting quality "Default" still outranks an Enhanced one', () => {
    // expo-speech maps iOS Premium -> "Default", so ranking on quality alone
    // would wrongly pick Noelle here.
    expect(pickBestVoice([enhancedNoelle, premiumAva])).toBe(premiumAva.identifier);
  });

  it('prefers enhanced over compact when no premium is installed', () => {
    expect(pickBestVoice([compactSamantha, enhancedNoelle])).toBe(enhancedNoelle.identifier);
  });

  it('falls back to a compact voice when that is all there is', () => {
    expect(pickBestVoice([compactSamantha])).toBe(compactSamantha.identifier);
  });

  it('never picks a novelty voice', () => {
    const zarvox = voice({ identifier: 'com.apple.speech.synthesis.voice.Zarvox', name: 'Zarvox' });
    const bubbles = voice({ identifier: 'com.apple.speech.synthesis.voice.Bubbles', name: 'Bubbles' });
    expect(pickBestVoice([zarvox, bubbles])).toBeUndefined();
    expect(pickBestVoice([zarvox, compactSamantha])).toBe(compactSamantha.identifier);
  });

  it('never picks a Siri voice (blocked for third-party apps)', () => {
    const siri = voice({ identifier: 'com.apple.ttsbundle.siri_female_en-US_compact', name: 'Siri' });
    expect(pickBestVoice([siri])).toBeUndefined();
  });

  it('ignores non-English voices', () => {
    const french = voice({ identifier: 'com.apple.voice.premium.fr-FR.Audrey', language: 'fr-FR' });
    expect(pickBestVoice([french])).toBeUndefined();
    expect(pickBestVoice([french, compactSamantha])).toBe(compactSamantha.identifier);
  });

  it('prefers a warm en-US voice over an equally-ranked other-English one', () => {
    const enGb = voice({ identifier: 'com.apple.voice.compact.en-GB.Daniel', name: 'Daniel', language: 'en-GB' });
    expect(pickBestVoice([enGb, compactSamantha])).toBe(compactSamantha.identifier);
  });

  it('returns undefined for an empty or missing list, letting the system choose', () => {
    expect(pickBestVoice([])).toBeUndefined();
    expect(pickBestVoice(null)).toBeUndefined();
    expect(pickBestVoice(undefined)).toBeUndefined();
  });
});

describe('hasHighQualityVoice', () => {
  it('is false when only compact voices are installed', () => {
    expect(hasHighQualityVoice([compactSamantha])).toBe(false);
  });

  it('is true for an enhanced or premium voice', () => {
    expect(hasHighQualityVoice([compactSamantha, enhancedNoelle])).toBe(true);
    expect(hasHighQualityVoice([compactSamantha, premiumAva])).toBe(true);
  });

  it('ignores high-quality voices in other languages', () => {
    const frenchPremium = voice({
      identifier: 'com.apple.voice.premium.fr-FR.Audrey',
      language: 'fr-FR',
    });
    expect(hasHighQualityVoice([frenchPremium])).toBe(false);
  });
});
