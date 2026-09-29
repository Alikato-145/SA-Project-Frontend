import { apiRequestPage } from "../api/client";

export type AuditLog = {
  id: string;
  actor_account_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  old_data: unknown;
  new_data: unknown;
  reason: string | null;
  occurred_at: string;
  request_id: string | null;
};

export type AuditFilters = {
  page?: number;
  page_size?: number;
  action?: string;
  actor_account_id?: string;
  table_name?: string;
  record_id?: string;
  request_id?: string;
  occurred_from?: string;
  occurred_to?: string;
};

export type AuditApiOptions = {
  fetcher?: typeof fetch;
  baseUrl?: string;
  signal?: AbortSignal;
};

export const auditApi = {
  list(filters: AuditFilters = {}, options: AuditApiOptions = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value !== undefined && value !== "") query.set(key, String(value));

    return apiRequestPage<AuditLog>(`/v1/audit-logs/?${query}`, {
      baseUrl: options.baseUrl,
      fetcher: options.fetcher,
      signal: options.signal,
      credentials: "same-origin",
    });
  },
};
