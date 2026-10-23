import { describe, expect, it } from "vitest";
import { CognitiveCapitalMarket } from "../../src/economy/cognitive-capital-market";

describe("Cognitive Capital Market", () => {
  it("lists and searches assets", () => {
    const m = new CognitiveCapitalMarket();
    m.listAsset({ id: "a1", type: "knowledge", owner: "alice", title: "Graph", valuation: 100 });
    m.listAsset({ id: "a2", type: "model", owner: "bob", title: "Model", valuation: 200 });
    expect(m.stats().assets).toBe(2);
    expect(m.search({ type: "knowledge" })).toHaveLength(1);
    expect(m.search({ minValuation: 150 })).toHaveLength(1);
  });
  it("trades assets and records history", () => {
    const m = new CognitiveCapitalMarket();
    m.listAsset({ id: "a1", type: "knowledge", owner: "alice", title: "Graph", valuation: 100 });
    const trade = m.trade("a1", "bob", 120, 500);
    expect(trade.buyer).toBe("bob");
    expect(trade.seller).toBe("alice");
    expect(m.get("a1")?.status).toBe("sold");
    expect(m.tradesFor("a1")).toHaveLength(1);
    expect(m.stats().volume).toBe(120);
  });
  it("retires assets", () => {
    const m = new CognitiveCapitalMarket();
    m.listAsset({ id: "a1", type: "ontology", owner: "alice", title: "Onto", valuation: 50 });
    const r = m.retire("a1");
    expect(r.status).toBe("retired");
    expect(m.search({})).toHaveLength(0);
  });
  it("portfolio and validation", () => {
    const m = new CognitiveCapitalMarket();
    m.listAsset({ id: "a1", type: "knowledge", owner: "alice", title: "G", valuation: 10 });
    expect(m.portfolio("alice")).toHaveLength(1);
    expect(() => m.listAsset({ id: "a1", type: "knowledge", owner: "alice", title: "G", valuation: 10 })).toThrow();
    expect(() => m.listAsset({ id: "a2", type: "knowledge", owner: "", title: "G", valuation: 10 })).toThrow();
    expect(() => m.trade("nope", "bob", 10)).toThrow();
    expect(() => m.trade("a1", "bob", -1)).toThrow();
  });
});
