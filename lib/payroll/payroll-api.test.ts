import { describe, expect, test } from "bun:test";
import { ApiClientError } from "../api/client";
import { payrollApi } from "./payroll-api";

const calls: { url: string; init?: RequestInit }[] = [];
const fetcher = ((url: string | URL | Request, init?: RequestInit) => {
  calls.push({ url: String(url), init });
  return Promise.resolve(new Response(JSON.stringify({ data: { id: "20", net_pay: "12500.40" }, request_id: "payroll-req" }), { status: 200 }));
}) as typeof fetch;

describe("payroll API", () => {
  test("preserves decimal strings and request correlation", async () => {
    const result = await payrollApi.getRecord("20", "70", { fetcher });
    expect(result).toEqual({ data: { id: "20", net_pay: "12500.40" }, requestId: "payroll-req" });
    expect(calls.at(-1)?.url).toBe("/api/v1/payroll/periods/20/records/70");
  });

  test("maps every C2 endpoint and mutation method", async () => {
    calls.length = 0;
    await payrollApi.getAccess({ fetcher });
    await payrollApi.listConfigurations("1", { fetcher });
    await payrollApi.createConfiguration({ shop_id: "1", branch_id: null, config_key: "STANDARD_WORK_DAYS", numeric_value: "20.0000", unit: "days", effective_from: "2026-01-01", effective_to: null }, { fetcher });
    await payrollApi.listPeriods("1", { fetcher });
    await payrollApi.createPeriod({ shop_id: "1", period_year: 2026, period_month: 9, start_date: "2026-09-01", end_date: "2026-09-30" }, { fetcher });
    await payrollApi.getPeriod("20", { fetcher });
    await payrollApi.previewPeriod("20", { fetcher });
    await payrollApi.lockPeriod("20", { fetcher });
    await payrollApi.getRecord("20", "70", { fetcher });
    await payrollApi.listAdjustments("70", { fetcher });
    await payrollApi.requestAdjustment({ original_payroll_record_id: "70", applied_payroll_period_id: "21", direction: "earning", amount: "100.00", reason: "Correction" }, { fetcher });
    await payrollApi.decideAdjustment("60", "approve", { fetcher });
    await payrollApi.decideAdjustment("61", "reject", { fetcher });
    expect(calls).toHaveLength(13);
    expect(calls.filter((call) => call.init?.method === "POST")).toHaveLength(7);
  });

  test("normalizes server, abort, and network failures", async () => {
    const rejected = (() => Promise.resolve(new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Forbidden" }, request_id: "denied" }), { status: 403 }))) as typeof fetch;
    await expect(payrollApi.listPeriods("1", { fetcher: rejected })).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    const aborted = (() => Promise.reject(new DOMException("aborted", "AbortError"))) as typeof fetch;
    await expect(payrollApi.listPeriods("1", { fetcher: aborted })).rejects.toMatchObject({ code: "REQUEST_ABORTED" });
    const offline = (() => Promise.reject(new Error("offline"))) as typeof fetch;
    await expect(payrollApi.listPeriods("1", { fetcher: offline })).rejects.toBeInstanceOf(ApiClientError);
  });
});
