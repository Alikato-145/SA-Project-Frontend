import { expect, test } from "bun:test";
import { payslipApi } from "./payslip-api";

test("payslip mutations send JSON through the authenticated API boundary", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return Promise.resolve(new Response(JSON.stringify({ data: { id: "1", status: "voided" }, request_id: "req-1" })));
  }) as typeof fetch;

  await payslipApi.generate("44", { baseUrl: "http://test/api", fetcher });
  await payslipApi.deliver("1", "hr@example.test", { baseUrl: "http://test/api", fetcher });
  await payslipApi.void("1", { baseUrl: "http://test/api", fetcher });

  expect(calls.map((call) => call.url)).toEqual([
    "http://test/api/v1/payslips/payroll-records/44",
    "http://test/api/v1/payslips/1/deliveries",
    "http://test/api/v1/payslips/1/void",
  ]);
  expect(calls.every((call) => (call.init?.headers as Record<string, string>)["content-type"] === "application/json")).toBe(true);
  expect(calls[1]?.init?.body).toBe('{"recipient_email":"hr@example.test"}');
});
