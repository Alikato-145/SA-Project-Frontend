import { expect, test } from "bun:test";
import { onboardingApi, type OnboardingInput } from "./onboarding-api";

test("onboarding uses the atomic endpoint and preserves exact money strings", async () => {
  const originalFetch = globalThis.fetch;
  let request: { url: string; init?: RequestInit } | null = null;
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    request = { url: String(url), init };
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: {
            employee: {
              id: "41",
              employee_code: "EMP-41",
              first_name: "A",
              last_name: "B",
            },
            assignment_id: "91",
            bank_account_id: null,
            weekly_holiday_ids: [],
            account_id: null,
          },
          request_id: "req-1",
        }),
        { status: 200 },
      ),
    );
  }) as typeof fetch;
  try {
    const input: OnboardingInput = {
      employee: {
        employee_code: "EMP-41",
        national_id: null,
        passport_id: "P41",
        first_name: "A",
        last_name: "B",
        hire_date: "2026-09-29",
      },
      assignment: {
        branch_id: "11",
        department_id: "21",
        position_id: "31",
        employment_type: "full_time",
        base_salary: "18000.00",
        welfare_amount: "500.00",
        effective_from: "2026-09-29",
      },
      weekly_holidays: [{ weekday: 0, effective_from: "2026-09-29" }],
    };
    const result = await onboardingApi.onboard(input);
    expect(result.assignment_id).toBe("91");
    expect(request).not.toBeNull();
    const call = request as unknown as { url: string; init: RequestInit };
    expect(call.url).toBe("/api/v1/employees/onboard");
    expect(call.init.method).toBe("POST");
    expect(call.init.credentials).toBe("include");
    expect(JSON.parse(String(call.init.body))).toEqual(input);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("organization choices collect all pages for onboarding", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = ((url: string | URL | Request) => {
    calls.push(String(url));
    const page = new URL(String(url), "http://localhost").searchParams.get(
      "page",
    );
    const count = page === "1" ? 100 : 1;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: Array.from({ length: count }, (_, index) => ({
            id: `${page}-${index}`,
            code: "X",
            name: "Example",
          })),
          request_id: "req-2",
        }),
        { status: 200 },
      ),
    );
  }) as typeof fetch;
  try {
    expect((await onboardingApi.shops()).length).toBe(101);
    expect(calls).toEqual([
      "/api/v1/shops?is_active=true&page=1&page_size=100",
      "/api/v1/shops?is_active=true&page=2&page_size=100",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
