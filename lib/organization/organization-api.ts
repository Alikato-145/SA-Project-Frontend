import { apiRequest, apiRequestEnvelope } from "../api/client";

export type Shop = { id: string; code: string; name: string; is_active: boolean };
export type Branch = { id: string; shop_id: string; code: string; name: string; is_active: boolean };

const request = <T>(path: string, init?: RequestInit) => apiRequest<T>(path, { ...init, credentials: "include" });

export const organizationApi = {
  listActiveShops: () => request<Shop[]>("/v1/shops?is_active=true"),
  listActiveBranches: (shopId: string) => request<Branch[]>(`/v1/branches?is_active=true&shop_id=${encodeURIComponent(shopId)}`),
  createShop: (input: Pick<Shop, "code" | "name">) => request<Shop>("/v1/shops", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }),
  createBranch: (input: Pick<Branch, "shop_id" | "code" | "name">) => request<Branch>("/v1/branches", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }),
  listAccounts: () => apiRequestEnvelope<{ items: AccountSummary[] }>("/v1/accounts/", { credentials: "include" }),
  createAccount: (input: { username: string }) => request<{ account: AccountSummary; temporary_password: string }>("/v1/accounts/", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }),
  listRoles: () => request<Role[]>("/v1/roles"),
  grantRole: (accountId: string, input: GrantRoleInput) => request<unknown>(`/v1/accounts/${encodeURIComponent(accountId)}/roles`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }),
};

export type AccountSummary = { id: string; username: string; status: "active" | "locked" | "disabled" };
export type Role = { id: string; code: "EMPLOYEE" | "SUPERVISOR" | "BRANCH_MANAGER" | "HR" | "OWNER"; name: string; scope: "self" | "department" | "branch" | "all"; is_active: boolean };
export type GrantRoleInput = { role_code: Role["code"]; branch_id?: string | null; department_id?: string | null; reason: string };
