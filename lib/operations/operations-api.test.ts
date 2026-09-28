import { describe, expect, test } from "bun:test";
import { operationsRequest, operationError, operationPermissions } from "./operations-api";
import { ApiClientError } from "../api/client";
import type { AuthenticatedActor } from "../auth/auth-api";

describe("signed-in operations client", () => {
  test("uses shared envelope, session and exact public values", async () => {
    const id = "9007199254740993";
    const data = await operationsRequest<{ id: string; amount: string }>("/advance-requests", {
      method: "POST", body: JSON.stringify({ employee_id: id, amount: "0.01" }),
      fetcher: async (url, init) => {
        expect(url).toBe("/api/v1/advance-requests");
        expect(init?.credentials).toBe("same-origin");
        expect(init?.body).toBe(`{"employee_id":"${id}","amount":"0.01"}`);
        return new Response(JSON.stringify({ data: { id, amount: "0.01" }, request_id: "req-1" }));
      },
    });
    expect(data).toEqual({ id, amount: "0.01" });
  });
  test("shows session, forbidden and business conflict reasons", () => {
    expect(operationError(new ApiClientError("UNAUTHENTICATED", "internal", 401))).toContain("Sign in again");
    expect(operationError(new ApiClientError("FORBIDDEN", "internal", 403))).toContain("permission");
    expect(operationError(new ApiClientError("CONFLICT", "Payroll is locked", 409))).toBe("Payroll is locked");
  });
  test("presentation permissions fail closed and honor any trusted role", () => {
    expect(operationPermissions(null).canFinance).toBe(false);
    const actor = { grants: [{ role_code: "EMPLOYEE" }, { role_code: "BRANCH_MANAGER" }] } as AuthenticatedActor;
    expect(operationPermissions(actor)).toEqual({ canManage: true, canApprove: true, canFinance: false, selfOnly: false });
  });
});
