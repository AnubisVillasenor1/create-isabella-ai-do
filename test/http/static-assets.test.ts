import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildAsset, etagMatches, negotiateEncoding, serveAsset, type MinimalRes } from "../../src/http/static-assets";

function fakeRes() {
  const headers: Record<string, string | number> = {};
  const out: { status: number; body?: Buffer } = { status: 0 };
  const res: MinimalRes = {
    setHeader(n, v) { headers[n.toLowerCase()] = v; },
    status(c) { out.status = c; return res; },
    end(b) { out.body = b; },
  };
  return { res, headers, out };
}

const css = "body{margin:0}".repeat(500);

describe("static assets", () => {
  const asset = buildAsset(css, "text/css; charset=utf-8");

  it("negotiates brotli > gzip > identity and honours q=0", () => {
    expect(negotiateEncoding("gzip, deflate, br")).toBe("br");
    expect(negotiateEncoding("gzip")).toBe("gzip");
    expect(negotiateEncoding("br;q=0, gzip")).toBe("gzip");
    expect(negotiateEncoding("identity")).toBe("identity");
    expect(negotiateEncoding(undefined)).toBe("identity");
  });

  it("serves compressed bodies that round-trip", () => {
    const b = fakeRes();
    serveAsset({ headers: { "accept-encoding": "br" } }, b.res, asset, "public, max-age=1");
    expect(b.out.status).toBe(200);
    expect(b.headers["content-encoding"]).toBe("br");
    expect(brotliDecompressSync(b.out.body as Buffer).toString()).toBe(css);
    expect((b.out.body as Buffer).length).toBeLessThan(css.length / 10);
    const g = fakeRes();
    serveAsset({ headers: { "accept-encoding": "gzip" } }, g.res, asset, "public, max-age=1");
    expect(gunzipSync(g.out.body as Buffer).toString()).toBe(css);
    const i = fakeRes();
    serveAsset({ headers: {} }, i.res, asset, "public, max-age=1");
    expect(i.headers["content-encoding"]).toBeUndefined();
    expect(i.out.body?.toString()).toBe(css);
    expect(i.headers["vary"]).toBe("Accept-Encoding");
  });

  it("answers 304 on matching ETag and omits the body", () => {
    const r = fakeRes();
    serveAsset({ headers: { "if-none-match": asset.etag } }, r.res, asset, "public, max-age=1");
    expect(r.out.status).toBe(304);
    expect(r.out.body).toBeUndefined();
    expect(etagMatches(`W/${asset.etag}`, asset.etag)).toBe(true);
    expect(etagMatches('"other"', asset.etag)).toBe(false);
    expect(etagMatches("*", asset.etag)).toBe(true);
  });

  it("ETag changes with content", () => {
    expect(buildAsset("a", "text/plain").etag).not.toBe(buildAsset("b", "text/plain").etag);
  });

  it("HEAD sends headers without a body", () => {
    const r = fakeRes();
    serveAsset({ headers: {}, method: "HEAD" }, r.res, asset, "no-cache");
    expect(r.out.status).toBe(200);
    expect(r.out.body).toBeUndefined();
  });
});
