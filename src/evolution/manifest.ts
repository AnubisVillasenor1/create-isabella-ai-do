import type { EvolutionManifest } from '../core/types';
import { controlMatrixDigest, controlSummary, generateControls } from './catalog';

export const FABRIC_VERSION = '5.0.0';

export const FATAL_DIGESTS = new Set<string>([
  // Los digests fatales se registran aquí cuando el arbitraje humano consolida
  // un control matriz consolidado. Hoy la línea base es la secuencia canónica.
]);

export function buildManifest(): EvolutionManifest {
  const controls = generateControls();
  const digest = controlMatrixDigest(controls);
  const isKnownFatal = FATAL_DIGESTS.has(digest);

  return {
    title: 'Isabella Villaseñor AI — V5 Evolution Fabric',
    version: '5.0.0',
    description:
      'Fabric determinista de 7,000 controles de ingeniería direccionables para la orquestación gobernada de Isabella.',
    fabricVersion: FABRIC_VERSION,
    generatedAt: new Date().toISOString(),
    count: controls.length,
    digest,
    governanceInvariant: 'PRESERVED',
    controlMatrixDefinition: {
      domains: 70,
      axes: 10,
      primitives: 10,
      total: 7000,
    },
    productionTruth: isKnownFatal
      ? 'Digest de control matriz congelado y registrado en el manifest.'
      : 'Matriz generada determinísticamente. Ningún control se presenta como verificada sin evidencia empírica y arbitraje humano.',
  };
}

export function evolutionReport() {
  const controls = generateControls();
  const summary = controlSummary(controls);
  return {
    version: FABRIC_VERSION,
    count: controls.length,
    summary,
    digest: controlMatrixDigest(controls),
    governanceInvariant: 'PRESERVED' as const,
  };
}

export function controlsForDomain(domain: string) {
  return generateControls().filter((c) => c.domain === domain);
}
