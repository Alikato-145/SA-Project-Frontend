import { expect, test } from "bun:test";
import { employeeReadApi } from "./employee-read-api";

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
