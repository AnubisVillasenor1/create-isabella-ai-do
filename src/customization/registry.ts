// ISABELLA Ω · Registro de customizaciones nativas (state: draft | engine-generated).
//
// Almacena reglas, skills, plugins, hooks y servidores MCP como entidades inmutables
// y expone conteos y un digest determinista.
//
// Invariante: registrar NO autoriza, NO instala y NO ejecuta; sólo cataloga.
import { manifestDigest } from '../skills/canonical-json';
import { CUSTOMIZATION_KINDS, type CustomizationEntry, type CustomizationKind } from './types';

function emptyKindCounts(): Record<CustomizationKind, number> {
  const counts = {} as Record<CustomizationKind, number>;
  for (const kind of CUSTOMIZATION_KINDS) counts[kind] = 0;
  return counts;
}

export class CustomizationRegistry {
  private readonly entries = new Map<string, CustomizationEntry>();

  register(entry: CustomizationEntry): void {
    if (!entry.id.trim() || !entry.version.trim() || !entry.kind) {
      throw new Error('CUSTOMIZATION_INVALID_DESCRIPTOR');
    }
    if (this.entries.has(entry.id)) {
      throw new Error(`CUSTOMIZATION_DUPLICATE:${entry.id}`);
    }
    this.entries.set(entry.id, Object.freeze({ ...entry }));
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  get(id: string): CustomizationEntry | undefined {
    return this.entries.get(id);
  }

  list(): readonly CustomizationEntry[] {
    return [...this.entries.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  listByKind(kind: CustomizationKind): readonly CustomizationEntry[] {
    return this.list().filter((entry) => entry.kind === kind);
  }

  countByKind(): Readonly<Record<CustomizationKind, number>> {
    const counts = emptyKindCounts();
    for (const entry of this.entries.values()) counts[entry.kind] += 1;
    return Object.freeze(counts);
  }

  /** Digest determinista sobre la identidad de las entidades (id, versión, tipo, estado). */
  manifest(): string {
    return manifestDigest(
      this.list().map((entry) => ({
        id: entry.id,
        version: entry.version,
        kind: entry.kind,
        state: entry.state,
      }))
    );
  }
}
