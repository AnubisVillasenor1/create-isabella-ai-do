/**
 * Beta Subsystem: Classification Engine
 *
 * Clasifica datos según sensibilidad y políticas de gobernanza.
 */

import type { DataClassification } from "../contracts";

export interface ClassificationResult {
  classification: DataClassification;
  confidence: number;
  reasons: string[];
}

export class ClassificationEngine {
  classify(intent: string, options?: { intentCategory?: string }): ClassificationResult {
    const text = intent.toLowerCase();
    let classification: DataClassification = "internal";

    if (
      options?.intentCategory === "monetization" ||
      /payout|tarjeta|pago|stripe|secret|token/i.test(text)
    ) {
      classification = "critical";
    } else if (/privad|confidencial|identidad|personal/i.test(text)) {
      classification = "restricted";
    } else if (options?.intentCategory === "chat" || options?.intentCategory === "general") {
      classification = "public";
    }

    return {
      classification,
      confidence: 0.95,
      reasons: [`Clasificado como ${classification} según heurística de seguridad`],
    };
  }
}

export const classificationEngine = new ClassificationEngine();
