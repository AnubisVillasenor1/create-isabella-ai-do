import { config } from "../config.js";
import { reconcilePids, type ReconciliationReport } from "../pidReconciler.js";

const EXIT = Object.freeze({
  SUCCESS: 0,
  VALIDATION_FAILED: 1,
  RUNTIME_ERROR: 2,
  TIMEOUT: 3,
  RETRY_EXHAUSTED: 4,
} as const);

const RECONCILIATION_TIMEOUT_MS = Number(process.env.RECONCILIATION_TIMEOUT_MS ?? 30_000);
const MAX_ATTEMPTS = Math.max(1, Number(process.env.RECONCILIATION_MAX_ATTEMPTS ?? 3));
const RETRY_BASE_DELAY_MS = Math.max(100, Number(process.env.RECONCILIATION_RETRY_BASE_MS ?? 1_000));
const RETRY_MAX_DELAY_MS = Math.max(RETRY_BASE_DELAY_MS, Number(process.env.RECONCILIATION_RETRY_MAX_MS ?? 10_000));

type ExitCode = (typeof EXIT)[keyof typeof EXIT];
type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  payload?: unknown;
}

function emit(level: LogLevel, message: string, payload?: unknown): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(payload !== undefined ? { payload } : {}),
  };
  const output = JSON.stringify(entry);
  if (level === "error") console.error(output);
  else console.log(output);
}

function normalizeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) return { name: error.name || "Error", message: error.message || "Unknown error", stack: error.stack };
  return { name: "UnknownError", message: String(error) };
}

function setExitCode(code: ExitCode): void {
  process.exitCode = code;
}

function delayFor(attempt: number): number {
  const exponential = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1));
  return Math.round(exponential * (0.8 + Math.random() * 0.4));
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`PID_RECONCILIATION_TIMEOUT:${timeoutMs}`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runReconciliation(): Promise<ReconciliationReport> {
  emit("info", "PID reconciliation started", { maxAttempts: MAX_ATTEMPTS, timeoutMs: RECONCILIATION_TIMEOUT_MS });
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const report = await withTimeout(reconcilePids(config), RECONCILIATION_TIMEOUT_MS);
      emit(report.passed ? "info" : "warn", "PID reconciliation completed", { attempt, report });
      setExitCode(report.passed ? EXIT.SUCCESS : EXIT.VALIDATION_FAILED);
      return report;
    } catch (error) {
      lastError = error;
      const normalized = normalizeError(error);
      emit("error", "PID reconciliation attempt failed", { attempt, maxAttempts: MAX_ATTEMPTS, error: normalized });
      if (normalized.message.startsWith("PID_RECONCILIATION_TIMEOUT:")) {
        setExitCode(EXIT.TIMEOUT);
        throw error;
      }
      if (attempt < MAX_ATTEMPTS) {
        const delayMs = delayFor(attempt);
        emit("warn", "PID reconciliation retry scheduled", { attempt, delayMs });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  setExitCode(EXIT.RETRY_EXHAUSTED);
  throw lastError ?? new Error("PID_RECONCILIATION_RETRY_EXHAUSTED");
}

async function main(): Promise<void> {
  try {
    await runReconciliation();
  } catch (error) {
    emit("error", "PID reconciliation job failed", normalizeError(error));
    if (process.exitCode === undefined) setExitCode(EXIT.RUNTIME_ERROR);
  }
}

void main();
