import { expect, test } from "bun:test";
import { authApi } from "./auth-api";

test("current actor request includes the browser session", async () => {
  const originalFetch = globalThis.fetch;
  let init: RequestInit | undefined;
  globalThis.fetch = ((_: string | URL | Request, request?: RequestInit) => {
    init = request;
    return Promise.resolve(new Response(JSON.stringify({ ok: true, data: { account: {}, grants: [], capabilities: [] } }), { status: 200 }));
  }) as typeof fetch;
  try {
    await authApi.current();
    expect(init?.credentials).toBe("include");
  } finally { globalThis.fetch = originalFetch; }
});
