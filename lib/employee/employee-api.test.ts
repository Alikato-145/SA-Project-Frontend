import { expect, test } from "bun:test";
import { employeeApi } from "./employee-api";

test("employee adapter keeps the authenticated A3 paths and payload", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return Promise.resolve(new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
  }) as typeof fetch;
  try {
    await employeeApi.list();
    await employeeApi.list("สมชาย");
    await employeeApi.create({ employee_code: "SMOKE-001", national_id: "1234567890123", first_name: "Smoke", last_name: "Test", hire_date: "2026-09-28" });
    expect(calls.map(({ url }) => url)).toEqual(["/api/v1/employees?page=1&page_size=50&status=active", "/api/v1/employees?page=1&page_size=50&status=active&search=%E0%B8%AA%E0%B8%A1%E0%B8%8A%E0%B8%B2%E0%B8%A2", "/api/v1/employees"]);
    expect(calls[2]?.init?.credentials).toBe("include");
    expect(calls[2]?.init?.body).toBe(JSON.stringify({ employee_code: "SMOKE-001", national_id: "1234567890123", first_name: "Smoke", last_name: "Test", hire_date: "2026-09-28" }));
  } finally { globalThis.fetch = originalFetch; }
});
