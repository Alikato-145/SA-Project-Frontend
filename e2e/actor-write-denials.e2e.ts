import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { paceLogin } from "./login-pacing";
const file = process.env.UAT_SCOPE_FIXTURE_FILE;
if (!file) throw new Error("Run sh scripts/full-uat.sh so fresh scope fixtures are explicit");
const scope = JSON.parse(readFileSync(file, "utf8")) as { employee_id: string; branch_id: string; department_id: string; position_id: string; manager_account_id: string };
async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin(); await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
test("manager direct other-branch create/edit/terminate and bank/account escalation are denied", async ({ page, baseURL }) => {
  await login(page, "branch_manager");
  const headers = { origin: new URL(baseURL!).origin };
  const code = `DENY-${Date.now().toString(36)}`;
  const create = await page.request.post("/api/v1/employees/onboard", { headers, data: {
    employee: { employee_code: code, passport_id: code, first_name: "Denied", last_name: "Branch", hire_date: "2026-10-25" },
    assignment: { branch_id: scope.branch_id, department_id: scope.department_id, position_id: scope.position_id, employment_type: "full_time", base_salary: "18000.00", welfare_amount: "0.00", effective_from: "2026-10-25" },
  } });
  expect(create.status()).toBe(403);
  expect((await page.request.patch(`/api/v1/employees/${scope.employee_id}`, { headers, data: { phone: "0812345678" } })).status()).toBe(403);
  expect((await page.request.patch(`/api/v1/employees/${scope.employee_id}/status`, { headers, data: { status: "terminated", terminated_at: "2026-10-25", reason: "Denied other branch" } })).status()).toBe(403);
  expect((await page.request.get(`/api/v1/employees/${scope.employee_id}`)).status()).toBe(404);
  expect((await page.request.post(`/api/v1/accounts/${scope.manager_account_id}/roles`, { headers, data: { role_code: "OWNER", reason: "Denied escalation" } })).status()).toBe(403);
  const own = (await (await page.request.get("/api/v1/employees?search=DEMO-EMPLOYEE")).json()).data[0];
  expect((await page.request.post(`/api/v1/employees/${own.id}/bank-accounts`, { headers, data: { bank_code: "DEMO", bank_name: "Synthetic", account_holder_name: "Denied", account_number: "0000000000", is_primary: false } })).status()).toBe(403);
  expect((await (await page.request.get("/api/v1/auth/me")).json()).data.grants.map((g: { role_code: string }) => g.role_code)).toEqual(["BRANCH_MANAGER"]);
});
for (const username of ["employee", "supervisor", "branch_manager"]) test(`${username} cannot create or lock payroll through direct endpoints`, async ({ page, baseURL }) => {
  await login(page, username);
  const headers = { origin: new URL(baseURL!).origin };
  const f = JSON.parse(readFileSync(process.env.PAYMENT_FIXTURE_FILE!, "utf8")) as { shopId: string; periodId: string };
  expect((await page.request.post("/api/v1/payroll/periods", { headers, data: { shop_id: f.shopId, period_year: 2095, period_month: 11, start_date: "2095-11-01", end_date: "2095-11-30" } })).status()).toBe(403);
  expect((await page.request.post(`/api/v1/payroll/periods/${f.periodId}/lock`, { headers, data: {} })).status()).toBe(403);
});
