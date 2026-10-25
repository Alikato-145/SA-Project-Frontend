import { expect, test } from "bun:test";
import { payrollPaymentApi } from "./payroll-payment-api";
test("payment requests preserve branch and canonical IDs", async () => { const calls: {
  url: string;
  init?: RequestInit;
}[] = []; const fetcher = (async (url: URL | RequestInfo, init?: RequestInit) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify({ data: [], request_id: "x" }), { headers: { "content-type": "application/json" } }); }) as typeof fetch; await payrollPaymentApi.list("2", "3", { fetcher }); await payrollPaymentApi.prepare("2", "3", { fetcher }); expect(calls.map(c => c.url)).toEqual(["/api/v1/payroll/periods/2/payments?branch_id=3", "/api/v1/payroll/periods/2/payments/prepare?branch_id=3"]); expect(calls[1]?.init?.method).toBe("POST"); });
test("lifecycle requests send safe reference/reason bodies and fetch branch summary", async () => {
 const calls: { url: string; init?: RequestInit }[] = [];
 const fetcher = (async (url: URL | RequestInfo, init?: RequestInit) => { calls.push({url: String(url), init}); return new Response(JSON.stringify({data: {}, request_id: "x"}), {headers: {"content-type": "application/json"}}); }) as typeof fetch;
 await payrollPaymentApi.confirm("7", "receipt-1", {fetcher}); await payrollPaymentApi.cancel("8", "correct destination", {fetcher}); await payrollPaymentApi.summary("2", "3", {fetcher});
 expect(calls.map(c => c.url)).toEqual(["/api/v1/payroll/payments/7/confirm", "/api/v1/payroll/payments/8/cancel", "/api/v1/payroll/periods/2/payments/summary?branch_id=3"]);
 expect(calls.slice(0,2).map(c => c.init?.method)).toEqual(["POST", "POST"]);
 expect(calls.slice(0,2).map(c => JSON.parse(String(c.init?.body)))).toEqual([{reference_no: "receipt-1"}, {reason: "correct destination"}]);
});
test("payment state conflict explains that the saved decision cannot be overwritten", async () => {
 const fetcher = (async () => new Response(JSON.stringify({error:{code:"PAYMENT_STATE_CONFLICT",message:"Payment state conflict"}}),{status:409,headers:{"content-type":"application/json"}})) as typeof fetch;
 await expect(payrollPaymentApi.confirm("7","changed",{fetcher})).rejects.toMatchObject({code:"PAYMENT_STATE_CONFLICT",message:"รายการนี้มีการยืนยันจ่ายหรือยกเลิกแล้วด้วยข้อมูลอื่น กรุณาโหลดข้อมูลใหม่"});
});
