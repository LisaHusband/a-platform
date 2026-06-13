import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, API_BASE, getToken, setToken } from "./api";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("token storage", () => {
  it("returns null when unset and round-trips a token", () => {
    expect(getToken()).toBeNull();
    setToken("abc");
    expect(getToken()).toBe("abc");
    setToken(null);
    expect(getToken()).toBeNull();
  });
});

describe("api()", () => {
  it("prefixes API_BASE and parses JSON", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ hello: "world" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const data = await api<{ hello: string }>("/ping");
    expect(data.hello).toBe("world");
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/ping`, expect.any(Object));
    expect(API_BASE).toContain("/api/v1");
  });

  it("attaches Authorization header when a token exists", async () => {
    setToken("tok123");
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await api("/me");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
  });

  it("sends JSON body and content-type on POST", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await api("/x", { method: "POST", body: { a: 1 } });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("throws ApiError with string detail", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 409,
      statusText: "Conflict",
      json: async () => ({ detail: "already exists" }),
    }));
    await expect(api("/x")).rejects.toMatchObject({ status: 409, message: "already exists" });
  });

  it("stringifies non-string detail", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 422,
      statusText: "Unprocessable",
      json: async () => ({ detail: [{ msg: "bad" }] }),
    }));
    await expect(api("/x")).rejects.toThrow(/msg/);
  });

  it("falls back to statusText when body is not JSON", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 500,
      statusText: "Server Error",
      json: async () => {
        throw new Error("not json");
      },
    }));
    await expect(api("/x")).rejects.toThrow("Server Error");
  });

  it("ApiError carries status", () => {
    const e = new ApiError(403, "nope");
    expect(e.status).toBe(403);
    expect(e.message).toBe("nope");
  });
});
