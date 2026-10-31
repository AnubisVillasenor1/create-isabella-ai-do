import { describe, expect, it } from 'vitest';
import { SovereignRagStore } from './rag';

describe('SovereignRagStore', () => {
  it('retrieves relevant documents and excludes zero-similarity noise', () => {
    const store = new SovereignRagStore();
    store.add('ai', 'Isabella uses governed artificial intelligence');
    store.add('database', 'PostgreSQL persists account records');

    const hits = store.search('governed intelligence');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.id).toBe('ai');
    expect(hits.every((hit) => hit.score > 0)).toBe(true);
  });

  it('rebuilds vectors consistently when documents are added', () => {
    const store = new SovereignRagStore();
    store.add('a', 'alpha beta gamma');
    store.add('b', 'alpha delta epsilon');
    expect(store.size()).toBe(2);
    expect(store.search('alpha').map((hit) => hit.id)).toEqual(['a', 'b']);
  });

  it('ignores duplicate IDs without replacing the original document', () => {
    const store = new SovereignRagStore();
    store.add('same', 'original content');
    store.add('same', 'replacement content');
    expect(store.size()).toBe(1);
    expect(store.search('original')[0]?.text).toBe('original content');
    expect(store.search('replacement')).toEqual([]);
  });

  it('rejects empty document identifiers and content', () => {
    const store = new SovereignRagStore();
    expect(() => store.add(' ', 'valid text')).toThrow(TypeError);
    expect(() => store.add('valid-id', '  ')).toThrow(TypeError);
  });

  it('validates result limits and returns no results for empty queries', () => {
    const store = new SovereignRagStore();
    store.add('a', 'alpha beta');
    expect(store.search('   ')).toEqual([]);
    expect(store.search('alpha', 0)).toEqual([]);
    expect(() => store.search('alpha', -1)).toThrow(RangeError);
    expect(() => store.search('alpha', 1.5)).toThrow(RangeError);
  });
});
