import { apiRequestEnvelope } from "../api/client";

export type Payslip = {
  id: string;
  payroll_record_id: string;
  employee_id: string;
  status: "generated" | "voided";
  generated_at: string;
  total_earnings: string;
  total_deductions: string;
  net_pay: string;
};
export type PayslipDelivery = {
  id: string;
  recipient_email: string;
  status: "sent" | "failed";
  attempted_at: string;
};
export type PayslipResult<T> = { data: T; requestId: string | null };
export type PayslipApiOptions = { fetcher?: typeof fetch; baseUrl?: string; signal?: AbortSignal };

const request = <T>(path: string, options: PayslipApiOptions = {}, init: RequestInit = {}): Promise<PayslipResult<T>> =>
  apiRequestEnvelope<T>(`/v1/payslips${path}`, {
    baseUrl: options.baseUrl,
    fetcher: options.fetcher,
    signal: options.signal,
    credentials: "same-origin",
    ...init,
    headers: init.method === "POST" ? { "content-type": "application/json", ...init.headers } : init.headers,
  });

export const payslipApi = {
  mine: (options?: PayslipApiOptions) => request<Payslip[]>("/mine", options),
  get: (payslipId: string, options?: PayslipApiOptions) => request<Payslip>(`/${encodeURIComponent(payslipId)}`, options),
  generate: (recordId: string, options?: PayslipApiOptions) => request<Payslip>(`/payroll-records/${encodeURIComponent(recordId)}`, options, { method: "POST", body: "{}" }),
  deliveries: (payslipId: string, options?: PayslipApiOptions) => request<PayslipDelivery[]>(`/${encodeURIComponent(payslipId)}/deliveries`, options),
  deliver: (payslipId: string, recipientEmail: string, options?: PayslipApiOptions) => request<PayslipDelivery>(`/${encodeURIComponent(payslipId)}/deliveries`, options, { method: "POST", body: JSON.stringify({ recipient_email: recipientEmail }) }),
  void: (payslipId: string, options?: PayslipApiOptions) => request<{ id: string; status: "voided" }>(`/${encodeURIComponent(payslipId)}/void`, options, { method: "POST", body: "{}" }),
};
