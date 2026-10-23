import { describe, expect, it, vi } from "vitest";
import {
  sanitizeDiffSnapshot,
  assessDiffRisk,
  redactDiffText,
  snapshotMetadataHash,
  createDiffObservatory,
  type DiffSnapshot,
} from "../../src/plugins";

function snapshot(): DiffSnapshot {
  return {
    id: "snap-1",
    workspace: "isabella",
    capturedAt: "2026-02-01T00:00:00Z",
    redacted: false,
    totals: { files: 0, additions: 0, deletions: 0 },
    files: [
      {
        path: "src/config.ts",
        status: "modified",
        additions: 2,
        deletions: 1,
        isBinary: false,
        risk: "none",
        riskReasons: [],
        hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, header: "@@", lines: [{ type: "addition", text: "api_key: 'supersecretvalue12345'" }] }],
      },
      { path: "logo.png", status: "added", additions: 0, deletions: 0, isBinary: true, risk: "none", riskReasons: [], hunks: [] },
    ],
  };
}

describe("diff observatory", () => {
  it("redacts secrets and never keeps raw secret text", () => {
    expect(redactDiffText("token: 'abcdefghijklmnop'")).toContain("[REDACTED_SECRET]");
    const result = sanitizeDiffSnapshot(snapshot());
    expect(result.redacted).toBe(true);
    expect(result.files[0]?.secretLikeMatches).toBeGreaterThan(0);
    expect(result.files[0]?.hunks[0]?.lines[0]?.text).toContain("[REDACTED_SECRET]");
    expect(result.files[0]?.risk).toBe("critical");
  });

  it("omits binary content and flags it", () => {
    const result = sanitizeDiffSnapshot(snapshot());
    expect(result.files[1]?.hunks).toEqual([]);
    expect(result.files[1]?.riskReasons).toContain("binary-omitted");
  });

  it("marks sensitive paths as high risk", () => {
    const assessed = assessDiffRisk({ path: "infra/deploy/prod.yml", status: "modified", additions: 1, deletions: 1, hunks: [], isBinary: false, risk: "none", riskReasons: [] });
    expect(assessed.risk).toBe("high");
  });

  it("metadata hash excludes diff content", () => {
    const a = sanitizeDiffSnapshot(snapshot());
    const b = sanitizeDiffSnapshot({ ...snapshot(), files: snapshot().files.map((f) => ({ ...f })) });
    expect(snapshotMetadataHash(a)).toBe(snapshotMetadataHash(b));
  });

  it("registers a command and records only metadata in BookPI", async () => {
    const commands: string[] = [];
    const appended: Array<{ type: string; metadata: Record<string, unknown> }> = [];
    const observatory = createDiffObservatory({
      workspace: { root: "isabella", readDiff: async () => sanitizeDiffSnapshot(snapshot()) },
      transcript: { appendUserContext: vi.fn() },
      ui: { registerCommand: (c) => commands.push(c.name), registerPane: () => {} },
      bookpi: { append: async (e) => { appended.push(e); } },
    });
    await observatory.refresh();
    expect(commands).toContain("/diff");
    const event = appended.at(-1);
    expect(event?.type).toBe("diff.observation");
    expect(event?.metadata).toHaveProperty("metadataHash");
    expect(JSON.stringify(event?.metadata)).not.toContain("supersecretvalue");
    observatory.dispose();
  });
});
