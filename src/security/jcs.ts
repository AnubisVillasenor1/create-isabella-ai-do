export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('JCS: non-finite number');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return (
      '{' +
      keys.map((k) => JSON.stringify(k) + ':' + canonicalize((value as any)[k])).join(',') +
      '}'
    );
  }
  throw new Error('JCS: unsupported type');
}
