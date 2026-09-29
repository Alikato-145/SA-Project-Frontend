import { describe, expect, test } from "bun:test";
import { canAccessDashboardPath, routePolicyFor } from "./route-access";

describe("dashboard route access policy", () => {
  test("declares every current dashboard route family and fails closed", () => {
    expect(routePolicyFor("/dashboard").state).toBe("shared");
    expect(routePolicyFor("/dashboard/forbidden").state).toBe("shared");
    expect(routePolicyFor("/payroll").roles).toEqual([
      "OWNER",
      "HR",
      "BRANCH_MANAGER",
    ]);
    expect(routePolicyFor("/settings").roles).toEqual(["OWNER"]);
    expect(routePolicyFor("/accounts/42").roles).toEqual(["OWNER", "HR"]);
    expect(routePolicyFor("/organization").roles).toEqual(["OWNER", "HR"]);
    expect(routePolicyFor("/audit").roles).toEqual(["OWNER", "HR"]);

    expect(routePolicyFor("/attendance").roles).toEqual(["OWNER", "HR", "BRANCH_MANAGER", "SUPERVISOR"]);
    expect(routePolicyFor("/finance").roles).toEqual(["OWNER", "HR"]);
    for (const pathname of ["/attendance", "/leave", "/overtime", "/finance"])
      expect(routePolicyFor(pathname).state).toBe("released");
    expect(routePolicyFor("/unlisted")).toEqual({
      known: false,
      roles: [],
      state: "unavailable",
    });
  });

  test("permits any matching grant without widening unavailable or unknown paths", () => {
    expect(canAccessDashboardPath("/payroll", ["BRANCH_MANAGER"])).toBe(true);
    expect(canAccessDashboardPath("/payroll", ["SUPERVISOR", "HR"])).toBe(true);
    expect(canAccessDashboardPath("/payroll", ["SUPERVISOR"])).toBe(false);
    expect(canAccessDashboardPath("/settings", ["HR"])).toBe(false);
    expect(canAccessDashboardPath("/employees/7", ["OWNER"])).toBe(true);
    expect(canAccessDashboardPath("/employees/7", ["EMPLOYEE"])).toBe(true);
    expect(canAccessDashboardPath("/employees/new", ["EMPLOYEE"])).toBe(false);
    expect(canAccessDashboardPath("/payslips", ["EMPLOYEE"])).toBe(true);
    expect(canAccessDashboardPath("/payslips", ["HR"])).toBe(true);
    expect(canAccessDashboardPath("/payslips", ["OWNER"])).toBe(true);
    expect(canAccessDashboardPath("/reports", ["EMPLOYEE"])).toBe(false);
    expect(canAccessDashboardPath("/audit", ["HR"])).toBe(true);
    expect(canAccessDashboardPath("/audit", ["BRANCH_MANAGER"])).toBe(false);
    expect(canAccessDashboardPath("/leave", ["EMPLOYEE"])).toBe(true);
    expect(canAccessDashboardPath("/finance", ["EMPLOYEE"])).toBe(false);
    expect(canAccessDashboardPath("/attendance", ["EMPLOYEE"])).toBe(false);
    expect(canAccessDashboardPath("/unlisted", ["OWNER"])).toBe(false);
  });
});
