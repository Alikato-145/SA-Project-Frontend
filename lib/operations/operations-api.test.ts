import { expect, test } from "bun:test";
import { operationsApi } from "./operations-api";

test("operations requests use the authenticated versioned API envelope", async () => {
  const originalFetch = globalThis.fetch;
  let url = "";
  let init: RequestInit | undefined;
  globalThis.fetch = ((input: string | URL | Request, request?: RequestInit) => {
    url = String(input); init = request;
    return Promise.resolve(new Response(JSON.stringify({ data: [] , request_id: "r1" }), { status: 200 }));
  }) as typeof fetch;
  try {
    await operationsApi.request("/leave-requests?employee_id=4");
    expect(url).toBe("/api/v1/operations/leave-requests?employee_id=4");
    expect(init?.credentials).toBe("include");
  } finally { globalThis.fetch = originalFetch; }
});
