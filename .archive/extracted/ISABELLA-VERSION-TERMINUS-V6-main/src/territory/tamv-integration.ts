/**
 * TAMV_INTEGRATION — mapa de integración conceptual para TAMV MD-X5 y las
 * bibliotecas de Isabella.
 *
 * Regla de honestidad: separar capacidad implementada, probada, verificada,
 * experimental, simulada y planificada. Los documentos fuente permanecen históricos
 * hasta que claims, dependencias y evidencia sean migrados.
 */

export const CAPABILITY_MATURITY = [
  "planned",
  "experimental",
  "simulated",
  "implemented",
  "tested",
  "verified",
] as const;

export type CapabilityMaturity = (typeof CAPABILITY_MATURITY)[number];

export const TAMV_MODULES = [
  "MSR",
  "MDD",
  "DreamSpaces",
  "Blindajes",
  "TerritorialArchitecture",
] as const;

export type TamvModule = (typeof TAMV_MODULES)[number];

export interface TamvModuleDescriptor {
  module: TamvModule;
  role: string;
  maturity: CapabilityMaturity;
  /** advertencia de honestidad aplicable al módulo. */
  disclaimer: string;
}

export const TAMV_INTEGRATION_MAP: Readonly<Record<TamvModule, TamvModuleDescriptor>> = Object.freeze({
  MSR: {
    module: "MSR",
    role: "registro y provenance",
    maturity: "implemented",
    disclaimer: "Provenance no implica veracidad de la afirmación registrada.",
  },
  MDD: {
    module: "MDD",
    role: "modelo económico",
    maturity: "planned",
    disclaimer: "Sujeto a requisitos legales y operativos; no es una base financiera o bancaria.",
  },
  DreamSpaces: {
    module: "DreamSpaces",
    role: "experiencia web/XR por fases",
    maturity: "experimental",
    disclaimer: "Separación entre concepto e implementación; por fases.",
  },
  Blindajes: {
    module: "Blindajes",
    role: "controles de seguridad",
    maturity: "implemented",
    disclaimer: "Controles de seguridad, no garantía de invulnerabilidad.",
  },
  TerritorialArchitecture: {
    module: "TerritorialArchitecture",
    role: "contexto e identidad territorial",
    maturity: "implemented",
    disclaimer: "Contexto e identidad, no restricción técnica.",
  },
});

export interface IntegrationHonestyReport {
  module: TamvModule;
  maturity: CapabilityMaturity;
  /** la documentación pública no debe elevar la madurez declarada. */
  claimedAsProduction: boolean;
  disclaimer: string;
}

/**
 * Verifica la regla de honestidad: un módulo solo puede declararse como producción
 * cuando su madurez es `verified`. Cualquier reclamo superior a la madurez real se
 * marca como sobreclamación.
 */
export function assessIntegrationHonesty(
  module: TamvModule,
  claimedMaturity: CapabilityMaturity,
): IntegrationHonestyReport {
  const descriptor = TAMV_INTEGRATION_MAP[module];
  const rank = (m: CapabilityMaturity) => CAPABILITY_MATURITY.indexOf(m);
  const claimedAsProduction = rank(claimedMaturity) > rank(descriptor.maturity);
  return {
    module,
    maturity: descriptor.maturity,
    claimedAsProduction,
    disclaimer: descriptor.disclaimer,
  };
}
