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
      "/api/v1/shops?is_active=true&page=1&page_size=100",
      "/api/v1/branches?is_active=true&shop_id=9&page=1&page_size=100",
    ]);
  } finally { globalThis.fetch = originalFetch; }
});

test("settings role selection includes accounts beyond the first page", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const page = new URL(String(input), "http://localhost").searchParams.get("page");
    const items = Array.from({ length: page === "1" ? 100 : 1 }, (_, index) => ({ id: `${page}-${index}`, username: `account-${page}-${index}` }));
    return new Response(JSON.stringify({ data: { items }, request_id: "account-pages" }), { status: 200 });
  }) as typeof fetch;
  try { expect(await organizationApi.listAllAccounts()).toHaveLength(101); }
  finally { globalThis.fetch = originalFetch; }
});
