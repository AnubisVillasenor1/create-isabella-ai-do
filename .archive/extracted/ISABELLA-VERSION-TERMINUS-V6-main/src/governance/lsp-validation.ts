/**
 * LSP_VALIDATION — validación técnica de código/documentos mediante clientes LSP asíncronos.
 *
 * Contrato: open_file, save_file, wait_for_diagnostics, diagnostics_for.
 * Frescura: didOpen → version 0; didChange → version + 1; fresh(result, v) iff result.version >= v.
 *
 * Resultados: FRESH_NO_DIAGNOSTICS, FRESH_WITH_DIAGNOSTICS, NO_FRESH_DATA.
 * `NO_FRESH_DATA` NO significa archivo limpio. Solo `FRESH_NO_DIAGNOSTICS` puede ser
 * TECHNICALLY_CLEAN. LSP aporta evidencia técnica acotada; no valida afirmaciones
 * científicas ni sustituye provenance, corroboración o revisión humana.
 */

export type LspDiagnosticSeverity = "error" | "warning" | "information" | "hint";

export interface LspDiagnostic {
  file: string;
  line: number;
  character: number;
  severity: LspDiagnosticSeverity;
  message: string;
  source?: string;
}

export type LspFreshness = "FRESH_NO_DIAGNOSTICS" | "FRESH_WITH_DIAGNOSTICS" | "NO_FRESH_DATA";

export type LspTechnicalVerdict = "TECHNICALLY_CLEAN" | "TECHNICALLY_ISSUES" | "INCONCLUSIVE";

export interface LspDiagnosticsResult {
  file: string;
  version: number;
  freshness: LspFreshness;
  verdict: LspTechnicalVerdict;
  diagnostics: readonly LspDiagnostic[];
}

interface DocumentState {
  version: number;
  content: string;
  diagnostics: readonly LspDiagnostic[];
  diagnosticsReceived: boolean;
}

/**
 * Adaptador LSP en memoria. Un cliente LSP real (o un `DiagnosticsProvider`)
 * alimenta `pushDiagnostics`; este adaptador mantiene versiones frescas por archivo.
 */
export class LspValidationAdapter {
  private readonly documents = new Map<string, DocumentState>();

  /** didOpen → version 0. */
  openFile(file: string, content = ""): number {
    if (!file.trim()) throw new Error("LSP: file required");
    this.documents.set(file, { version: 0, content, diagnostics: [], diagnosticsReceived: false });
    return 0;
  }

  /** didChange → version + 1. */
  saveFile(file: string, content: string): number {
    const current = this.documents.get(file);
    if (!current) throw new Error(`LSP: file not open: ${file}`);
    const version = current.version + 1;
    this.documents.set(file, { version, content, diagnostics: [], diagnosticsReceived: false });
    return version;
  }

  /** El cliente LSP entrega diagnósticos para la versión indicada. */
  pushDiagnostics(file: string, version: number, diagnostics: readonly LspDiagnostic[]): void {
    const current = this.documents.get(file);
    if (!current) throw new Error(`LSP: file not open: ${file}`);
    if (!Number.isInteger(version) || version < 0 || !Array.isArray(diagnostics)) throw new Error("LSP: invalid diagnostics payload");
    if (version < current.version) return; // resultado obsoleto, se descarta
    if (version > current.version) throw new Error("LSP_DIAGNOSTICS_VERSION_AHEAD_OF_DOCUMENT");
    this.documents.set(file, { ...current, diagnostics: Object.freeze([...diagnostics]), diagnosticsReceived: true });
  }

  /** Espera diagnósticos frescos hasta el timeout. Un timeout NO implica archivo limpio. */
  async waitForDiagnostics(file: string, minVersion: number, timeoutMs = 5000): Promise<LspDiagnosticsResult> {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    while (Date.now() <= deadline) {
      const result = this.diagnosticsFor(file, minVersion);
      if (result.freshness !== "NO_FRESH_DATA") return result;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    return this.diagnosticsFor(file, minVersion);
  }

  /** Resultado de diagnósticos con evaluación de frescura respecto a `minVersion`. */
  diagnosticsFor(file: string, minVersion = 0): LspDiagnosticsResult {
    const current = this.documents.get(file);
    if (!current || current.version < minVersion || !current.diagnosticsReceived) {
      return { file, version: current?.version ?? -1, freshness: "NO_FRESH_DATA", verdict: "INCONCLUSIVE", diagnostics: Object.freeze([]) };
    }
    const diagnostics = Object.freeze([...current.diagnostics]);
    const freshness: LspFreshness = diagnostics.length === 0 ? "FRESH_NO_DIAGNOSTICS" : "FRESH_WITH_DIAGNOSTICS";
    const verdict: LspTechnicalVerdict = freshness === "FRESH_NO_DIAGNOSTICS" ? "TECHNICALLY_CLEAN" : "TECHNICALLY_ISSUES";
    return { file, version: current.version, freshness, verdict, diagnostics };
  }
}

/** Regla de frescura explícita: fresh(result, v) iff result.version >= v. */
export function isFresh(result: { version: number }, requiredVersion: number): boolean {
  return result.version >= requiredVersion;
}

/**
 * Solo FRESH_NO_DIAGNOSTICS puede elevarse a TECHNICALLY_CLEAN.
 * NO_FRESH_DATA nunca es "limpio".
 */
export function canBeTechnicallyClean(freshness: LspFreshness): boolean {
  return freshness === "FRESH_NO_DIAGNOSTICS";
}
