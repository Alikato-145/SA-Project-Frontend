import { apiRequestEnvelope } from "../api/client";

export type PayrollDirection = "earning" | "deduction";
export type PayrollPeriodStatus = "draft" | "previewed" | "locked";
export type PayrollConfiguration = { id: string; shop_id: string; branch_id: string | null; config_key: string;
  numeric_value: string; unit: string; effective_from: string; effective_to: string | null };
export type PayrollPeriod = { id: string; shop_id: string; period_year: number; period_month: number;
  start_date: string; end_date: string; status: PayrollPeriodStatus; previewed_at: string | null;
  locked_by_user_account_id: string | null; locked_at: string | null };
export type PayrollItem = { item_type: string; direction: PayrollDirection; description: string; quantity: string | null;
  rate: string | null; amount: string; payroll_configuration_id: string | null; source_table: string | null;
  source_id: string | null; occurred_on: string | null };
export type PayrollRecord = { id?: string; payroll_period_id?: string; status?: string; employee_id: string;
  employment_assignment_id: string; branch_id: string; base_salary_snapshot: string; welfare_snapshot: string;
  total_earnings: string; total_deductions: string; net_pay: string; items: PayrollItem[] };
export type PayrollBlocker = { code: string; employeeId: string | null; detail: string };
export type PayrollPreview = { period: PayrollPeriod; records: PayrollRecord[]; blockers: PayrollBlocker[] };
export type PayrollAdjustment = { id: string; original_payroll_record_id: string; applied_payroll_period_id: string | null;
  direction: PayrollDirection; amount: string; reason: string; status: string; requested_by_user_account_id: string;
  requested_at: string; approved_by_user_account_id: string | null; approved_at: string | null; applied_payroll_item_id: string | null };
export type PayrollResult<T> = { data: T; requestId: string | null };
export type PayrollAccess = { can_mutate: boolean; readable_branch_ids: string[] | null };

export type PayrollApiOptions = { fetcher?: typeof fetch; baseUrl?: string; signal?: AbortSignal };
const request = <T>(path: string, options: PayrollApiOptions = {}, init: RequestInit = {}): Promise<PayrollResult<T>> =>
  apiRequestEnvelope<T>(`/v1/payroll${path}`, {
    baseUrl: options.baseUrl, fetcher: options.fetcher, signal: options.signal, credentials: "same-origin", ...init,
    headers: init.body ? { "content-type": "application/json", ...init.headers } : init.headers,
  });

export const payrollApi = {
  getAccess: (options?: PayrollApiOptions) => request<PayrollAccess>("/access", options),
  listConfigurations: (shopId: string, options?: PayrollApiOptions) => request<PayrollConfiguration[]>(`/configurations?shop_id=${encodeURIComponent(shopId)}`, options),
  createConfiguration: (body: Omit<PayrollConfiguration, "id">, options?: PayrollApiOptions) => request<PayrollConfiguration>("/configurations", options, { method: "POST", body: JSON.stringify(body) }),
  listPeriods: (shopId: string, options?: PayrollApiOptions) => request<PayrollPeriod[]>(`/periods?shop_id=${encodeURIComponent(shopId)}`, options),
  createPeriod: (body: { shop_id: string; period_year: number; period_month: number; start_date: string; end_date: string }, options?: PayrollApiOptions) => request<PayrollPeriod>("/periods", options, { method: "POST", body: JSON.stringify(body) }),
  getPeriod: (periodId: string, options?: PayrollApiOptions) => request<PayrollPreview>(`/periods/${encodeURIComponent(periodId)}`, options),
  previewPeriod: (periodId: string, options?: PayrollApiOptions) => request<PayrollPreview>(`/periods/${encodeURIComponent(periodId)}/preview`, options, { method: "POST", body: "{}" }),
  lockPeriod: (periodId: string, options?: PayrollApiOptions) => request<PayrollPreview>(`/periods/${encodeURIComponent(periodId)}/lock`, options, { method: "POST", body: "{}" }),
  getRecord: (periodId: string, recordId: string, options?: PayrollApiOptions) => request<PayrollRecord>(`/periods/${encodeURIComponent(periodId)}/records/${encodeURIComponent(recordId)}`, options),
  listAdjustments: (recordId: string | undefined, options?: PayrollApiOptions) => request<PayrollAdjustment[]>(`/adjustments${recordId ? `?record_id=${encodeURIComponent(recordId)}` : ""}`, options),
  requestAdjustment: (body: { original_payroll_record_id: string; applied_payroll_period_id: string; direction: PayrollDirection; amount: string; reason: string }, options?: PayrollApiOptions) => request<PayrollAdjustment>("/adjustments", options, { method: "POST", body: JSON.stringify(body) }),
  decideAdjustment: (id: string, decision: "approve" | "reject", options?: PayrollApiOptions) => request<PayrollAdjustment>(`/adjustments/${encodeURIComponent(id)}/${decision}`, options, { method: "POST", body: "{}" }),
};
