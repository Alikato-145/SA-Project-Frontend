import { apiRequest } from "../api/client";

export interface AuthenticatedAccount {
  id: string;
  username: string;
  status: "active" | "locked" | "disabled";
  employee: {
    id: string;
    employee_code: string;
    display_name: string;
  } | null;
}

export interface AuthenticatedActor {
  account: AuthenticatedAccount;
  grants: Array<{
    id: string;
    role_code: string;
    scope: string;
    branch_id: string | null;
    department_id: string | null;
  }>;
  capabilities: string[];
}

export const authApi = {
  login(input: { username: string; password: string }) {
    return apiRequest<AuthenticatedActor>("/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      credentials: "include",
    });
  },
  current() {
    return apiRequest<AuthenticatedActor>("/v1/auth/me", { credentials: "include" });
  },
};
