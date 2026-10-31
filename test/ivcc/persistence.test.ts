import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { IvccEngine } from '../../src/ivcc/engine';
import { loadIvccSecrets } from '../../src/ivcc/secrets';
import { JsonFileIvccStore } from '../../src/ivcc/store';

const directories: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ivcc-store-'));
  directories.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of directories.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('IVCC durable persistence', () => {
  it('reuses persisted salt and watermark key across restarts', () => {
    const dir = tempDir();
    const first = loadIvccSecrets({}, dir);
    const second = loadIvccSecrets({}, dir);
    expect(first.source).toEqual({ subjectSalt: 'store', watermarkKey: 'store' });
    expect(first.subjectSalt.equals(second.subjectSalt)).toBe(true);
    expect(first.watermarkKey.equals(second.watermarkKey)).toBe(true);
  });

  it('keeps engine state, profiles and audit chain across instances', async () => {
    const dir = tempDir();
    const store = JsonFileIvccStore.at(dir);
    const secrets = loadIvccSecrets({}, dir);
    const first = new IvccEngine({
      store,
      subjectSalt: secrets.subjectSalt,
      watermarkKey: secrets.watermarkKey,
      tts: null,
    });
    const planned = await first.plan({ text: 'Hola. Gracias por tu ayuda.' }, 'tester');
    expect(planned.status).toBe('planned');

    const second = new IvccEngine({
      store: JsonFileIvccStore.at(dir),
      subjectSalt: secrets.subjectSalt,
      watermarkKey: secrets.watermarkKey,
      tts: null,
    });
    const status = await second.status();
    expect(status.persistence).toMatchObject({ kind: 'file', durable: true });
    expect(status.cloning).toBe(false);

    const audit = await second.readAudit({}, 'admin');
    expect(audit.chainValid).toBe(true);
    expect(audit.total).toBeGreaterThan(0);
    expect(audit.events.map((event) => event.event)).toContain('system.baseline');
  });

  it('persists permanent synthetic revocation across file-store restarts', async () => {
    const dir = tempDir();
    const secrets = loadIvccSecrets({}, dir);
    const first = new IvccEngine({
      store: JsonFileIvccStore.at(dir),
      subjectSalt: secrets.subjectSalt,
      watermarkKey: secrets.watermarkKey,
      tts: null,
    });
    await first.revoke({ subjectRef: 'synthetic:isabella' }, 'admin');

    const second = new IvccEngine({
      store: JsonFileIvccStore.at(dir),
      subjectSalt: secrets.subjectSalt,
      watermarkKey: secrets.watermarkKey,
      tts: null,
    });
    const plan = await second.plan({ text: 'Hola.' }, 'tester');
    expect(plan.status).toBe('denied');
    if (plan.status === 'denied') {
      expect(plan.reason).toBe('IVCC_SYNTHETIC_PROFILE_UNAVAILABLE');
    }
  });
});
