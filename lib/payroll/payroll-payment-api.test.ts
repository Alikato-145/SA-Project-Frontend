import { expect, test } from "bun:test";
import { payrollPaymentApi } from "./payroll-payment-api";
test("payment requests preserve branch and canonical IDs", async () => { const calls: {
  url: string;
  init?: RequestInit;
}[] = []; const fetcher = (async (url: URL | RequestInfo, init?: RequestInit) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify({ data: [], request_id: "x" }), { headers: { "content-type": "application/json" } }); }) as typeof fetch; await payrollPaymentApi.list("2", "3", { fetcher }); await payrollPaymentApi.prepare("2", "3", { fetcher }); expect(calls.map(c => c.url)).toEqual(["/api/v1/payroll/periods/2/payments?branch_id=3", "/api/v1/payroll/periods/2/payments/prepare?branch_id=3"]); expect(calls[1]?.init?.method).toBe("POST"); });
