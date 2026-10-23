import { createServer, type RequestListener, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyDeployment } from "../../src/deployment/production-smoke";

// Prevent the application from opening a production listener while this smoke imports it.
process.env.VERCEL = "1";

let server: Server | undefined;
let baseUrl = "";

beforeAll(async () => {
  const { default: app } = await import("../../src/server");
  const created = createServer(app as unknown as RequestListener);
  await new Promise<void>((resolve, reject) => {
    created.once("error", reject);
    created.listen(0, "127.0.0.1", resolve);
  });
  const address = created.address();
  if (!address || typeof address !== "object") throw new Error("smoke server failed to bind an ephemeral port");
  server = created;
  baseUrl = `http://127.0.0.1:${address.port}`;
}, 60_000);

afterAll(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server?.close((error) => (error ? reject(error) : resolve())));
}, 30_000);

describe("post-deployment smoke", () => {
  it(
    "verifies the runtime deployment surface end-to-end",
    async () => {
      const result = await verifyDeployment(baseUrl);
      const names = result.checks.map((check) => check.name);
      expect(names).toEqual(["liveness", "security-headers", "public-health", "deep-readiness"]);
      expect(result.ok).toBe(true);
      expect(result.baseUrl).toBe(baseUrl);
    },
    30_000,
  );

  it(
    "reports unreachable deployments as failed checks instead of throwing",
    async () => {
      const result = await verifyDeployment("http://127.0.0.1:9");
      expect(result.ok).toBe(false);
      expect(result.checks.every((check) => check.ok === false)).toBe(true);
    },
    30_000,
  );
});
