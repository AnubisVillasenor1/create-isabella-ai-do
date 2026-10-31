import { describe, expect, it } from 'vitest';
import { detectWavWatermark, encodeWavPcm16 } from '../../src/ivcc/audio';
import { IvccEngine } from '../../src/ivcc/engine';
import { MemoryIvccStore } from '../../src/ivcc/store';
import { GenesisTtsEngine } from '../../src/tts/engine';

const SUBJECT_SALT = Buffer.alloc(32, 5);
const WATERMARK_KEY = Buffer.alloc(32, 6);
const SCOPES = ['voice_profile:create', 'voice:synthesize', 'emotion:infer', 'prosody:memory'];
const PERSON = 'person:ana-001';

function wavBytes(): Uint8Array {
  const sampleRate = 24_000;
  const frames = sampleRate;
  const samples = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    samples[index] = 0.15 * Math.sin((2 * Math.PI * 220 * index) / sampleRate);
  }
  return encodeWavPcm16(samples, sampleRate, 1);
}

function wavDataUrl(): { url: string; bytes: number } {
  const bytes = wavBytes();
  return {
    url: `data:audio/wav;base64,${Buffer.from(bytes).toString('base64')}`,
    bytes: bytes.length,
  };
}

function makeTts(onCall?: () => Promise<void> | void): GenesisTtsEngine {
  return new GenesisTtsEngine({
    env: { GROQ_API_KEY: 'test-key', GROQ_TTS_MODEL: 'test-model' },
    native: null,
    serverTts: async () => {
      await onCall?.();
      const wav = wavDataUrl();
      return {
        provider: 'groq',
        mimeType: 'audio/wav',
        dataUrl: wav.url,
        bytes: wav.bytes,
        voice: 'Celeste-PlayAI',
      };
    },
  });
}

function makeEngine(tts: GenesisTtsEngine | null = null): IvccEngine {
  return new IvccEngine({
    store: new MemoryIvccStore(),
    subjectSalt: SUBJECT_SALT,
    watermarkKey: WATERMARK_KEY,
    tts,
  });
}

const grant = {
  subjectRef: PERSON,
  scopes: SCOPES,
  method: 'digital-signature',
  evidenceRef: 'vault://consent/2026/ivcc-001',
  attestation: true,
};

describe('IVCC engine', () => {
  it('plans with the synthetic operator baseline without claiming authority', async () => {
    const plan = await makeEngine().plan({ text: 'Hola. Gracias por tu ayuda.' }, 'tester');
    expect(plan.status).toBe('planned');
    if (plan.status !== 'planned') return;
    expect(plan.identity.synthetic).toBe(true);
    expect(plan.identity.cloning).toBe(false);
    expect(plan.identity.voice).toBe('isabella-esmx-female-v1');
    expect(plan.normalizedText.length).toBeGreaterThan(0);
    expect(plan.cognitive.emotion.urgency).toBeTypeOf('number');
    expect(plan.plan.units.length).toBeGreaterThan(0);
    expect(plan.authorizationPerformed).toBe(false);
    expect(plan.executionPerformed).toBe(false);
  });

  it('requires a per-consent usage token for a personal profile', async () => {
    const engine = makeEngine();
    const consent = await engine.registerConsent(grant, 'admin');
    const profile = await engine.createProfile(
      { subjectRef: PERSON, label: 'Ana', tier: 'M' },
      'admin'
    );
    expect('reason' in profile).toBe(false);
    if ('reason' in profile) return;
    expect(profile.created).toBe(true);
    expect(profile.profile.synthetic).toBe(false);
    expect(profile.profile.voiceHint).toBe('isabella-esmx-female-v1');

    const blocked = await engine.plan({ text: 'Hola.', subjectRef: PERSON }, 'session:test-1234');
    expect(blocked.status).toBe('denied');
    if (blocked.status === 'denied') {
      expect(blocked.reason).toBe('IVCC_USAGE_TOKEN_REQUIRED');
    }

    const allowed = await engine.plan(
      { text: 'Hola.', subjectRef: PERSON, consentToken: consent.usageToken },
      'session:test-1234'
    );
    expect(allowed.status).toBe('planned');
    if (allowed.status === 'planned') {
      expect(allowed.identity.profileId).toBe(profile.profile.id);
      expect(allowed.identity.synthetic).toBe(false);
    }
  });

  it('synthesizes, masters and watermarks real WAV output end to end', async () => {
    const engine = makeEngine(makeTts());
    const result = await engine.synthesize(
      { text: 'Primera oración completa. Segunda oración completa.', mode: 'PODCAST' },
      'tester'
    );
    expect(result.status).toBe('planned');
    if (result.status === 'denied') return;
    expect(result.audioStatus).toBe('audio');
    expect(result.audio).not.toBeNull();
    expect(result.audio!.mimeType).toBe('audio/wav');
    expect(result.audio!.mastered).toBe(true);
    expect(result.audio!.watermarked).toBe(true);
    expect(result.mastering.status).toBe('mastered');
    expect(result.watermark.status).toBe('embedded');
    expect(result.tts.calls).toBeGreaterThanOrEqual(1);

    const encoded = result.audio!.dataUrl.split(',')[1]!;
    const detection = detectWavWatermark(
      new Uint8Array(Buffer.from(encoded, 'base64')),
      WATERMARK_KEY
    );
    expect(detection.signatureValid).toBe(true);
    expect(detection.audioSha256Valid).toBe(true);
    expect(detection.lsbValid).toBe(true);

    const audit = await engine.readAudit({}, 'admin');
    expect(audit.chainValid).toBe(true);
    expect(JSON.stringify(audit.events)).not.toContain('Primera oración');
    expect(audit.events.map((event) => event.event)).toContain('voice.synthesized');
  });

  it('returns an honest client plan when no TTS backend is wired', async () => {
    const result = await makeEngine().synthesize({ text: 'Hola. Gracias.' }, 'tester');
    expect(result.status).toBe('planned');
    if (result.status === 'denied') return;
    expect(result.audioStatus).toBe('client-plan');
    expect(result.audio).toBeNull();
    expect(result.mastering.status).toBe('skipped');
    expect(result.watermark.status).toBe('unavailable');
    expect(result.tts.ttsStatus).toBe('NOT_WIRED');
  });

  it('discards audio when consent is revoked while synthesis is in flight', async () => {
    let engineRef: IvccEngine | undefined;
    const engine = makeEngine(
      makeTts(async () => {
        await engineRef!.revoke({ subjectRef: PERSON }, 'admin');
      })
    );
    engineRef = engine;
    await engine.registerConsent(grant, 'admin');
    await engine.createProfile({ subjectRef: PERSON, label: 'Ana' }, 'admin');

    const result = await engine.synthesize(
      {
        text: 'Primera oración completa. Segunda oración completa.',
        subjectRef: PERSON,
        mode: 'PODCAST',
      },
      'admin',
      { allowWithoutUsageToken: true }
    );
    expect(result.status).toBe('denied');
    if (result.status === 'denied') {
      expect(result.reason).toBe('IVCC_CONSENT_REVOKED_DURING_SYNTHESIS');
    }
    expect(result).not.toHaveProperty('audio');
  });

  it('persists synthetic revocation across a restart instead of silently re-seeding', async () => {
    const store = new MemoryIvccStore();
    const first = new IvccEngine({
      store,
      subjectSalt: SUBJECT_SALT,
      watermarkKey: WATERMARK_KEY,
      tts: null,
    });
    await first.revoke({ subjectRef: 'synthetic:isabella' }, 'admin');

    const second = new IvccEngine({
      store,
      subjectSalt: SUBJECT_SALT,
      watermarkKey: WATERMARK_KEY,
      tts: null,
    });
    const plan = await second.plan({ text: 'Hola.' }, 'tester');
    expect(plan.status).toBe('denied');
    if (plan.status === 'denied') {
      expect(plan.reason).toBe('IVCC_SYNTHETIC_PROFILE_UNAVAILABLE');
    }
  });

  it('applies pronunciation memory and erases it on request', async () => {
    const engine = makeEngine();
    const consent = await engine.registerConsent(grant, 'admin');
    await engine.createProfile({ subjectRef: PERSON, label: 'Ana' }, 'admin');

    const learned = await engine.learnMemory(
      { subjectRef: PERSON, written: 'Kubernetes', spoken: 'Kúbernetes' },
      'admin'
    );
    expect('reason' in learned).toBe(false);
    if ('reason' in learned) return;
    expect(learned.entries).toBe(1);

    const withMemory = await engine.plan(
      { text: 'Uso Kubernetes.', subjectRef: PERSON, consentToken: consent.usageToken },
      'session:test-1234'
    );
    expect(withMemory.status).toBe('planned');
    if (withMemory.status === 'planned') {
      expect(withMemory.normalizedText).toContain('Kúbernetes');
      expect(withMemory.memory.applied).toBe(1);
    }

    await engine.eraseMemory(PERSON, 'admin');
    const withoutMemory = await engine.plan(
      { text: 'Uso Kubernetes.', subjectRef: PERSON, consentToken: consent.usageToken },
      'session:test-1234'
    );
    expect(withoutMemory.status).toBe('planned');
    if (withoutMemory.status === 'planned') {
      expect(withoutMemory.normalizedText).toContain('Kubernetes');
      expect(withoutMemory.normalizedText).not.toContain('Kúbernetes');
    }
  });
});
