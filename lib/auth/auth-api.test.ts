import { expect, test } from "bun:test";
import {
  authApi,
  employeeContextFor,
  type AuthenticatedActor,
} from "./auth-api";

const actorFor = (
  roles: string[],
  employee: AuthenticatedActor["account"]["employee"],
): AuthenticatedActor => ({
  account: {
    id: "1",
    username: "tester",
    status: "active",
    employee,
  },
  grants: roles.map((role_code, index) => ({
    id: String(index + 1),
    role_code,
    scope: "all",
    branch_id: null,
    department_id: null,
  })),
  capabilities: [],
});

test("employee context separates self service, management and missing links", () => {
  const employee = {
    id: "41",
    employee_code: "EMP-041",
    display_name: "มะลิ ใจดี",
  };

  expect(employeeContextFor(actorFor(["EMPLOYEE"], employee))).toEqual({
    mode: "self",
    employee,
  });
  expect(
    employeeContextFor(actorFor(["EMPLOYEE", "SUPERVISOR"], employee)),
  ).toEqual({ mode: "management" });
  expect(employeeContextFor(actorFor(["EMPLOYEE"], null))).toEqual({
    mode: "missing",
  });
});

test("current actor request includes the browser session", async () => {
  const originalFetch = globalThis.fetch;
  let init: RequestInit | undefined;
  globalThis.fetch = ((_: string | URL | Request, request?: RequestInit) => {
    init = request;
    return Promise.resolve(new Response(JSON.stringify({ ok: true, data: { account: {}, grants: [], capabilities: [] } }), { status: 200 }));
  }) as typeof fetch;
  try {
    await authApi.current();
    expect(init?.credentials).toBe("include");
  } finally { globalThis.fetch = originalFetch; }
});

test("logout uses the browser session and JSON request contract", async () => {
  const originalFetch = globalThis.fetch;
  let init: RequestInit | undefined;
  globalThis.fetch = ((_: string | URL | Request, request?: RequestInit) => {
    init = request;
    return Promise.resolve(new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }));
  }) as typeof fetch;
  try {
    await authApi.logout();
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
  } finally { globalThis.fetch = originalFetch; }
});
