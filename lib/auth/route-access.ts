export type DashboardRole = "EMPLOYEE" | "SUPERVISOR" | "BRANCH_MANAGER" | "HR" | "OWNER";

export type DashboardRoutePolicy = {
  known: boolean;
  roles: readonly DashboardRole[];
  state: "released" | "shared" | "unavailable";
};

const allRoles: readonly DashboardRole[] = ["EMPLOYEE", "SUPERVISOR", "BRANCH_MANAGER", "HR", "OWNER"];
const unknown: DashboardRoutePolicy = { known: false, roles: [], state: "unavailable" };

export const routePolicyFor = (pathname: string): DashboardRoutePolicy => {
  if (pathname === "/dashboard" || pathname === "/dashboard/forbidden") return { known: true, roles: allRoles, state: "shared" };
  if (pathname === "/payroll") return { known: true, roles: ["OWNER", "HR", "BRANCH_MANAGER"], state: "released" };
  if (pathname === "/payslips") return { known: true, roles: ["EMPLOYEE", "OWNER", "HR"], state: "released" };
  if (pathname === "/reports") return { known: true, roles: ["OWNER", "HR"], state: "released" };
  if (pathname === "/settings") return { known: true, roles: ["OWNER"], state: "released" };
  if (pathname === "/accounts" || pathname.startsWith("/accounts/")) return { known: true, roles: ["OWNER", "HR"], state: "released" };
  if (pathname === "/organization") return { known: true, roles: ["OWNER", "HR"], state: "released" };
  if (pathname === "/employees" || pathname.startsWith("/employees/")) return { known: true, roles: ["OWNER", "HR"], state: "released" };
  if (pathname === "/attendance") return { known: true, roles: ["OWNER", "HR", "BRANCH_MANAGER", "SUPERVISOR"], state: "released" };
  if (pathname === "/leave" || pathname === "/overtime") return { known: true, roles: allRoles, state: "released" };
  if (pathname === "/finance") return { known: true, roles: ["OWNER", "HR"], state: "released" };
  return unknown;
};

export const canAccessDashboardPath = (pathname: string, roleCodes: readonly string[]) =>
  roleCodes.some((role) => routePolicyFor(pathname).roles.includes(role as DashboardRole));
