import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { SecretScanner } from "../../src/security/secret-scanner";

const fake = "AKIA" + "ABCDEFGHIJKLMNOP"; // synthetic, assembled at runtime so the repo scanner never flags this file

describe("SecretScanner.scanDirectory", () => {
  let dir = "";
  afterAll(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

  it("recurses into sub-directories (regression: `this` was undefined inside the nested function)", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "scan-"));
    await mkdir(path.join(dir, "a", "b"), { recursive: true });
    await writeFile(path.join(dir, "a", "b", "config.ts"), `export const k = "${fake}";\n`);
    await writeFile(path.join(dir, "clean.ts"), "export const x = 1;\n");
    const result = await new SecretScanner().scanDirectory(dir);
    expect(result.matches.some((m) => m.file?.includes("config.ts") || JSON.stringify(m).includes("config.ts"))).toBe(true);
    expect(result.summary.critical + result.summary.high + result.summary.medium + result.summary.low).toBe(result.matches.length);
  });

  it("does not leak per-instance exclude patterns into other instances", () => {
    const a = new SecretScanner();
    a.addExcludePattern(/only-in-a/);
    const b = new SecretScanner();
    expect(b["shouldExcludeFile"]("/x/only-in-a/file.ts")).toBe(false);
    expect(a["shouldExcludeFile"]("/x/only-in-a/file.ts")).toBe(true);
  });
});
