import { expect, test } from "bun:test";
import { employeeReadApi } from "./employee-read-api";

test("primary bank mutation retains the JSON contract even without payload fields", async () => {
  const originalFetch = globalThis.fetch;
  let captured: RequestInit | undefined;
  globalThis.fetch = (async (_input, init) => { captured = init; return new Response(JSON.stringify({ data: {}, request_id: "bank-primary" }), { status: 200 }); }) as typeof fetch;
  try {
    await employeeReadApi.makePrimaryBankAccount("41", "9");
    expect(captured?.method).toBe("POST");
    expect(new Headers(captured?.headers).get("content-type")).toBe("application/json");
    expect(captured?.body).toBe("{}");
  } finally { globalThis.fetch = originalFetch; }
});

test("employee list keeps server pagination and scoped filters", async () => {
  const originalFetch = globalThis.fetch;
  let url = "";
  globalThis.fetch = ((input: string | URL | Request) => {
    url = String(input);
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: [],
          page: 2,
          page_size: 20,
          total: 37,
          request_id: "req-employees",
        }),
        { status: 200 },
      ),
    );
  }) as typeof fetch;
  try {
    const page = await employeeReadApi.list({
      page: 2,
      search: "มะยู",
      status: "active",
    });
    expect(page.total).toBe(37);
    expect(page.page).toBe(2);
    expect(url).toBe(
      "/api/v1/employees?page=2&page_size=20&search=%E0%B8%A1%E0%B8%B0%E0%B8%A2%E0%B8%B9&status=active",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("assignment change sends decimal strings to the append-only route", async () => {
  const originalFetch = globalThis.fetch;
  let request: { url: string; init?: RequestInit } | null = null;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    request = { url: String(input), init };
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: { created: { id: "9" }, closed: { id: "8" } },
          request_id: "req-assignment",
        }),
        { status: 200 },
      ),
    );
  }) as typeof fetch;
  try {
    const assignment = {
      branch_id: "11",
      department_id: "21",
      position_id: "31",
      employment_type: "full_time" as const,
      base_salary: "18000.00",
      welfare_amount: "500.00",
      effective_from: "2026-10-01",
      effective_to: null,
    };
    await employeeReadApi.addAssignment("41", assignment);
    const call = request as unknown as { url: string; init: RequestInit };
    expect(call.url).toBe("/api/v1/employees/41/assignments");
    expect(call.init.method).toBe("POST");
    expect(call.init.credentials).toBe("include");
    expect(JSON.parse(String(call.init.body))).toEqual(assignment);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("payment destination uses a dedicated contract without contact phone", async () => {
  const originalFetch = globalThis.fetch;
  let call: RequestInit | undefined;
  let url = "";
  globalThis.fetch = (async (input, init) => { url = String(input); call = init; return new Response(JSON.stringify({ data: { payment_method: "transfer", promptpay_phone: "0812345678" }, request_id: "payment" })); }) as typeof fetch;
  try {
    await employeeReadApi.savePaymentDestination("41", { payment_method: "transfer", promptpay_phone: "0812345678" });
    expect(url).toBe("/api/v1/employees/41/payment-destination");
    expect(call?.method).toBe("PUT");
    expect(JSON.parse(String(call?.body))).toEqual({ payment_method: "transfer", promptpay_phone: "0812345678" });
  } finally { globalThis.fetch = originalFetch; }
});

test("employee list sends branch and department filters together with search and status", async () => {
  const originalFetch = globalThis.fetch;
  let url = "";
  globalThis.fetch = (async (input) => {
    url = String(input);
    return new Response(JSON.stringify({ data: [], page: 1, page_size: 20, total: 0, request_id: "test" }));
  }) as typeof fetch;
  try {
    await employeeReadApi.list({ page: 1, search: "name", status: "active", branchId: "12", departmentId: "34" } as Parameters<typeof employeeReadApi.list>[0]);
    expect(url).toContain("branch_id=12");
    expect(url).toContain("department_id=34");
    expect(url).toContain("search=name");
    expect(url).toContain("status=active");
  } finally { globalThis.fetch = originalFetch; }
});
