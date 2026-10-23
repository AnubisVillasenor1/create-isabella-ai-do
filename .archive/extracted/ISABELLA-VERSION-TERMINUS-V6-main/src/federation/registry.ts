/**
 * TAMV Federation Registry Ω — fuente canónica de las 7 federaciones (canon v40).
 *
 * state: draft | engine-generated.
 *
 * El repositorio representa las "7 federaciones" de tres formas divergentes:
 *   - `src/authority/method-id.ts`  → `YUN_FEDERATIONS` (códigos YUN).
 *   - `src/isabella/engine.ts`      → nombres de producto (Sociológica, …).
 *   - `src/bookpi/royalties.ts`     → `federationId` numérico 1..7.
 *
 * Este registro es la **fuente única de verdad**: asigna a cada federación un id
 * estable 1..7 (en el orden de `YUN_FEDERATIONS`) y una etiqueta de producto, y
 * ofrece el mapeo id ↔ código YUN. No sustituye la autoridad de CROWN; sólo
 * canonicaliza la identidad de las federaciones.
 */
import { sha256 } from "../skills/canonical-json";
import { YUN_FEDERATIONS, type YunFederation, type GovernanceTier } from "../authority/method-id";

export interface TamvFederation {
  /** Id estable 1..7. */
  readonly id: number;
  /** Código YUN del method-id. */
  readonly yun: YunFederation;
  /** Etiqueta de producto. */
  readonly name: string;
  /** Responsabilidad de la federación. */
  readonly domain: string;
  /** Governance tier por defecto. */
  readonly governanceTier: GovernanceTier;
}

export const TAMV_FEDERATION_COUNT = 7;

export const TAMV_FEDERATIONS: readonly TamvFederation[] = Object.freeze(
  [
    { id: 1, yun: "IDENTITY", name: "Identidad", domain: "soberanía de identidad y consentimiento", governanceTier: "CONSTITUTIONAL" },
    { id: 2, yun: "PATRIMONY", name: "Patrimonio", domain: "acervo cultural y ledger patrimonial", governanceTier: "TERRITORIAL" },
    { id: 3, yun: "TOURISM", name: "Turismo", domain: "experiencia territorial y rutas", governanceTier: "TERRITORIAL" },
    { id: 4, yun: "ECONOMY", name: "Economía", domain: "economía y créditos MDD-TAMV", governanceTier: "INSTITUTIONAL" },
    { id: 5, yun: "TWINS", name: "Gemelos Digitales", domain: "gemelos digitales (YUN)", governanceTier: "INSTITUTIONAL" },
    { id: 6, yun: "COLLECTIVE_INTELLIGENCE", name: "Inteligencia Colectiva", domain: "cognición federada y consenso", governanceTier: "OPERATIONAL" },
    { id: 7, yun: "RESILIENCE", name: "Resiliencia", domain: "resiliencia y continuidad", governanceTier: "CONSTITUTIONAL" },
  ] satisfies readonly TamvFederation[],
);

const BY_ID = new Map(TAMV_FEDERATIONS.map((federation) => [federation.id, federation]));
const BY_YUN = new Map(YUN_FEDERATIONS.map((yun, index) => [yun, TAMV_FEDERATIONS[index]]));

export function isFederationId(value: number): boolean {
  return Number.isInteger(value) && BY_ID.has(value);
}

export function federationById(id: number): TamvFederation {
  const federation = BY_ID.get(id);
  if (!federation) throw new Error(`FEDERATION_UNKNOWN_ID:${id}`);
  return federation;
}

export function federationByYun(yun: YunFederation): TamvFederation {
  const federation = BY_YUN.get(yun);
  if (!federation) throw new Error(`FEDERATION_UNKNOWN_YUN:${yun}`);
  return federation;
}

export function listFederations(): readonly TamvFederation[] {
  return TAMV_FEDERATIONS;
}

/** Digest determinista del registro (detección de deriva del canon). */
export const FEDERATION_MANIFEST_DIGEST: string = sha256(
  TAMV_FEDERATIONS.map((federation) => ({ id: federation.id, yun: federation.yun })),
);

/** Divergencia documentada: nombres alternativos en `src/isabella/engine.ts`. */
export const ISABELLA_ENGINE_FEDERATION_LABELS: readonly string[] = [
  "Sociologica",
  "Identidad",
  "Gobernanza",
  "Territorial",
  "Educativa",
  "Tecnologica",
  "Economica",
];
