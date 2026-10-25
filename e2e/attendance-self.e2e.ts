import { expect, test, type Page } from "@playwright/test";
import { paceLogin } from "./login-pacing";

async function login(page: Page, username: string, password = "password") {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("UC07 EMPLOYEE submits and corrects own manual attendance in UI, reloads persisted result and cannot forge scope", async ({ page, browser, baseURL }) => {
  test.setTimeout(120000);
  const headers = { origin: new URL(baseURL!).origin };
  const key = `ATT_${Date.now().toString(36).toUpperCase()}`;
  const workDate = "2035-02-01";
  await login(page, "admin");
  const create = async (path: string, data: object) => {
    const response = await page.request.post(`/api/v1${path}`, { headers, data });
    expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
    return (await response.json()).data;
  };
  const shop = await create("/shops", { code: key, name: "UC07 own attendance" });
  const branch = await create("/branches", { shop_id: shop.id, code: "SELF", name: "UC07 dated branch" });
  const department = await create("/departments", { branch_id: branch.id, code: "SELF", name: "UC07 department" });
  const position = await create("/positions", { shop_id: shop.id, code: "SELF", name: "UC07 position" });
  const onboard = await create("/employees/onboard", {
    employee: { employee_code: key, passport_id: key, first_name: "Attendance", last_name: "Self", hire_date: workDate },
    assignment: { branch_id: branch.id, department_id: department.id, position_id: position.id, employment_type: "full_time", base_salary: "30000.00", welfare_amount: "0.00", effective_from: workDate },
    account: { username: key.toLowerCase() },
  });
  await create(`/accounts/${onboard.account_id}/roles`, { role_code: "EMPLOYEE", reason: "UC07 isolated own attendance UAT" });
  await create("/branch-schedules", { branch_id: branch.id, work_start_time: "09:00", standard_close_time: "18:00", late_grace_minutes: 5, effective_from: workDate });
  const context = await browser.newContext({ baseURL });
  try {
    const employee = await context.newPage();
    await login(employee, key.toLowerCase(), onboard.temporary_password);
    const actor = (await (await employee.request.get("/api/v1/auth/me")).json()).data;
    expect(actor.grants.map((g: { role_code: string }) => g.role_code)).toEqual(["EMPLOYEE"]);
    await employee.goto("/attendance");
    await expect(employee.getByRole("heading", { name: "การลงเวลาทำงาน", exact: true })).toBeVisible();
    await expect(employee.getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน")).toHaveCount(0);
    await expect(employee.getByText(key, { exact: true })).toBeVisible();
    await employee.getByLabel("ตั้งแต่", { exact: true }).fill(workDate);
    await employee.getByLabel("ถึง", { exact: true }).fill(workDate);
    const entry = employee.locator("form").filter({ has: employee.getByRole("button", { name: "บันทึกวันทำงาน", exact: true }) });
    await entry.getByLabel("วันที่ทำงาน", { exact: true }).fill(workDate);
    await expect(entry.getByLabel("สาขาตามประวัติการจ้าง", { exact: true })).toHaveValue("UC07 dated branch");
    await expect(entry.locator('select[name="status"] option[value="public_holiday"]')).toHaveCount(0);
    await entry.locator('select[name="status"]').selectOption("absent");
    await expect(entry.getByLabel("นาทีที่มาสาย", { exact: true })).toHaveAttribute("readonly", "");
    await entry.locator('select[name="status"]').selectOption("present");
    await entry.getByLabel("เวลาเข้างาน", { exact: true }).fill(`${workDate}T09:00`);
    await entry.getByLabel("เวลาออกงาน", { exact: true }).fill(`${workDate}T18:00`);
    const submitted = employee.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/work-day-records" && r.request().method() === "POST");
    await entry.getByRole("button", { name: "บันทึกวันทำงาน", exact: true }).click();
    const response = await submitted; expect(response.ok(), await response.text()).toBe(true);
    const record = (await response.json()).data;
    expect(record).toMatchObject({ employee_id: onboard.employee.id, branch_id: branch.id, entry_source: "manual", status: "present" });
    await expect(employee.getByText("บันทึกวันทำงานแล้ว", { exact: true })).toBeVisible();
    const correction = employee.locator("form").filter({ has: employee.getByRole("button", { name: "บันทึกการแก้ไข", exact: true }) });
    await correction.locator('select[name="recordId"]').selectOption(record.id);
    await correction.getByLabel("เวลาเข้างาน (Asia/Bangkok)", { exact: true }).fill(`${workDate}T09:20`);
    await expect(correction.getByLabel("นาทีที่มาสาย", { exact: true })).toHaveValue("15");
    await correction.getByLabel("เหตุผล / หมายเหตุ", { exact: true }).fill("แก้เวลาเข้าจริงเป็นเก้าโมงยี่สิบ");
    const corrected = employee.waitForResponse(r => new URL(r.url()).pathname === `/api/v1/work-day-records/${record.id}` && r.request().method() === "PATCH");
    await correction.getByRole("button", { name: "บันทึกการแก้ไข", exact: true }).click();
    const correctedResponse = await corrected; expect(correctedResponse.ok(), await correctedResponse.text()).toBe(true);
    await employee.reload();
    await employee.getByLabel("ตั้งแต่", { exact: true }).fill(workDate);
    await employee.getByLabel("ถึง", { exact: true }).fill(workDate);
    await employee.getByRole("button", { name: "โหลดรายการ", exact: true }).click();
    await expect(employee.locator("tbody tr")).toContainText("15 นาที");
    const persisted = (await (await employee.request.get(`/api/v1/work-day-records?employee_id=${onboard.employee.id}&start_date=${workDate}&end_date=${workDate}`)).json()).data;
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ id: record.id, status: "late", late_minutes: 15, is_deductible: true, entry_source: "manual", note: "แก้เวลาเข้าจริงเป็นเก้าโมงยี่สิบ" });
    expect((await employee.request.post("/api/v1/work-day-records", { headers, data: { employee_id: "99999999", branch_id: branch.id, work_date: workDate, status: "present", late_minutes: 0, is_deductible: false } })).status()).toBe(403);
    expect((await employee.request.get(`/api/v1/work-day-records/context?employee_id=99999999&work_date=${workDate}`)).status()).toBe(403);
    expect((await employee.request.patch(`/api/v1/work-day-records/${record.id}`, { headers, data: { note: "   " } })).status()).toBe(422);
    await employee.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/uc07-self-attendance-persisted.png`, fullPage: true });
    await employee.setViewportSize({ width: 390, height: 844 });
    await expect(employee.getByRole("heading", { name: "การลงเวลาทำงาน", exact: true })).toBeVisible();
    expect(await employee.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await employee.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/uc07-self-attendance-mobile.png`, fullPage: true });
    console.log(JSON.stringify({ uc: "UC07", employee: onboard.employee.id, account: onboard.account_id, record: record.id, branch: branch.id, status: "late", lateMinutes: 15, manual: true, uiCreateCorrectReload: true }));
  } finally { await context.close(); }
});
