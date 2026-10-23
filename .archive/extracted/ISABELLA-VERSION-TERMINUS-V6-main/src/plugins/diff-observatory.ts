/**
 * Isabella Diff Observatory — plugin gobernado de solo lectura.
 *
 * Visualiza cambios no confirmados del workspace junto al transcript, con hunks
 * a nivel de archivo, señales de riesgo, refresco por eventos, `ask` contextual,
 * accesibilidad y render consciente de política.
 *
 * Política (manifest isabella.diff): workspace read, transcript read,
 * filesystem read-diff-only, network none, write none-by-default. Redacta patrones
 * con apariencia de secretos, omite binarios y registra en BookPI solo metadatos y
 * hashes (nunca contenido del diff).
 */
import { createHash } from "node:crypto";

export type DiffStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "ignored"
  | "binary";

export type DiffRiskLevel = "none" | "low" | "medium" | "high" | "critical";

export interface DiffLine {
  type: "context" | "addition" | "deletion" | "meta";
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  previousPath?: string;
  status: DiffStatus;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  isBinary: boolean;
  risk: DiffRiskLevel;
  riskReasons: string[];
  contentHash?: string;
  secretLikeMatches?: number;
}

export interface DiffSnapshot {
  id: string;
  workspace: string;
  branch?: string;
  base?: string;
  capturedAt: string;
  files: DiffFile[];
  totals: { files: number; additions: number; deletions: number };
  redacted: boolean;
}

export interface DiffAskContext {
  path: string;
  snapshotId: string;
  hunks: DiffHunk[];
  prompt: string;
}

export interface DiffPaneDefinition {
  id: string;
  title: string;
  open: () => void;
  close: () => void;
  refresh: () => Promise<void>;
  render: (snapshot: DiffSnapshot | null) => unknown;
}

export interface DiffBookPiSink {
  append: (event: { type: string; metadata: Record<string, unknown> }) => Promise<void>;
}

export interface DiffObservatoryContext {
  workspace: {
    root: string;
    readDiff: (options?: { redacted?: boolean }) => Promise<DiffSnapshot>;
    onChanged?: (listener: () => void) => () => void;
  };
  transcript: { appendUserContext?: (context: DiffAskContext) => void };
  ui: {
    registerCommand: (command: { name: string; description: string; run: (args?: string[]) => void }) => void;
    registerPane: (pane: DiffPaneDefinition) => void;
    isTerminalWideEnough?: (minimumColumns: number) => boolean;
    notify?: (message: string, level?: "info" | "success" | "warning" | "error") => void;
  };
  events?: { on: (event: string, listener: () => void) => () => void };
  bookpi?: DiffBookPiSink;
}

export const DIFF_PLUGIN_ID = "isabella.diff";
export const DIFF_MIN_TERMINAL_COLUMNS = 118;
const REFRESH_DEBOUNCE_MS = 180;

const SECRET_PATTERNS: readonly RegExp[] = [
  /(?:api[_-]?key|token|secret|password|passwd)\s*[:=]\s*["']?[^\s"']{12,}/gi,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9_]{20,}/g,
  /-----BEGIN (?:RSA|OPENSSH|EC|PRIVATE) KEY-----[\s\S]*?-----END [^-]+ KEY-----/g,
];

export function redactDiffText(text: string): string {
  return SECRET_PATTERNS.reduce((value, pattern) => value.replace(pattern, "[REDACTED_SECRET]"), text);
}

const SENSITIVE_PATH = /(auth|security|policy|rls|migration|payment|stripe|deploy|workflow)/;
const LOCKFILE = /package-lock|pnpm-lock|bun\.lock|poetry\.lock/;
const CREDENTIAL_PATH = /\.env|credentials|id_rsa|\.pem$/;

export function assessDiffRisk(file: DiffFile): { risk: DiffRiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  const path = file.path.toLowerCase();
  if ((file.secretLikeMatches ?? 0) > 0) reasons.push("possible-secret");
  if (SENSITIVE_PATH.test(path)) reasons.push("sensitive-path");
  if (file.deletions > 300 || file.additions > 500) reasons.push("large-change");
  if (LOCKFILE.test(path)) reasons.push("dependency-lock");
  if (CREDENTIAL_PATH.test(path)) reasons.push("credential-like-path");

  const risk: DiffRiskLevel = reasons.includes("possible-secret") || reasons.includes("credential-like-path")
    ? "critical"
    : reasons.includes("sensitive-path")
      ? "high"
      : reasons.includes("large-change") || reasons.includes("dependency-lock")
        ? "medium"
        : reasons.length
          ? "low"
          : "none";
  return { risk, reasons };
}

/** Redacta secretos, omite binarios y calcula señales de riesgo. Determinista. */
export function sanitizeDiffSnapshot(snapshot: DiffSnapshot): DiffSnapshot {
  const files = snapshot.files.map((file) => {
    if (file.isBinary) {
      const assessed = assessDiffRisk({ ...file, secretLikeMatches: 0 });
      return { ...file, hunks: [], risk: assessed.risk, riskReasons: [...assessed.reasons, "binary-omitted"] };
    }
    let secretLikeMatches = 0;
    const hunks = file.hunks.map((hunk) => ({
      ...hunk,
      lines: hunk.lines.map((line) => {
        const after = redactDiffText(line.text);
        if (after !== line.text) secretLikeMatches += 1;
        return { ...line, text: after };
      }),
    }));
    const next: DiffFile = { ...file, hunks, secretLikeMatches };
    const assessed = assessDiffRisk(next);
    return { ...next, risk: assessed.risk, riskReasons: assessed.reasons };
  });

  return {
    ...snapshot,
    files,
    redacted: true,
    totals: {
      files: files.length,
      additions: files.reduce((sum, file) => sum + file.additions, 0),
      deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    },
  };
}

/** Hash solo de metadatos: nunca del contenido del diff. */
export function snapshotMetadataHash(snapshot: DiffSnapshot): string {
  const metadata = snapshot.files.map((file) => ({
    path: file.path,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    risk: file.risk,
    contentHash: file.contentHash,
  }));
  return createHash("sha256").update(JSON.stringify(metadata), "utf8").digest("hex");
}

export interface DiffObservatory {
  pane: DiffPaneDefinition;
  snapshot: () => DiffSnapshot | null;
  refresh: () => Promise<void>;
  ask: (path: string, prompt: string) => void;
  dispose: () => void;
}

/** Crea el observatorio de diff (solo lectura). No escribe ni usa red. */
export function createDiffObservatory(context: DiffObservatoryContext): DiffObservatory {
  const state: { snapshot: DiffSnapshot | null; open: boolean } = { snapshot: null, open: false };
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let observedFirstEdit = false;
  const unsubscribers: Array<() => void> = [];

  const refresh = async (): Promise<void> => {
    if (refreshTimer) clearTimeout(refreshTimer);
    await new Promise<void>((resolve) => {
      refreshTimer = setTimeout(() => {
        void (async () => {
          try {
            state.snapshot = sanitizeDiffSnapshot(await context.workspace.readDiff({ redacted: true }));
            if (!observedFirstEdit && state.snapshot.files.length > 0) {
              observedFirstEdit = true;
              if (context.ui.isTerminalWideEnough?.(DIFF_MIN_TERMINAL_COLUMNS) ?? true) state.open = true;
            }
            await context.bookpi?.append({
              type: "diff.observation",
              metadata: {
                plugin: DIFF_PLUGIN_ID,
                snapshotId: state.snapshot.id,
                files: state.snapshot.totals.files,
                additions: state.snapshot.totals.additions,
                deletions: state.snapshot.totals.deletions,
                redacted: state.snapshot.redacted,
                metadataHash: snapshotMetadataHash(state.snapshot),
              },
            });
          } catch (error) {
            context.ui.notify?.(`No se pudo actualizar Diff Observatory: ${String(error)}`, "error");
          } finally {
            resolve();
          }
        })();
      }, REFRESH_DEBOUNCE_MS);
    });
  };

  const pane: DiffPaneDefinition = {
    id: DIFF_PLUGIN_ID,
    title: "Isabella · Diff Observatory",
    open: () => { state.open = true; },
    close: () => { state.open = false; },
    refresh,
    render: () => ({
      type: "diff-observatory",
      open: state.open,
      snapshot: state.snapshot,
      actions: { refresh: "refresh", askFile: "ask-file", openBookPI: "open-bookpi" },
    }),
  };

  context.ui.registerPane(pane);
  context.ui.registerCommand({
    name: "/diff",
    description: "Abrir o actualizar el observatorio de cambios de Isabella.",
    run: (args = []) => {
      const action = args[0] ?? "open";
      if (action === "close") state.open = false;
      else if (action === "refresh") void refresh();
      else { state.open = true; void refresh(); }
    },
  });

  for (const event of ["claude.edit", "shell.command", "turn.finished", "workspace.changed"]) {
    const unsubscribe = context.events?.on(event, () => void refresh());
    if (unsubscribe) unsubscribers.push(unsubscribe);
  }
  const workspaceUnsubscribe = context.workspace.onChanged?.(() => void refresh());
  if (workspaceUnsubscribe) unsubscribers.push(workspaceUnsubscribe);

  void refresh();

  return {
    pane,
    snapshot: () => state.snapshot,
    refresh,
    ask: (path, prompt) => {
      const file = state.snapshot?.files.find((f) => f.path === path);
      if (!file || !state.snapshot) return;
      context.transcript.appendUserContext?.({ path, snapshotId: state.snapshot.id, hunks: file.hunks, prompt });
    },
    dispose: () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    },
  };
}
