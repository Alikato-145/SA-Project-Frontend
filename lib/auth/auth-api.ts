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

export type EmployeeContext =
  | { mode: "management" }
  | {
      mode: "self";
      employee: NonNullable<AuthenticatedAccount["employee"]>;
    }
  | { mode: "missing" };

const employeeManagementRoles = new Set([
  "SUPERVISOR",
  "BRANCH_MANAGER",
  "HR",
  "OWNER",
]);

export const employeeContextFor = (
  actor: AuthenticatedActor,
): EmployeeContext => {
  if (
    actor.grants.some((grant) =>
      employeeManagementRoles.has(grant.role_code),
    )
  )
    return { mode: "management" };

  return actor.account.employee
    ? { mode: "self", employee: actor.account.employee }
    : { mode: "missing" };
};

export const authApi = {
  login(input: { username: string; password: string }) {
    return apiRequest<AuthenticatedActor>("/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      credentials: "include",
    });
  },
  current(signal?: AbortSignal) {
    return apiRequest<AuthenticatedActor>("/v1/auth/me", { credentials: "include", signal });
  },
  logout() {
    return apiRequest<unknown>("/v1/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
    });
  },
  changePassword(input: { current_password: string; new_password: string }) {
    return apiRequest<{ password_changed: true }>("/v1/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      credentials: "include",
    });
  },
};
