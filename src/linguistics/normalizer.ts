export class SpanishNormalizer {
  clean(input: string): string {
    return input.normalize('NFKC').toLocaleLowerCase('es-MX').replace(/\s+/g, ' ').trim();
  }

  stripAccents(input: string): string {
    return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  tokens(input: string): string[] {
    return this.clean(input)
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
  }
}
