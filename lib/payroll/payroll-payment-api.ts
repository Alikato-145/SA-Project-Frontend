import { apiRequestEnvelope } from "../api/client";
import type { PayrollApiOptions } from "./payroll-api";
export type PaymentLifecycle = {
  id: string; status: "prepared" | "paid" | "cancelled"; amount: string;
  promptpay_phone: string | null; bank_code: string | null; account_holder_name: string | null; account_number_last4: string | null;
  prepared_at: string; prepared_by_user_account_id: string;
  paid_at: string | null; paid_by_user_account_id: string | null; reference_no: string | null;
  cancelled_at: string | null; cancelled_by_user_account_id: string | null; cancellation_reason: string | null;
};
export type PaymentSummaryCounts = { employee_count: number; payable_count: number; paid_count: number; outstanding_count: number; total_payable: string; total_paid: string; total_outstanding: string; complete: boolean };
export type PaymentSummary = { branches: (PaymentSummaryCounts & { branch_id: string; branch_name: string })[]; totals: PaymentSummaryCounts };
export type PayrollPaymentRow = {
  payroll_record_id: string; employee_id: string; employee_code: string; employee_name: string; branch_id: string; branch_name: string;
  group: "social_security" | "cash" | "transfer"; payment_method: "cash" | "transfer"; amount: string;
  status: "zero" | "unprepared" | "prepared" | "paid"; missing_destination: string | null; qr_available: boolean;
  payment: PaymentLifecycle | null; payment_history: PaymentLifecycle[];
};
const request = (periodId: string, branchId: string, prepare: boolean, options: PayrollApiOptions = {}) => apiRequestEnvelope<PayrollPaymentRow[]>(`/v1/payroll/periods/${periodId}/payments${prepare ? "/prepare" : ""}${branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ""}`, { ...options, credentials: "same-origin", method: prepare ? "POST" : "GET", ...(prepare ? { headers: { "content-type": "application/json" }, body: "{}" } : {}) });
const lifecycle = (id: string, action: "confirm" | "cancel", body: object, options: PayrollApiOptions = {}) => apiRequestEnvelope<PaymentLifecycle>(`/v1/payroll/payments/${id}/${action}`, { ...options, credentials: "same-origin", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
export const payrollPaymentApi = {
  list: (periodId: string, branchId: string, options?: PayrollApiOptions) => request(periodId, branchId, false, options),
  prepare: (periodId: string, branchId: string, options?: PayrollApiOptions) => request(periodId, branchId, true, options),
  confirm: (id: string, referenceNo: string, options?: PayrollApiOptions) => lifecycle(id, "confirm", { reference_no: referenceNo }, options),
  cancel: (id: string, reason: string, options?: PayrollApiOptions) => lifecycle(id, "cancel", { reason }, options),
  summary: (periodId: string, branchId: string, options: PayrollApiOptions = {}) => apiRequestEnvelope<PaymentSummary>(`/v1/payroll/periods/${periodId}/payments/summary${branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ""}`, { ...options, credentials: "same-origin" }),
};
