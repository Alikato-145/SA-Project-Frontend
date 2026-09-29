import { expect, test } from "bun:test";
import { auditApi } from "./audit-api";

test("audit list preserves filters and nested pagination", async () => {
  let requestUrl = "";
  const fetcher = ((url: string | URL | Request) => {
    requestUrl = String(url);
    return Promise.resolve(new Response(JSON.stringify({
      data: [{ id: "1", action: "employee.update.succeeded" }],
      meta: { pagination: { page: 2, page_size: 20, total: 21, total_pages: 2 } },
      request_id: "audit-1",
    }), { status: 200 }));
  }) as typeof fetch;

  await expect(auditApi.list({
    page: 2,
    action: "employee.update.succeeded",
    actor_account_id: "8",
  }, { fetcher })).resolves.toMatchObject({
    page: 2,
    page_size: 20,
    total: 21,
    request_id: "audit-1",
  });
  expect(requestUrl).toContain("/api/v1/audit-logs/?");
  expect(requestUrl).toContain("action=employee.update.succeeded");
  expect(requestUrl).toContain("actor_account_id=8");
});
