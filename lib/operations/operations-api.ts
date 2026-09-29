import { apiRequest, ApiClientError } from "../api/client";
import type { AuthenticatedActor } from "../auth/auth-api";

export type OperationOptions = RequestInit & { fetcher?: typeof fetch; baseUrl?: string };
export const operationsRequest = <T>(path: string, options: OperationOptions = {}) =>
  apiRequest<T>(`/v1${path}`, {
    ...options, credentials: "same-origin",
    headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...options.headers },
  });

// C4's Thai workflow screens use the compatibility routes while B5 uses the
// feature routes above. Both share the signed-in API client and error envelope.
export const operationsApi = {
  request<T>(path: string, init: RequestInit = {}) {
    return apiRequest<T>(`/v1/operations${path}`, {
      ...init,
      credentials: "same-origin",
      headers: { "content-type": "application/json", ...init.headers },
    });
  },
};
export const operationError = (cause: unknown) => {
  if (cause instanceof ApiClientError && cause.status === 401) return "Your session has expired. Sign in again to continue; your entered values are preserved.";
  if (cause instanceof ApiClientError && cause.status === 403) return "You do not have permission for this employee or action.";
  return cause instanceof Error ? cause.message : "Could not complete the request.";
};
export const operationPermissions = (actor: AuthenticatedActor | null) => {
  const roles = actor?.grants.map((grant) => grant.role_code) ?? [];
  const canFinance = roles.some((role) => ["HR", "OWNER"].includes(role));
  const canManage = canFinance || roles.some((role) => ["SUPERVISOR", "BRANCH_MANAGER"].includes(role));
  return { canManage, canApprove: canManage, canFinance, selfOnly: !canManage };
};
export type DecisionHistory = { id: string; actor_user_account_id: string; action: string; acted_at: string; remark: string | null;
  from_leave_type_id?: string | null; to_leave_type_id?: string | null };
export type LeaveType = { id: string; code: string; name: string; quota_type: string; is_deductible: boolean; allow_exceed: boolean; is_active: boolean };
export type LeaveQuota = { id: string; leave_type_id: string; quota_year: number; entitled_days: string; used_days: string };
export type BranchSchedule = { id: string; branch_id: string; work_start_time: string; standard_close_time: string;
  late_grace_minutes: number; effective_from: string; effective_to: string | null };
export type ScheduleOverride = { id: string; branch_id: string; schedule_date: string; is_closed: boolean; work_start_time: string | null; close_time: string | null; reason: string | null };
export type ApplicableSchedule = { kind: "schedule"; schedule: BranchSchedule } | { kind: "override"; override: ScheduleOverride } | { kind: "none" };
export type Holiday = { id: string; shop_id: string; holiday_date: string; name: string; is_active: boolean };
