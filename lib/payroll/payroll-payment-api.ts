import { apiRequestEnvelope } from "../api/client";
import type { PayrollApiOptions } from "./payroll-api";
export type PayrollPaymentRow = {
  payroll_record_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  branch_id: string;
  branch_name: string;
  group: "social_security" | "cash" | "transfer";
  payment_method: "cash" | "transfer";
  amount: string;
  status: "zero" | "unprepared" | "prepared" | "paid";
  missing_destination: string | null;
  qr_available: boolean;
  payment: {
    id: string;
    promptpay_phone: string | null;
    bank_code: string | null;
    account_holder_name: string | null;
    account_number_last4: string | null;
    prepared_at: string;
  } | null;
};
const request = (periodId: string, branchId: string, prepare: boolean, options: PayrollApiOptions = {}) => apiRequestEnvelope<PayrollPaymentRow[]>(`/v1/payroll/periods/${periodId}/payments${prepare ? "/prepare" : ""}${branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ""}`, { ...options, credentials: "same-origin", method: prepare ? "POST" : "GET", ...(prepare ? { headers: { "content-type": "application/json" }, body: "{}" } : {}) });
export const payrollPaymentApi = { list: (periodId: string, branchId: string, options?: PayrollApiOptions) => request(periodId, branchId, false, options), prepare: (periodId: string, branchId: string, options?: PayrollApiOptions) => request(periodId, branchId, true, options) };
