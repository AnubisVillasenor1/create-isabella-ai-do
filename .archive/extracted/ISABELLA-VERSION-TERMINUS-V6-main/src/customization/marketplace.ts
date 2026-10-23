// ISABELLA Ω · Marketplace de capacidades (state: draft | engine-generated).
//
// Agrega el catálogo nativo de customizaciones y lo resuelve contra el registro vivo:
// enumera, resuelve packs de plugin y produce un PLAN. Es una superficie de solo
// lectura/propuesta.
//
// Invariante: catalogar, resolver y planificar NO autoriza, NO instala y NO ejecuta.
// Todo pack sale `enabled: false` y `requiresHumanApproval: true`.
import { sha256 } from "../skills/canonical-json";
import type { CustomizationRegistry } from "./registry";
import type { CustomizationEntry, CustomizationKind, CustomizationScope, CustomizationState } from "./types";

export const MARKETPLACE_METHOD_ID =
  "A.YUN.MARKETPLACE.catalog_customizations.v1.0.0.LOW.INSTITUTIONAL" as const;

export const MARKETPLACE_DISCLAIMER =
  "Catálogo y marketplace de solo lectura: enumerar, resolver y planificar NO autoriza, NO instala y NO ejecuta." as const;

export interface MarketplaceCatalog {
  readonly methodId: string;
  readonly disclaimer: string;
  readonly kindCounts: Readonly<Record<CustomizationKind, number>>;
  readonly entries: readonly CustomizationEntry[];
}

export interface MarketplaceInventory {
  readonly customizations: number;
  readonly skills: number;
  readonly tools: number;
  readonly protocols: number;
  readonly modules: number;
  readonly capabilities: number;
}

export interface MarketplaceSnapshot {
  readonly methodId: string;
  readonly disclaimer: string;
  readonly digest: string;
  readonly customizationDigest: string;
  readonly kindCounts: Readonly<Record<CustomizationKind, number>>;
  readonly inventory: MarketplaceInventory;
  readonly authorizationPerformed: false;
  readonly executionPerformed: false;
}

export interface MarketplaceResolution {
  readonly id: string;
  readonly kind: CustomizationKind;
  readonly present: boolean;
}

export interface MarketplacePack {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly state: CustomizationState;
  readonly scope: CustomizationScope;
  readonly description: string;
  readonly enabled: false;
  readonly requiresHumanApproval: true;
  readonly digest: string;
  readonly resolution: readonly MarketplaceResolution[];
  readonly missing: readonly string[];
}

export interface MarketplacePlan {
  readonly methodId: string;
  readonly packId: string;
  readonly status: "PLANNED_NOT_ENABLED";
  readonly enabled: false;
  readonly authorizationPerformed: false;
  readonly executionPerformed: false;
  readonly requiresHumanApproval: true;
  readonly missing: readonly string[];
  readonly steps: readonly string[];
}

export function buildMarketplaceCatalog(registry: CustomizationRegistry): MarketplaceCatalog {
  const entries = registry.list();
  return Object.freeze({
    methodId: MARKETPLACE_METHOD_ID,
    disclaimer: MARKETPLACE_DISCLAIMER,
    kindCounts: registry.countByKind(),
    entries,
  });
}

export function buildMarketplaceSnapshot(
  registry: CustomizationRegistry,
  inventory: MarketplaceInventory,
): MarketplaceSnapshot {
  const customizationDigest = registry.manifest();
  const digest = sha256({
    methodId: MARKETPLACE_METHOD_ID,
    customizationDigest,
    inventory,
  });
  return Object.freeze({
    methodId: MARKETPLACE_METHOD_ID,
    disclaimer: MARKETPLACE_DISCLAIMER,
    digest,
    customizationDigest,
    kindCounts: registry.countByKind(),
    inventory,
    authorizationPerformed: false as const,
    executionPerformed: false as const,
  });
}

/** Resuelve las entradas referenciadas por un pack de plugin contra el registro vivo. */
export function resolveMarketplacePack(
  entry: CustomizationEntry,
  registry: CustomizationRegistry,
): MarketplacePack {
  if (entry.kind !== "plugin") throw new Error("MARKETPLACE_PACK_NOT_PLUGIN");

  const refs: readonly { id: string; kind: CustomizationKind }[] = [
    ...entry.bundles.rules.map((id) => ({ id, kind: "rule" as const })),
    ...entry.bundles.skills.map((id) => ({ id, kind: "skill" as const })),
    ...entry.bundles.hooks.map((id) => ({ id, kind: "hook" as const })),
    ...entry.bundles.mcpServers.map((id) => ({ id, kind: "mcp-server" as const })),
  ];

  const resolution: readonly MarketplaceResolution[] = refs.map((reference) => {
    const found = registry.get(reference.id);
    return { id: reference.id, kind: reference.kind, present: found !== undefined && found.kind === reference.kind };
  });
  const missing = resolution.filter((item) => !item.present).map((item) => item.id);
  const digest = sha256({ id: entry.id, version: entry.version, entries: resolution });

  return Object.freeze({
    id: entry.id,
    name: entry.displayName ?? entry.id,
    version: entry.version,
    state: entry.state,
    scope: entry.scope,
    description: entry.description,
    enabled: false as const,
    requiresHumanApproval: true as const,
    digest,
    resolution,
    missing,
  });
}

export function planMarketplaceEnablement(pack: MarketplacePack): MarketplacePlan {
  const steps = [
    pack.missing.length === 0
      ? "Todas las entradas del pack están registradas en el catálogo nativo."
      : `Falta registrar en el catálogo nativo: ${pack.missing.join(", ")}.`,
    "Revisión humana con nombre (AGENTS.md §7): state draft → verified.",
    "La instalación/habilitación se aprueba fuera de banda; el runtime no instala ni habilita packs.",
  ];
  return Object.freeze({
    methodId: MARKETPLACE_METHOD_ID,
    packId: pack.id,
    status: "PLANNED_NOT_ENABLED" as const,
    enabled: false as const,
    authorizationPerformed: false as const,
    executionPerformed: false as const,
    requiresHumanApproval: true as const,
    missing: pack.missing,
    steps,
  });
}
