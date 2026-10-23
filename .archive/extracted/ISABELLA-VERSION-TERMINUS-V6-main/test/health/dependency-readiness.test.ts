import { describe, expect, it } from "vitest";
import {
  collectDependencyReadiness,
  probeBookPiLedger,
  type FilesystemProbe,
} from "../../src/health/dependency-readiness";

const writableFilesystem: FilesystemProbe = { isWritableDirectory: () => true };

const fullyConfigured = {
  BOOKPI_LEDGER_PATH: "C:/data/bookpi/ledger.jsonl",
  OPENROUTER_API_KEY: "configured",
  POSTGRES_URL: "postgres://user:pass@host:5432/db",
  HYPERCORE_SIGNING_KEY: "secret",
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318",
} as const;

describe("deep dependency readiness", () => {
  it("is never ready without configuration (fail-closed)", () => {
    const report = collectDependencyReadiness({}, writableFilesystem);
    expect(report.readiness.ready).toBe(false);
    expect(report.readiness.status).not.toBe("healthy");
    expect(report.readiness.blockers).toContain("bookpi-ledger:degraded");
    expect(report.evidence).toHaveLength(5);
  });

  it("reports ready only when every dependency probe is healthy", () => {
    const report = collectDependencyReadiness(fullyConfigured, writableFilesystem);
    expect(report.readiness.ready).toBe(true);
    expect(report.readiness.blockers).toEqual([]);
    expect(report.dependencies.every((dependency) => dependency.status === "healthy")).toBe(true);
  });

  it("fails closed when the configured ledger path is not writable", () => {
    const report = collectDependencyReadiness(fullyConfigured, {
      isWritableDirectory: () => false,
    } satisfies FilesystemProbe);
    expect(report.readiness.ready).toBe(false);
    expect(report.readiness.blockers).toContain("bookpi-ledger:unavailable");
  });

  it("distinguishes a durable configured ledger from the in-memory chain", () => {
    const configured = collectDependencyReadiness(fullyConfigured, writableFilesystem).evidence.find(
      (entry) => entry.dependency === "bookpi-ledger",
    );
    const volatile = collectDependencyReadiness({}, writableFilesystem).evidence.find(
      (entry) => entry.dependency === "bookpi-ledger",
    );
    expect(configured?.status).toBe("healthy");
    expect(volatile?.status).toBe("degraded");
    expect(volatile?.required).toBe(true);
  });

  it("treats a missing ledger path as degraded in-memory evidence without touching the filesystem", () => {
    const evidence = probeBookPiLedger({}, {
      isWritableDirectory: () => {
        throw new Error("filesystem must not be probed when the ledger path is absent");
      },
    });
    expect(evidence.status).toBe("degraded");
    expect(evidence.required).toBe(true);
  });

  it("recognizes an Ollama Cloud credential as a configured inference provider", () => {
    const report = collectDependencyReadiness({ OLLAMA_API_KEY: "configured" }, writableFilesystem);
    const inference = report.evidence.find((entry) => entry.dependency === "inference-provider");
    expect(inference?.status).toBe("healthy");
  });
});
