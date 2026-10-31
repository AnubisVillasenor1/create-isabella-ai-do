import { describe, expect, it } from 'vitest';
import { BargeInRegistry, SentenceChunker, chunkPauseMs } from '../../src/tts/streaming';

describe('SentenceChunker', () => {
  it('emits only complete sentences and merges fragments below minLength', () => {
    const chunker = new SentenceChunker({ minLength: 6 });
    expect(chunker.feed('Hola. ')).toEqual([]);
    expect(chunker.feed('¿Cómo estás? ')).toEqual(['Hola. ¿Cómo estás?']);
    expect(chunker.feed('Todo bien, gracias.')).toEqual([]);
    expect(chunker.flush()).toEqual(['Todo bien, gracias.']);
    expect(chunker.pendingChars).toBe(0);
  });

  it('recognises Spanish terminal punctuation and paragraph boundaries', () => {
    const chunker = new SentenceChunker({ minLength: 4 });
    const out = chunker.feed('Primera línea.\n\nSegunda línea… ¿Listo? ¡Claro! ');
    expect(out).toEqual(['Primera línea.', 'Segunda línea…', '¿Listo?', '¡Claro!']);
  });

  it('never speaks a reasoning block, even when the tag is split across deltas', () => {
    const chunker = new SentenceChunker({ minLength: 4 });
    expect(chunker.feed('<thi')).toEqual([]);
    expect(chunker.feed('nk>cadena interna</think>Respuesta visible. ')).toEqual([
      'Respuesta visible.',
    ]);
    expect(chunker.flush()).toEqual([]);
  });

  it('holds an unterminated reasoning block and flushes only the text before it', () => {
    const chunker = new SentenceChunker({ minLength: 4 });
    expect(chunker.feed('Prefacio claro. <thinking>secreto')).toEqual([]);
    expect(chunker.flush()).toEqual(['Prefacio claro.']);
  });

  it('hard-splits an oversized sentence below the chunk ceiling', () => {
    const chunker = new SentenceChunker({ maxChunkChars: 40, minLength: 4 });
    const text =
      'Esta oración es deliberadamente larga, con varias cláusulas, para forzar un corte seguro y acotado. ';
    const out = chunker.feed(text);
    expect(out.length).toBeGreaterThan(1);
    for (const chunk of out) expect(chunk.length).toBeLessThanOrEqual(40);
  });

  it('bounds a runaway buffer by force-splitting it', () => {
    const chunker = new SentenceChunker({ maxBufferChars: 256, maxChunkChars: 64, minLength: 4 });
    const out = chunker.feed('palabra '.repeat(120));
    expect(out.length).toBeGreaterThan(0);
    expect(chunker.pendingChars).toBeLessThan(256);
  });

  it('ignores empty and non-string deltas safely', () => {
    const chunker = new SentenceChunker();
    expect(chunker.feed('')).toEqual([]);
    expect(chunker.feed(undefined as unknown as string)).toEqual([]);
    chunker.reset();
    expect(chunker.pendingChars).toBe(0);
  });
});

describe('BargeInRegistry', () => {
  it('consumes a mark once and expires it by TTL', () => {
    let now = 1_000;
    const registry = new BargeInRegistry({ ttlMs: 5_000, now: () => now });
    expect(registry.consume('session:abc')).toBe(false);
    expect(registry.mark('session:abc')).toBe(true);
    expect(registry.consume('session:abc')).toBe(true);
    expect(registry.consume('session:abc')).toBe(false);
    registry.mark('session:abc');
    now += 5_000;
    expect(registry.consume('session:abc')).toBe(false);
    expect(registry.size).toBe(0);
  });

  it('rejects empty or control-character keys and is scoped per actor', () => {
    const registry = new BargeInRegistry({ now: () => 0 });
    expect(registry.mark('')).toBe(false);
    expect(registry.mark('bad key')).toBe(false);
    expect(registry.mark('session:a')).toBe(true);
    expect(registry.consume('session:b')).toBe(false);
    expect(registry.clear('session:a')).toBe(true);
  });

  it('caps retained entries', () => {
    const registry = new BargeInRegistry({ maxEntries: 2, now: () => 0 });
    registry.mark('session:a');
    registry.mark('session:b');
    registry.mark('session:c');
    expect(registry.size).toBe(2);
    expect(registry.consume('session:a')).toBe(false);
    expect(registry.consume('session:c')).toBe(true);
  });
});

describe('chunkPauseMs', () => {
  it('uses punctuation-derived bounds and emotion scaling', () => {
    expect(chunkPauseMs('Hola.')).toBe(420);
    expect(chunkPauseMs('¿Listo?')).toBe(378);
    expect(chunkPauseMs('Espera…')).toBe(600);
    expect(chunkPauseMs('Texto\n')).toBe(707);
    expect(chunkPauseMs('Hola.', { urgency: 1 })).toBeLessThan(420);
    expect(chunkPauseMs('Hola.', { calm: 1 })).toBeGreaterThan(420);
    expect(chunkPauseMs('Hola.', { urgency: 99, calm: 99 })).toBeLessThanOrEqual(900);
  });
});
