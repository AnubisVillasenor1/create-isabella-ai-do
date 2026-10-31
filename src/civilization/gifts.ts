/**
 * ISABELLA Ω · COGNITIVE CIVILIZATION RUNTIME (CCR-1) — Los 20 regalos Ω.
 *
 * state: draft | engine-generated.
 *
 * El spec CCR-1 (v2.0.0 §4) enumera veinte "regalos" de la civilización cognitiva.
 * Este módulo los mapea a las capas Ω que los sostienen y declara, para cada uno,
 * el estado REA L en este repositorio, contrastando la afirmación del spec
 * (`claimed`) con la evaluación honesta (`status` + `reality`).
 *
 * No confundir con `src/gifts/` (el "Legado de los regalos", diez capacidades
 * pedagógicas). Aquí los "regalos Ω" son capacidades de civilización del spec CCR-1.
 */
import type { CivilizationLayerStatus } from './layers';

export interface CivilizationGift {
  /** Código canónico del regalo (p. ej. Q-ECTS, CM-ET...). */
  readonly id: string;
  readonly order: number;
  readonly name: string;
  /** Capas Ω que este regalo materializa. */
  readonly layerIds: readonly string[];
  /** Lo que el spec CCR-1 afirma de este regalo. */
  readonly claimed: string;
  /** Estado honesto evaluado contra el repositorio real. */
  readonly status: CivilizationLayerStatus;
  readonly reality: string;
}

export const CIVILIZATION_GIFTS: readonly CivilizationGift[] = Object.freeze([
  {
    id: 'Q-ECTS',
    order: 1,
    name: 'Quantum-Enhanced Consensus & Trust Swarm',
    layerIds: ['Ω-0', 'Ω-8'],
    claimed: 'Consenso BFT real; el componente cuántico es un bridge simulado.',
    status: 'PARTIAL',
    reality:
      'Clasificación y auditoría de flujo reales; el bridge cuántico (PennyLane) es SIMULADO (HTTP, se declara no disponible sin endpoint). No se simula la ventaja cuántica.',
  },
  {
    id: 'IC-AEE',
    order: 2,
    name: 'Intent-Classifying Anti-Embedding Egress',
    layerIds: ['Ω-10'],
    claimed: 'Clasificador de intención + rate-limiting real.',
    status: 'IMPLEMENTED',
    reality: 'CROWN (assessIntent) + AEGIS + rate-limit de ventana fija reales y testeables.',
  },
  {
    id: 'CED-HD',
    order: 3,
    name: 'Constitution-Enforcing Decision & Human Delegation',
    layerIds: ['Ω-6'],
    claimed: 'OPA/Rego real, no inquebrantable.',
    status: 'PARTIAL',
    reality:
      'Compuerta CROWN y mapa de permisos reales; el compilador de leyes→Rego/OPA NO está cableado. Se declara PARCIAL.',
  },
  {
    id: 'EFM-CCI',
    order: 4,
    name: 'Evidence-First Memory & Cryptographic Chain of Integrity',
    layerIds: ['Ω-7'],
    claimed: 'Real y validado — BookPI SHA3-512.',
    status: 'IMPLEMENTED',
    reality:
      'BookPI: SHA-256 (event hash) + SHA3-512 (integridad) + Merkle + RFC6962 STH + Ed25519, reales.',
  },
  {
    id: '12H-24EF',
    order: 5,
    name: '12-Hour / 24-Expert Federation',
    layerIds: ['Ω-8'],
    claimed: 'MoE real con vLLM.',
    status: 'PARTIAL',
    reality:
      'MoE real con 24 expertos canónicos (GENESIS_EXPERTS) y 7 federaciones; la inferencia vLLM externa y los 1024 microexpertos son SPECIFIED.',
  },
  {
    id: 'CM-ET',
    order: 6,
    name: 'Cost & Energy Telemetry Mesh',
    layerIds: ['Ω-9'],
    claimed: 'Dashboard de costes/energía real.',
    status: 'PARTIAL',
    reality:
      'Telemetría y entradas económicas reales; el cómputo de energía por inferencia es PARCIAL (sin contadores de hardware).',
  },
  {
    id: 'ES-OI',
    order: 7,
    name: 'Egress-Shaping & Output-Integrity',
    layerIds: ['Ω-6', 'Ω-10'],
    claimed: 'Clasificador + filtros, no infalible.',
    status: 'PARTIAL',
    reality:
      'Semáforo de flujo, VIGIA (triple bloqueo) y Grounding Guard reales; no es infalible: se declara como filtro, no como garantía.',
  },
  {
    id: 'OR-XRV',
    order: 8,
    name: 'Open Reality / Extended Reality Verification',
    layerIds: ['Ω-2'],
    claimed: 'Datos georreferenciados reales.',
    status: 'PARTIAL',
    reality:
      'Contexto territorial y seguridad XR reales; el gemelo digital es declarativo. El forecast/simulación NO está cableado.',
  },
  {
    id: 'PMV-LA',
    order: 9,
    name: 'Persistent Memory & Vector/Lexical Association',
    layerIds: ['Ω-1', 'Ω-3'],
    claimed: 'RAG + grafos semánticos reales.',
    status: 'PARTIAL',
    reality:
      'Recuperación RAG léxica/verificada (IKES) real; el grafo semántico persistente (Neo4j/Qdrant) es SPECIFIED.',
  },
  {
    id: 'AA-CD',
    order: 10,
    name: 'Autonomous Action & Containment Defense',
    layerIds: ['Ω-5', 'Ω-12'],
    claimed: 'gVisor + TPM + rollback real.',
    status: 'PARTIAL',
    reality:
      'Circuit breaker y gates de rollback reales; el aislamiento gVisor/TPM es de infraestructura y NO se ejerce aquí. El motor de ciencia autónoma (Ω-5) NO está cableado.',
  },
  {
    id: 'CME',
    order: 11,
    name: 'Civilizational Memory Engine',
    layerIds: ['Ω-1'],
    claimed: 'Memoria multi-dominio real.',
    status: 'PARTIAL',
    reality: 'IKES + procedencia + fabric en memoria reales; el sustrato distribuido es SPECIFIED.',
  },
  {
    id: 'ASE',
    order: 12,
    name: 'Autonomous Science Engine',
    layerIds: ['Ω-5'],
    claimed: 'Hipótesis → experimento → paper.',
    status: 'NOT_WIRED',
    reality: 'Ausente en este repositorio. Declarado, no simulado.',
  },
  {
    id: 'RTM',
    order: 13,
    name: 'Reality Twin Mesh',
    layerIds: ['Ω-2'],
    claimed: 'Gemelo digital de escenarios real.',
    status: 'PARTIAL',
    reality:
      'Gemelo declarativo territorial real; la malla de escenarios con forecast es SPECIFIED.',
  },
  {
    id: 'PCR',
    order: 14,
    name: 'Policy Compiler Runtime',
    layerIds: ['Ω-6'],
    claimed: 'Rego → runtime real.',
    status: 'PARTIAL',
    reality: 'CROWN + permission-map + explicación reales; el compilador Rego NO está cableado.',
  },
  {
    id: 'PKG',
    order: 15,
    name: 'Planetary Knowledge Graph',
    layerIds: ['Ω-3'],
    claimed: 'Grafo planetario real.',
    status: 'SPECIFIED',
    reality: 'Sólo admisión de conocimiento y procedencia. El grafo planetario es SPECIFIED.',
  },
  {
    id: 'MRE',
    order: 16,
    name: 'Meta-Reasoning Engine',
    layerIds: ['Ω-4'],
    claimed: 'Razona sobre su razonamiento.',
    status: 'PARTIAL',
    reality:
      'Camino de razonamiento, explicación de política y contradicciones reales; la reflexión profunda es PARCIAL.',
  },
  {
    id: 'NGL',
    order: 17,
    name: 'Neural Governance Layer',
    layerIds: ['Ω-10'],
    claimed: 'Anticipa riesgo/sesgo/corrupción.',
    status: 'IMPLEMENTED',
    reality:
      'UAGP (gameover), adjudicación (reina) y defensa (osiris) reales. Emite veredictos, no ejecuta.',
  },
  {
    id: 'ECE',
    order: 18,
    name: 'Economic Consciousness Engine',
    layerIds: ['Ω-9'],
    claimed: 'Conciencia económica real.',
    status: 'PARTIAL',
    reality:
      'Entradas económicas y telemetría reales; la consciencia económica plena es SPECIFIED.',
  },
  {
    id: 'SEE',
    order: 19,
    name: 'Self-Evolution Engine',
    layerIds: ['Ω-11'],
    claimed: 'Auto-diagnóstico y reorganización.',
    status: 'PARTIAL',
    reality:
      'Fabric de evolución real con transiciones gobernadas; la auto-promoción a `wired` está PROHIBIDA (exige humano).',
  },
  {
    id: 'AFC',
    order: 20,
    name: 'Antifragility Core',
    layerIds: ['Ω-12'],
    claimed: 'Cada fallo endurece el sistema.',
    status: 'PARTIAL',
    reality: 'Circuit breaker y rollback reales; la inyección de caos NO está cableada.',
  },
]);

export const CIVILIZATION_GIFT_COUNT = CIVILIZATION_GIFTS.length;

export function civilizationGiftById(id: string): CivilizationGift | undefined {
  return CIVILIZATION_GIFTS.find((gift) => gift.id === id);
}

export function giftsForLayer(layerId: string): readonly CivilizationGift[] {
  return CIVILIZATION_GIFTS.filter((gift) => gift.layerIds.includes(layerId));
}
