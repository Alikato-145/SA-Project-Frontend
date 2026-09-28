import { expect, test } from "bun:test";
import { organizationApi } from "./organization-api";

const calls: Array<{ url: string; init?: RequestInit }> = [];
const fetcher = ((url: string | URL | Request, init?: RequestInit) => {
  calls.push({ url: String(url), init });
  return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
}) as typeof fetch;

test("organization adapter keeps active filters and encoded scope IDs", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetcher;
  try {
    await organizationApi.listActiveShops();
    await organizationApi.listActiveBranches("9");
    expect(calls.map((call) => call.url)).toEqual([
      "/api/v1/shops?is_active=true",
      "/api/v1/branches?is_active=true&shop_id=9",
    ]);
  } finally { globalThis.fetch = originalFetch; }
});
