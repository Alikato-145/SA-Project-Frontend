import { describe, expect, test } from "bun:test";
import {
  canAccessDashboardPath,
  postLoginPathFor,
  routePolicyFor,
} from "./route-access";

describe("dashboard route access policy", () => {
  test("declares every current dashboard route family and fails closed", () => {
    expect(routePolicyFor("/dashboard").state).toBe("shared");
    expect(routePolicyFor("/dashboard/forbidden").state).toBe("shared");
    expect(routePolicyFor("/payroll").roles).toEqual([
      "OWNER",
      "HR",
      "BRANCH_MANAGER",
    ]);
    expect(routePolicyFor("/settings").roles).toEqual([
      "EMPLOYEE",
      "SUPERVISOR",
      "BRANCH_MANAGER",
      "HR",
      "OWNER",
    ]);
    expect(routePolicyFor("/accounts/42").roles).toEqual(["OWNER", "HR"]);
    expect(routePolicyFor("/organization").roles).toEqual(["OWNER", "HR"]);
    expect(routePolicyFor("/audit").roles).toEqual(["OWNER", "HR"]);

    expect(routePolicyFor("/attendance").roles).toEqual(["EMPLOYEE", "SUPERVISOR", "BRANCH_MANAGER", "HR", "OWNER"]);
    expect(routePolicyFor("/finance").roles).toEqual(["OWNER", "HR", "EMPLOYEE"]);
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
    expect(canAccessDashboardPath("/settings", ["HR"])).toBe(true);
    expect(canAccessDashboardPath("/employees/7", ["OWNER"])).toBe(true);
    expect(canAccessDashboardPath("/employees/7", ["EMPLOYEE"])).toBe(true);
    expect(canAccessDashboardPath("/employees/new", ["EMPLOYEE"])).toBe(false);
    expect(canAccessDashboardPath("/employees/new", ["BRANCH_MANAGER"])).toBe(true);
    expect(canAccessDashboardPath("/payslips", ["EMPLOYEE"])).toBe(true);
    expect(canAccessDashboardPath("/payslips", ["HR"])).toBe(true);
    expect(canAccessDashboardPath("/payslips", ["OWNER"])).toBe(true);
    expect(canAccessDashboardPath("/reports", ["EMPLOYEE"])).toBe(false);
    expect(canAccessDashboardPath("/audit", ["HR"])).toBe(true);
    expect(canAccessDashboardPath("/audit", ["BRANCH_MANAGER"])).toBe(false);
    expect(canAccessDashboardPath("/leave", ["EMPLOYEE"])).toBe(true);
    expect(canAccessDashboardPath("/finance", ["EMPLOYEE"])).toBe(true);
    expect(canAccessDashboardPath("/attendance", ["EMPLOYEE"])).toBe(true);
    expect(canAccessDashboardPath("/unlisted", ["OWNER"])).toBe(false);
  });

  test("keeps employee self-service routes while hiding management workspaces", () => {
    for (const pathname of [
      "/employees",
      "/attendance",
      "/leave",
      "/overtime",
      "/payslips",
      "/settings",
      "/finance",
    ])
      expect(canAccessDashboardPath(pathname, ["EMPLOYEE"])).toBe(true);

    for (const pathname of [
      "/accounts",
      "/payroll",
      "/reports",
    ])
      expect(canAccessDashboardPath(pathname, ["EMPLOYEE"])).toBe(false);
  });

  test("allows standalone scoped roles to open their own payslip workspace", () => {
    for (const role of ["SUPERVISOR", "BRANCH_MANAGER"]) {
      expect(canAccessDashboardPath("/payslips", [role])).toBe(true);
      expect(canAccessDashboardPath("/reports", [role])).toBe(false);
      expect(canAccessDashboardPath("/accounts", [role])).toBe(false);
    }
  });

  test("sends each role to a permitted primary workspace after login", () => {
    expect(postLoginPathFor(["EMPLOYEE"])).toBe("/leave");
    expect(postLoginPathFor(["SUPERVISOR"])).toBe("/attendance");
    expect(postLoginPathFor(["BRANCH_MANAGER"])).toBe("/attendance");
    expect(postLoginPathFor(["HR"])).toBe("/payroll");
    expect(postLoginPathFor(["OWNER"])).toBe("/settings");
  });

  test("uses the highest responsibility role and safely falls back", () => {
    expect(postLoginPathFor(["EMPLOYEE", "SUPERVISOR"])).toBe(
      "/attendance",
    );
    expect(postLoginPathFor(["HR", "OWNER"])).toBe("/settings");
    expect(postLoginPathFor([])).toBe("/dashboard");
    expect(postLoginPathFor(["UNKNOWN"])).toBe("/dashboard");
  });
});
