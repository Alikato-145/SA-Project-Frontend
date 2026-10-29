import { apiRequest, apiRequestEnvelope, apiRequestAll } from "../api/client";

export type Shop = { id: string; code: string; name: string; is_active: boolean };
export type Branch = { id: string; shop_id: string; code: string; name: string; is_active: boolean };

const request = <T>(path: string, init?: RequestInit) => apiRequest<T>(path, { ...init, credentials: "include" });
// Master-list APIs default to active; history selectors also collect inactive rows.
const historyChoices = async <T>(path: string, signal?: AbortSignal): Promise<T[]> => (await Promise.all(
  [true, false].map(active => apiRequestAll<T>(`${path}${path.includes("?") ? "&" : "?"}is_active=${active}`, { credentials: "include", signal })),
)).flat();

export const organizationApi = {
  listShops: (signal?: AbortSignal) => historyChoices<Shop>("/v1/shops", signal),
  listBranches: (shopId: string, signal?: AbortSignal) => historyChoices<Branch>(`/v1/branches?shop_id=${encodeURIComponent(shopId)}`, signal),
  listDepartments: (branchId: string, signal?: AbortSignal) => historyChoices<{ id: string; branch_id: string; code: string; name: string }>(`/v1/departments?branch_id=${encodeURIComponent(branchId)}`, signal),
  listActiveShops: () => apiRequestAll<Shop>("/v1/shops?is_active=true", { credentials: "include" }),
  listActiveBranches: (shopId: string) => apiRequestAll<Branch>(`/v1/branches?is_active=true&shop_id=${encodeURIComponent(shopId)}`, { credentials: "include" }),
  createShop: (input: Pick<Shop, "name">) => request<Shop>("/v1/shops", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }),
  createBranch: (input: Pick<Branch, "shop_id" | "name">) => request<Branch>("/v1/branches", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }),
  listAccounts: (page = 1, pageSize = 20) => apiRequestEnvelope<{ items: AccountSummary[] }>(`/v1/accounts/?page=${page}&page_size=${pageSize}`, { credentials: "include" }),
  listAllAccounts: async (): Promise<AccountSummary[]> => {
    const accounts: AccountSummary[] = [];
    for (let page = 1; ; page++) {
      const result = await organizationApi.listAccounts(page, 100);
      accounts.push(...result.data.items);
      if (result.data.items.length < 100) return accounts;
    }
  },
  createAccount: (input: { username: string }) => request<{ account: AccountSummary; temporary_password: string }>("/v1/accounts/", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }),
  listRoles: () => request<Role[]>("/v1/roles"),
  grantRole: (accountId: string, input: GrantRoleInput) => request<unknown>(`/v1/accounts/${encodeURIComponent(accountId)}/roles`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }),
};

export type AccountSummary = { id: string; username: string; status: "active" | "locked" | "disabled"; employee: { id: string; display_name: string } | null };
export type Role = { id: string; code: "EMPLOYEE" | "SUPERVISOR" | "BRANCH_MANAGER" | "HR" | "OWNER"; name: string; scope: "self" | "department" | "branch" | "all"; is_active: boolean };
export type GrantRoleInput = { role_code: Role["code"]; branch_id?: string | null; department_id?: string | null; reason: string };
