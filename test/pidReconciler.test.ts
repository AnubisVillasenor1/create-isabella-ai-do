import { describe, expect, it } from "vitest";
import { reconcilePids } from "../src/pidReconciler.js";

describe("PID reconciliation", () => {
  it("accepts valid ORCID and DOI identifiers", async () => {
    const report = await reconcilePids({
      strict: true,
      identifiers: {
        orcid: "0000-0002-1825-0097",
        zenodoDoi: "10.5281/zenodo.20606361",
      },
      expected: {},
    });
    expect(report.passed).toBe(true);
    expect(report.recordCount).toBe(2);
  });

  it("normalizes DOI and detects invalid ORCID", async () => {
    const report = await reconcilePids({
      strict: true,
      identifiers: {
        orcid: "0000-0002-1825-0098",
        zenodoDoi: "https://doi.org/10.5281/zenodo.20606361",
      },
      expected: {},
    });
    expect(report.passed).toBe(false);
    expect(report.records[1]?.canonical).toBe("10.5281/zenodo.20606361");
  });

  it("fails closed when strict mode has no PIDs", async () => {
    const report = await reconcilePids({
      strict: true,
      identifiers: {},
      expected: {},
    });
    expect(report.passed).toBe(false);
  });
});
