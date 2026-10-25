import { paceLogin } from "./login-pacing";
import { test, expect } from "@playwright/test";
let employees: Record<string, string>;
test.beforeAll(async ({ request, baseURL }) => {
  await paceLogin();
  const login = await request.post("/api/v1/auth/login", { headers: { origin: new URL(baseURL!).origin }, data: { username: "admin", password: "password" } });
  expect(login.status()).toBe(200);
  employees = {};
  for (const code of ["DEMO-EMPLOYEE", "RELEASE-1", "RELEASE-2"]) {
    const response = await request.get(`/api/v1/employees?search=${code}&page_size=100`);
    expect(response.status()).toBe(200);
    const data = (await response.json()).data;
    const records = Array.isArray(data) ? data : data.items;
    const employee = records.find((row: { employee_code: string }) => row.employee_code === code);
    expect(employee, code).toBeDefined(); employees[code] = employee.id;
  }
});
for (const [username, allowed] of [
  ["employee", [true, false, false]], ["supervisor", [true, false, false]],
  ["branch_manager", [true, true, false]], ["hr", [true, true, true]], ["admin", [true, true, true]],
] as const) test(`${username} enforces own, department, branch or all scope across employee operations`, async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin(); await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  for (const [index, code] of ["DEMO-EMPLOYEE", "RELEASE-1", "RELEASE-2"].entries()) {
    const id = employees[code];
    for (const path of [`/employees/${id}`, `/leave-requests?employee_id=${id}`, `/overtime-records?employee_id=${id}`, `/work-day-records?employee_id=${id}&start_date=2026-09-01&end_date=2026-09-30`]) {
      const response = await page.request.get(`/api/v1${path}`);
      // Employee detail hides the existence of records outside the caller's scope.
      const deniedStatus = path === `/employees/${id}` ? 404 : 403;
      expect(response.status(), `${username} ${code} ${path}`).toBe(allowed[index] ? 200 : deniedStatus);
      const body = await response.text();
      expect(body).not.toContain("password_hash"); expect(body).not.toContain("account_number_ciphertext");
    }
    const bank = await page.request.get(`/api/v1/employees/${id}/bank-accounts`);
    const bankAllowed = ["admin", "hr"].includes(username) || (username === "employee" && index === 0);
    expect(bank.status(), `${username} bank ${code}`).toBe(bankAllowed ? 200 : 403);
  }
});
