import { describe, expect, it } from "vitest";
import {
  normalizeIngress,
  sanitizeHeaders,
  sanitizeText,
  validateIngressShape,
} from "../../src/ingress/request";

describe("ingress/request", () => {
  const base = {
    method: "POST",
    path: "/api/v1/evolution",
    headers: {},
    query: {},
    protocol: "https",
    body: { q: "hola" },
  };

  it("normaliza una solicitud generando requestId/traceId", () => {
    const req = normalizeIngress(base, { methodId: "A.TWINS.E18_PLANNING.decompose_task.synthesize.v1.0.0.MEDIUM.INSTITUTIONAL" });
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.traceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.rawMethod).toBe("POST");
  });

  it("sanea textos: corta bytes de control y delimita longitud", () => {
    const dirty = "  a\u0000b\u0007c  ";
    expect(sanitizeText(dirty)).toBe("abc");
    expect(sanitizeText("x".repeat(5000), 10)).toHaveLength(10);
  });

  it("sanea cabeceras", () => {
    const headers = sanitizeHeaders({ "x-test": "  v\u0000l  ", "x-empty": "" });
    expect(headers["x-test"]).toBe("vl");
  });

  it("valida la forma de la solicitud y rechaza cabeceras excesivas", () => {
    expect(() => validateIngressShape({ ...base, body: null })).not.toThrow();
    const manyHeaders: Record<string, string> = {};
    for (let i = 0; i < 40; i += 1) {
      manyHeaders[`h${i}`] = "x";
    }
    expect(() => validateIngressShape({ ...base, headers: manyHeaders })).toThrow(/cabeceras/);
  });

  it("exige método y path", () => {
    expect(() => normalizeIngress({ ...base, method: "" } as never, { methodId: "m" })).toThrow(/método/);
    expect(() => normalizeIngress({ ...base, path: "" } as never, { methodId: "m" })).toThrow(/path/);
  });
});