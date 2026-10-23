import { afterEach, describe, expect, it, vi } from "vitest";
import { AtlasStore } from "../src/atlas";

const config = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "test-service-role-key",
  requestTimeoutMs: 1000,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AtlasStore persistence port", () => {
  it("rejects incomplete configuration", () => {
    expect(() => new AtlasStore({ supabaseUrl: "", supabaseServiceRoleKey: "" })).toThrow();
  });

  it("creates a user through the Supabase Data API and maps it to the Atlas domain", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([{
          id: "user-1",
          handle: "atlas",
          display_name: "Atlas User",
          created_at: "2026-10-08T00:00:00.000Z",
        }]),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );

    const store = new AtlasStore(config);
    const user = await store.createUser({ handle: "atlas", displayName: "Atlas User" });

    expect(user.id).toBe("user-1");
    expect(user.displayName).toBe("Atlas User");
    expect(user.he_hep_context).toEqual({ hexagon: "HE-Identity", domain: "HEP-1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.supabase.co/rest/v1/atlas_users");
  });

  it("publishes XR events to persistence and isolates listener failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([{ id: "xr-1", event_type: "scene.update", payload: { node: 7 } }]),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );

    const store = new AtlasStore(config);
    const received: string[] = [];
    store.onXrEvent(() => { throw new Error("listener failure"); });
    store.onXrEvent((event) => received.push(event.id));

    const event = await store.publishXrEvent("scene.update", { node: 7 });

    expect(event.id).toBe("xr-1");
    expect(received).toEqual(["xr-1"]);
  });

  it("rejects invalid economy amounts before touching Supabase", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const store = new AtlasStore(config);

    await expect(store.recordEconomyEntry({
      userId: "user-1",
      amount: 0,
      reason: "invalid",
      kind: "credit",
    })).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
