import { describe, expect, it } from "vitest";
import { LspValidationAdapter, isFresh, canBeTechnicallyClean } from "../../src/governance";

describe("LSP validation", () => {
  it("only FRESH_NO_DIAGNOSTICS is technically clean", () => {
    const lsp = new LspValidationAdapter();
    expect(lsp.openFile("a.ts", "const x = 1;")).toBe(0);
    const unopened = lsp.diagnosticsFor("a.ts", 0);
    expect(unopened.freshness).toBe("NO_FRESH_DATA");
    expect(unopened.verdict).toBe("INCONCLUSIVE");
    expect(() => lsp.pushDiagnostics("a.ts", 99, [])).toThrow(/VERSION_AHEAD_OF_DOCUMENT/);
    expect(lsp.diagnosticsFor("a.ts", 0).freshness).toBe("NO_FRESH_DATA");

    lsp.pushDiagnostics("a.ts", 0, []);
    const clean = lsp.diagnosticsFor("a.ts", 0);
    expect(clean.freshness).toBe("FRESH_NO_DIAGNOSTICS");
    expect(clean.verdict).toBe("TECHNICALLY_CLEAN");

    const v = lsp.saveFile("a.ts", "const x: number = 'bad';");
    expect(lsp.diagnosticsFor("a.ts", v).verdict).toBe("INCONCLUSIVE");
    expect(v).toBe(1);
    lsp.pushDiagnostics("a.ts", v, [{ file: "a.ts", line: 1, character: 1, severity: "error", message: "type" }]);
    const dirty = lsp.diagnosticsFor("a.ts", v);
    expect(dirty.freshness).toBe("FRESH_WITH_DIAGNOSTICS");
    expect(dirty.verdict).toBe("TECHNICALLY_ISSUES");
  });

  it("NO_FRESH_DATA is never clean; timeout does not imply clean", async () => {
    const lsp = new LspValidationAdapter();
    const stale = lsp.diagnosticsFor("missing.ts", 0);
    expect(stale.freshness).toBe("NO_FRESH_DATA");
    expect(stale.verdict).toBe("INCONCLUSIVE");
    expect(canBeTechnicallyClean("NO_FRESH_DATA")).toBe(false);

    lsp.openFile("b.ts", "");
    const timedOut = await lsp.waitForDiagnostics("b.ts", 5, 10);
    expect(timedOut.freshness).toBe("NO_FRESH_DATA");
  });

  it("freshness rule: result.version >= requiredVersion", () => {
    expect(isFresh({ version: 3 }, 3)).toBe(true);
    expect(isFresh({ version: 2 }, 3)).toBe(false);
  });
});
