import { test, expect } from "@playwright/test";
import { paceLogin } from "./login-pacing";

test("HR creates an employee account with its initial role and cannot grant owner", async ({ page, browser, baseURL }) => {
  test.setTimeout(90000);
  const suffix = Date.now().toString();
  const username = `initial${suffix}`;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("hr");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto("/employees/new");
  await expect(page.getByLabel("รหัสพนักงาน", { exact: true })).toHaveCount(0);
  await page.getByLabel("วันที่เริ่มงาน", { exact: true }).fill(today);
  await page.getByLabel("ชื่อ", { exact: true }).fill("Test");
  await page.getByLabel("นามสกุล", { exact: true }).fill("InitialRole");
  await page.getByLabel("เลขหนังสือเดินทาง", { exact: true }).fill(`P${suffix}`);
  await page.getByRole("button", { name: /ถัดไป/ }).click();
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption({ label: "DEMO · ร้านตัวอย่าง Haris" });
  await expect(page.getByRole("combobox", { name: "สาขา", exact: true })).toBeEnabled();
  await page.getByRole("combobox", { name: "สาขา", exact: true }).selectOption({ label: "DEMO-BKK · สาขาตัวอย่าง กรุงเทพฯ" });
  await expect(page.getByRole("combobox", { name: "แผนก", exact: true })).toBeEnabled();
  await page.getByRole("combobox", { name: "แผนก", exact: true }).selectOption({ index: 1 });
  await page.getByRole("combobox", { name: "ตำแหน่ง", exact: true }).selectOption({ index: 1 });
  await page.getByLabel("เงินเดือนฐาน", { exact: true }).fill("18000.00");
  await page.getByRole("checkbox", { name: "สร้างบัญชีเข้าใช้งาน" }).check();
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  const role = page.getByRole("combobox", { name: "บทบาทเริ่มต้น", exact: true });
  await expect(role).toHaveValue("EMPLOYEE");
  await expect(role.locator('option[value="OWNER"]')).toHaveCount(0);
  await expect(role.locator('option[value="HR"]')).toHaveCount(1);
  const pending = page.waitForResponse(response => response.url().endsWith("/api/v1/employees/onboard") && response.request().method() === "POST");
  await page.getByRole("button", { name: "สร้างพนักงาน", exact: true }).click();
  const response = await pending;
  expect(response.ok(), await response.text()).toBe(true);
  const body = response.request().postDataJSON();
  const created = (await response.json()).data;
  expect(created.employee.employee_code).toBe(created.employee.id);
  const detail = await page.request.get(`/api/v1/accounts/${created.account_id}`);
  expect((await detail.json()).data.grants).toEqual([expect.objectContaining({ role_code: "EMPLOYEE", scope: "self" })]);
  const rejected = await page.request.post("/api/v1/employees/onboard", { headers: { origin: new URL(baseURL!).origin }, data: { ...body, employee: { ...body.employee, employee_code: `D${suffix}`, passport_id: `D${suffix}` }, account: { username: `denied${suffix}`, role_code: "OWNER" } } });
  expect(rejected.status()).toBe(403);
  const denied = await page.request.get(`/api/v1/employees?search=D${suffix}`);
  expect((await denied.json()).data).toHaveLength(0);
  for (const roleCode of ["SUPERVISOR", "BRANCH_MANAGER", "HR"] as const) {
    const variant = `${roleCode}${suffix}`;
    const added = await page.request.post("/api/v1/employees/onboard", { headers: { origin: new URL(baseURL!).origin }, data: { ...body, employee: { ...body.employee, employee_code: variant, passport_id: variant }, account: { username: variant.toLowerCase(), role_code: roleCode } } });
    expect(added.ok(), await added.text()).toBe(true);
    const accountId = (await added.json()).data.account_id;
    const grants = (await (await page.request.get(`/api/v1/accounts/${accountId}`)).json()).data.grants;
    expect(grants).toEqual([expect.objectContaining({ role_code: roleCode,
      branch_id: roleCode === "HR" ? null : body.assignment.branch_id,
      department_id: roleCode === "SUPERVISOR" ? body.assignment.department_id : null,
    })]);
  }
  const context = await browser.newContext();
  const employee = await context.newPage();
  await employee.goto(`${baseURL}/login`);
  await employee.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await employee.getByLabel("รหัสผ่าน", { exact: true }).fill(created.temporary_password);
  await paceLogin();
  await employee.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(employee.getByRole("link", { name: "การตั้งค่า", exact: true })).toBeVisible();
  await employee.getByRole("link", { name: "การตั้งค่า", exact: true }).click();
  await expect(employee.getByLabel("รหัสผ่านปัจจุบัน", { exact: true })).toBeVisible();
  await context.close();
});
