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
    const controller = new AbortController();
    await authApi.current(controller.signal);
    expect(init?.credentials).toBe("include");
    expect(init?.signal).toBe(controller.signal);
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

test("change password sends only the current and replacement passwords", async () => {
  const originalFetch = globalThis.fetch;
  let url = "";
  let init: RequestInit | undefined;
  globalThis.fetch = ((input: string | URL | Request, request?: RequestInit) => {
    url = String(input);
    init = request;
    return Promise.resolve(new Response(JSON.stringify({ ok: true, data: { password_changed: true } }), { status: 200 }));
  }) as typeof fetch;
  try {
    await authApi.changePassword({
      current_password: "temporary-password",
      new_password: "replacement-password",
    });
    expect(url).toBe("/api/v1/auth/change-password");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
    expect(init?.body).toBe(JSON.stringify({
      current_password: "temporary-password",
      new_password: "replacement-password",
    }));
  } finally { globalThis.fetch = originalFetch; }
});
