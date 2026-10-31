// state: draft | engine-generated — Anclaje Merkle del libro mayor BookPI (Documento §XII).
// La instantánea del ledger (`src/bookpi/ledger.ts`) expone `merkleRoot: null`: la cadena
// SHA-256 encadena bloques, pero no ofrece una RAÍZ de Merkle ni PRUEBAS DE INCLUSIÓN por
// evento. Este módulo cierra esa laguna real: calcula una raíz Merkle SHA-256 RFC-style sobre
// los hashes de los eventos ya sellados y genera/verifica pruebas de inclusión O(log N) para un
// evento concreto. Reutiliza el motor de `./merkle` (no duplica criptografía). NO reescribe el
// ledger ni toca su cadena: deriva anclajes desde la LISTA de eventos que recibe. Un anclaje
// verde demuestra integridad estructural, NO autoridad ni producción (AGENTS.md §1).
import { buildMerkleTree, generateMerkleProof, verifyChunkProof, type ChunkProof } from './merkle';
import type { BookPiEvent } from './ledger';

/** Huella de un evento para la hoja del árbol: su hash de cadena ya sellado (hex SHA-256). */
export function ledgerLeafHashes(events: readonly BookPiEvent[]): string[] {
  return events.map((event) => event.hash);
}

export interface LedgerAnchor {
  readonly scheme: 'MERKLE-SHA256-BOOKPI';
  readonly merkleRoot: string;
  readonly leafCount: number;
  readonly firstEventId: string | null;
  readonly lastEventId: string | null;
  readonly anchoredAt: string;
}

/**
 * Calcula el anclaje Merkle del conjunto de eventos. Devuelve `null` si el libro está vacío
 * (no se inventa una raíz sobre cero hojas). Determinista: el mismo orden de eventos produce
 * la misma raíz.
 */
export function anchorLedger(
  events: readonly BookPiEvent[],
  clock: () => string = () => new Date().toISOString()
): LedgerAnchor | null {
  if (events.length === 0) return null;
  const { root } = buildMerkleTree(ledgerLeafHashes(events));
  return Object.freeze({
    scheme: 'MERKLE-SHA256-BOOKPI',
    merkleRoot: root,
    leafCount: events.length,
    firstEventId: events[0]?.id ?? null,
    lastEventId: events.at(-1)?.id ?? null,
    anchoredAt: clock(),
  });
}

export interface LedgerInclusionProof {
  eventId: string;
  eventHash: string;
  merkleRoot: string;
  leafCount: number;
  proofPath: ChunkProof['proofPath'];
}

/**
 * Genera la prueba de inclusión de un evento (identificado por `id`) dentro del anclaje.
 * Falla si el id es desconocido o si el evento aparece duplicado (ambigüedad de posición).
 */
export function proveEventInclusion(
  events: readonly BookPiEvent[],
  eventId: string
): LedgerInclusionProof {
  const positions = events.reduce<number[]>((acc, event, index) => {
    if (event.id === eventId) acc.push(index);
    return acc;
  }, []);
  if (positions.length === 0) throw new Error('BOOKPI_ANCHOR_EVENT_NOT_FOUND');
  if (positions.length > 1) throw new Error('BOOKPI_ANCHOR_EVENT_AMBIGUOUS');
  const index = positions[0] as number;
  const leafHashes = ledgerLeafHashes(events);
  const proof = generateMerkleProof(leafHashes, index);
  const event = events[index];
  if (!event) throw new Error('BOOKPI_ANCHOR_EVENT_NOT_FOUND');
  return {
    eventId: event.id,
    eventHash: event.hash,
    merkleRoot: proof.root,
    leafCount: leafHashes.length,
    proofPath: proof.proofPath,
  };
}

/** Verifica una prueba de inclusión contra la raíz anunciada, sin necesitar el resto del libro. */
export function verifyEventInclusion(proof: LedgerInclusionProof): boolean {
  return verifyChunkProof({
    chunkIndex: 0,
    chunkHash: proof.eventHash,
    proofPath: proof.proofPath,
    root: proof.merkleRoot,
  });
}

/**
 * Comprueba la consistencia raíz ↔ evento: si el evento sigue presente en `events` y su hash
 * es el anclado, y la prueba verifica contra la raíz del anclaje actual. Detecta un evento
 * alterado o ausente respecto del anclaje publicado.
 */
export function verifyAnchorConsistency(
  events: readonly BookPiEvent[],
  anchor: LedgerAnchor,
  eventId: string
): boolean {
  const current = anchorLedger(events);
  if (!current || current.merkleRoot !== anchor.merkleRoot) return false;
  const event = events.find((e) => e.id === eventId);
  if (!event) return false;
  const proof = proveEventInclusion(events, eventId);
  return verifyEventInclusion(proof);
}
