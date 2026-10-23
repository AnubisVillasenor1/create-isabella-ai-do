import { describe, expect, it } from "vitest";
import { PROTOCOL_CATALOG, ProtocolRegistry } from "../../src/protocols";

function run(id: string, input: unknown): Promise<unknown> {
  const registry = new ProtocolRegistry();
  for (const protocol of PROTOCOL_CATALOG) registry.register(protocol);
  return registry.execute(id, input);
}

describe("protocols/catalog", () => {
  it("expone contratos con ID único y versión semántica", () => {
    const ids = PROTOCOL_CATALOG.map((protocol) => protocol.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const protocol of PROTOCOL_CATALOG) {
      expect(typeof protocol.execute).toBe("function");
      expect(protocol.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("bookpi.register calcula la raíz de Merkle y el compromiso ZK", async () => {
    const result = (await run("isabella.bookpi.register", { content: "hola mundo", authorId: "a1" })) as {
      merkleRoot: string;
      totalChunks: number;
      zkCommitment: string;
    };
    expect(result.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
    expect(result.totalChunks).toBe(1);
    expect(result.zkCommitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it("bookpi.verify valida la inclusión del chunk", async () => {
    const result = (await run("isabella.bookpi.verify", { content: "contenido de prueba", index: 0 })) as {
      valid: boolean;
    };
    expect(result.valid).toBe(true);
  });

  it("security.sign_event/verify_event hacen round-trip y detectan manipulación", async () => {
    const signed = (await run("isabella.security.sign_event", { payload: { a: 1 }, actorId: "actor" })) as {
      signature: string;
    };
    const ok = (await run("isabella.security.verify_event", {
      payload: { a: 1 },
      actorId: "actor",
      signature: signed.signature,
    })) as { valid: boolean };
    const bad = (await run("isabella.security.verify_event", {
      payload: { a: 2 },
      actorId: "actor",
      signature: signed.signature,
    })) as { valid: boolean };
    expect(ok.valid).toBe(true);
    expect(bad.valid).toBe(false);
  });

  it("bookpi.royalty.settle rechaza repartos que no suman 10000 puntos base", async () => {
    await expect(
      run("isabella.bookpi.royalty.settle", {
        totalRevenueWei: "1000",
        shares: [{ federationId: 1, basisPoints: 5000, walletAddress: "w" }],
      }),
    ).rejects.toThrow(/basis points/);
  });

  it("bookpi.royalty.settle reparte de forma exacta cuando cuadra", async () => {
    const result = (await run("isabella.bookpi.royalty.settle", {
      totalRevenueWei: "10000",
      shares: [
        { federationId: 1, basisPoints: 4000, walletAddress: "a" },
        { federationId: 2, basisPoints: 6000, walletAddress: "b" },
      ],
    })) as { distributedWei: string; remainderWei: string };
    expect(result.distributedWei).toBe("10000");
    expect(result.remainderWei).toBe("0");
  });

  it("atlas.events.build rechaza tipos de evento desconocidos", async () => {
    await expect(run("isabella.atlas.events.build", { eventType: "NO_EXISTE" })).rejects.toThrow(
      /unknown event type/,
    );
  });

  it("atlas.documents.state exige record y newState", async () => {
    await expect(run("isabella.atlas.documents.state", {})).rejects.toThrow(/required/);
  });
});
