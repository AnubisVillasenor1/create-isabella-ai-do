import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { waitForHealth } from "../../scripts/verify-production";

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  server = createServer((request, response) => {
    if ((request.url ?? "") === "/health") {
      response.statusCode = 200;
      response.end("{}");
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address !== "object") throw new Error("probe server failed to bind");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

describe("production verification", () => {
  it("detects a healthy production endpoint", async () => {
    expect(await waitForHealth(baseUrl, 5_000)).toBe(true);
  });

  it("returns false when the endpoint never becomes healthy", async () => {
    expect(await waitForHealth("http://127.0.0.1:9", 1_200)).toBe(false);
  });

  it("wires the production scripts and runbook", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["start:dist"]).toBe("node dist/server.js");
    expect(pkg.scripts["verify:production"]).toContain("verify-production");
    expect(pkg.scripts["smoke:production"]).toContain("production-smoke");
    const runbook = readFileSync(new URL("../../docs/runbooks/DEPLOY-TODAY.md", import.meta.url), "utf8");
    expect(runbook).toContain("docker compose up");
    expect(runbook).toContain("verify:production");
  });
});
