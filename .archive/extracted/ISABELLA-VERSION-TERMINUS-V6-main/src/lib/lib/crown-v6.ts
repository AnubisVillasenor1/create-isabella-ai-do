/**
 * CROWN v6.0 — Fusión 5 + 12 nodos (isabella-ai-genesis + isabella-mexa)
 * Mantiene compatibilidad con CROWN v2.0 (5 módulos) y expone superset de 12 nodos.
 * 5 core: ISA, SOPHIA, ORION, ARGUS, CROWN
 * 7 extensiones territoriales/temporales: MNEMOSYNE, TELLUS, CHRONOS, HERMES, AXIOMA, PRAXIS, HARMONIA
 */
import { MODULES as MODULES_V2, type ModuleId as ModuleIdV2, CROWN_VERSION as V2 } from "./crown";
import { NODES as NODES_MEXA, type NodeId as NodeIdMexa } from "./isabella/crown-mexa-12";

export const CROWN_VERSION = "6.0.0-fusion";

export type ModuleId =
  ModuleIdV2 | "MNEMOSYNE" | "TELLUS" | "CHRONOS" | "HERMES" | "AXIOMA" | "PRAXIS" | "HARMONIA";
export type NodeId = NodeIdMexa; // 12

// Mapeo 5 -> 12 para cardinalización
export const MODULE_TO_NODE: Record<ModuleIdV2, NodeId> = {
  CROWN: "crown",
  ISA: "isa",
  SOPHIA: "sophia",
  ORION: "orion",
  ARGUS: "argus",
};

export const EXTENDED_MODULES = {
  ...MODULES_V2,
  MNEMOSYNE: {
    id: "MNEMOSYNE" as ModuleId,
    acronym: "MNEMOSYNE",
    fullName: "Memoria Pentacapa y Consolidación",
    role: "Vector LRU, Qdrant, consolidación histórica",
    pillars: ["Memoria", "Consolidación", "Recuperación"] as const,
    color: "var(--mnemosyne)",
    baseWeight: 0.86,
    latencyMs: 18,
  },
  TELLUS: {
    id: "TELLUS" as ModuleId,
    acronym: "TELLUS",
    fullName: "Ingesta Sensorial y Ledger Territorial",
    role: "Gemelo Digital, BookPI territorial",
    pillars: ["Sensor", "GEMET", "CITEMESH"] as const,
    color: "var(--tellus)",
    baseWeight: 0.8,
    latencyMs: 22,
  },
  CHRONOS: {
    id: "CHRONOS" as ModuleId,
    acronym: "CHRONOS",
    fullName: "Sincronía Temporal y Firma PQC",
    role: "PQC timestamping, Dilithium-5",
    pillars: ["PQC", "Sync", "Secuenciación"] as const,
    color: "var(--chronos)",
    baseWeight: 0.84,
    latencyMs: 10,
  },
  HERMES: {
    id: "HERMES" as ModuleId,
    acronym: "HERMES",
    fullName: "Router CITEMESH y Failover",
    role: "Mesh routing, Air-Gapped",
    pillars: ["Mesh", "Failover", "Gateway"] as const,
    color: "var(--hermes)",
    baseWeight: 0.78,
    latencyMs: 16,
  },
  AXIOMA: {
    id: "AXIOMA" as ModuleId,
    acronym: "AXIOMA",
    fullName: "Reglas Formales y Teoremas",
    role: "Rule engine, verificación invariantes",
    pillars: ["Reglas", "Prueba", "Restricciones"] as const,
    color: "var(--axioma)",
    baseWeight: 0.87,
    latencyMs: 24,
  },
  PRAXIS: {
    id: "PRAXIS" as ModuleId,
    acronym: "PRAXIS",
    fullName: "Ejecución WASM y Sandbox",
    role: "WASM launcher, MicroVM",
    pillars: ["WASM", "Audit", "Tool"] as const,
    color: "var(--praxis)",
    baseWeight: 0.77,
    latencyMs: 20,
  },
  HARMONIA: {
    id: "HARMONIA" as ModuleId,
    acronym: "HARMONIA",
    fullName: "Consenso Nodal y Balance YUN",
    role: "Fast consensus, equilibrio federado",
    pillars: ["Consenso", "YUN", "Equilibrio"] as const,
    color: "var(--harmonia)",
    baseWeight: 0.81,
    latencyMs: 26,
  },
} as const;

export const NODES_12 = NODES_MEXA;
export const MODULES_12 = EXTENDED_MODULES;
export const CROWN_V6 = {
  version: CROWN_VERSION,
  v2: V2,
  modules: MODULES_V2,
  extended: EXTENDED_MODULES,
  nodes: NODES_MEXA,
};
