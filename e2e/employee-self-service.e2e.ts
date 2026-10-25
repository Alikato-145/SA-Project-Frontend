import { test, expect, type Page } from "@playwright/test";
import { paceLogin } from "./login-pacing";

async function login(page: Page, username: string, password = "password") {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("EMPLOYEE submits own leave and eligible advance, reloads and sees HR decision; forged persons denied", async ({ page, browser, baseURL }) => {
  test.setTimeout(150000);
  const origin = new URL(baseURL!).origin;
  const headers = { origin };
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const start = `${today.slice(0, 7)}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const key = `SELF_${Date.now().toString(36).toUpperCase()}`;
  await login(page, "admin");
  const create = async (path: string, data: unknown) => {
    const response = await page.request.post(`/api/v1${path}`, { headers, data });
    expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
    return (await response.json()).data;
  };
  const shop = await create("/shops", { code: key, name: "Self-service verification" });
  const branch = await create("/branches", { shop_id: shop.id, code: "SELF", name: "Self branch" });
  const department = await create("/departments", { branch_id: branch.id, code: "SELF", name: "Self department" });
  const position = await create("/positions", { shop_id: shop.id, code: "SELF", name: "Self position" });
  const onboard = await create("/employees/onboard", {
    employee: { employee_code: key, passport_id: key, first_name: "Self", last_name: "Service", hire_date: start },
    assignment: { branch_id: branch.id, department_id: department.id, position_id: position.id, employment_type: "full_time", base_salary: "30000.00", welfare_amount: "0.00", effective_from: start },
    account: { username: key.toLowerCase() },
  });
  await create(`/accounts/${onboard.account_id}/roles`, { role_code: "EMPLOYEE", reason: "Synthetic own-only UAT" });
  await create("/branch-schedules", { branch_id: branch.id, work_start_time: "09:00", standard_close_time: "18:00", late_grace_minutes: 0, effective_from: start });
  for (const [config_key, numeric_value, unit] of [["STANDARD_WORK_DAYS", "30", "days"], ["ABSENCE_RATE", "1", "multiplier"], ["LATE_RATE", "0", "currency_per_minute"], ["SOCIAL_SECURITY_RATE", "0", "ratio"], ["SOCIAL_SECURITY_CAP", "750", "currency"]]) {
    await create("/payroll/configurations", { shop_id: shop.id, config_key, numeric_value, unit, effective_from: start });
  }
  await create("/payroll/periods", { shop_id: shop.id, period_year: year, period_month: month, start_date: start, end_date: end });
  for (let date = 1; date <= day; date++) {
    const work_date = `${today.slice(0, 7)}-${String(date).padStart(2, "0")}`;
    await create("/work-day-records", { employee_id: onboard.employee.id, branch_id: branch.id, work_date, status: "present", clock_in_at: `${work_date}T02:00:00Z`, clock_out_at: `${work_date}T11:00:00Z`, late_minutes: 0, is_deductible: false });
  }
  const leaveDate = `${year + 1}-01-02`;
  const leaveType = await create("/leave-types", { code: key, name_th: key, quota_type: "fixed", quota_days: "30", is_deductible: false, requires_document: false, allow_exceed: false, is_active: true });
  expect((await page.request.put("/api/v1/leave-quotas", { headers, data: { employee_id: onboard.employee.id, leave_type_id: leaveType.id, quota_year: year + 1, entitled_days: "30" } })).ok()).toBe(true);
  const context = await browser.newContext({ baseURL });
  try {
    const employee = await context.newPage();
    await login(employee, key.toLowerCase(), onboard.temporary_password);
    const actor = (await (await employee.request.get("/api/v1/auth/me")).json()).data;
    expect(actor.grants.map((grant: { role_code: string }) => grant.role_code)).toEqual(["EMPLOYEE"]);
    expect(actor.account.employee.id).toBe(onboard.employee.id);
    await employee.goto("/leave");
    const leaveForm = employee.locator("form").filter({ has: employee.getByRole("button", { name: "ส่งคำขอ", exact: true }) });
    await leaveForm.getByRole("combobox", { name: "ประเภทการลา", exact: true }).selectOption(leaveType.id);
    await leaveForm.getByLabel("วันลาเริ่มต้น", { exact: true }).fill(leaveDate);
    await leaveForm.getByLabel("วันลาสิ้นสุด", { exact: true }).fill(leaveDate);
    await leaveForm.getByLabel("เหตุผล", { exact: true }).fill(key);
    const submittedLeave = employee.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/leave-requests" && r.request().method() === "POST");
    await leaveForm.getByRole("button", { name: "ส่งคำขอ", exact: true }).click();
    const leaveResponse = await submittedLeave; expect(leaveResponse.ok(), await leaveResponse.text()).toBe(true);
    const leave = (await leaveResponse.json()).data;
    await employee.reload(); await employee.getByRole("button", { name: "โหลดคำขอ", exact: true }).click();
    await expect(employee.getByRole("article").filter({ hasText: key })).toContainText("รอพิจารณา");
    const ownLeaves = (await (await employee.request.get(`/api/v1/leave-requests?employee_id=${onboard.employee.id}`)).json()).data;
    expect(ownLeaves.find((r: { id: string }) => r.id === leave.id)).toMatchObject({ employee_id: onboard.employee.id, status: "pending" });
    await employee.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/employee-leave-persisted.png`, fullPage: true });
    expect((await employee.request.post("/api/v1/leave-requests", { headers, data: { employee_id: "99999999", leave_type_id: leaveType.id, start_date: leaveDate, end_date: leaveDate } })).status()).toBe(403);
    expect((await employee.request.post("/api/v1/advance-requests", { headers, data: { employee_id: "99999999", amount: "100.01" } })).status()).toBe(day >= 20 ? 403 : 422);
    await page.context().clearCookies(); await login(page, "hr"); await page.goto("/leave");
    const leaveFilter = page.locator("form").filter({ has: page.getByRole("button", { name: "โหลดคำขอ", exact: true }) });
    const leavePicker = leaveFilter.getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน", { exact: true });
    await leavePicker.fill(key);
    const leaveOption = leaveFilter.locator("datalist option").first();
    await expect(leaveOption).toHaveAttribute("value", new RegExp(key));
    await leavePicker.fill((await leaveOption.getAttribute("value"))!);
    await page.getByRole("button", { name: "โหลดคำขอ", exact: true }).click();
    const requestedLeave = page.getByRole("article").filter({ hasText: key });
    await requestedLeave.getByLabel("หมายเหตุการพิจารณา", { exact: true }).fill("Approved employee-created request");
    const decidedLeave = page.waitForResponse(r => new URL(r.url()).pathname === `/api/v1/leave-requests/${leave.id}/approve` && r.request().method() === "POST");
    await requestedLeave.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    const leaveApproval = await decidedLeave;
    expect(leaveApproval.ok(), await leaveApproval.text()).toBe(true);
    await employee.reload(); await employee.getByRole("button", { name: "โหลดคำขอ", exact: true }).click();
    await expect(employee.getByRole("article").filter({ hasText: key })).toContainText("อนุมัติแล้ว");
    await employee.getByRole("article").filter({ hasText: key }).getByRole("button", { name: "ดูประวัติการพิจารณา", exact: true }).click();
    await expect(employee.getByRole("article").filter({ hasText: key })).toContainText("Approved employee-created request");
    const approvedLeaves = (await (await employee.request.get(`/api/v1/leave-requests?employee_id=${onboard.employee.id}`)).json()).data;
    expect(approvedLeaves.find((r: { id: string }) => r.id === leave.id)).toMatchObject({ employee_id: onboard.employee.id, status: "approved", final_leave_type_id: leaveType.id });
    const leaveHistory = (await (await employee.request.get(`/api/v1/leave-requests/${leave.id}/history`)).json()).data;
    expect(leaveHistory.at(-1)).toMatchObject({ action: "approved", remark: "Approved employee-created request" });
    await employee.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/employee-same-leave-approved.png`, fullPage: true });
    await employee.goto("/finance");
    const advanceForm = employee.locator("form").filter({ has: employee.getByRole("button", { name: "ส่งคำขอเงินทดรองจ่าย", exact: true }) });
    await advanceForm.getByLabel("จำนวนเงิน", { exact: true }).fill("100.01");
    const submittedAdvance = employee.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/advance-requests" && r.request().method() === "POST");
    await advanceForm.getByRole("button", { name: "ส่งคำขอเงินทดรองจ่าย", exact: true }).click();
    const advanceResponse = await submittedAdvance;
    if (day < 20) {
      expect(advanceResponse.status()).toBe(422);
      expect((await advanceResponse.json()).error.code).toBe("ADVANCE_INELIGIBLE_DATE");
      console.log(JSON.stringify({ businessDate: today, positiveAdvance: false, reason: "Legitimate before-20 eligibility denial" }));
      return;
    }
    expect(advanceResponse.ok(), await advanceResponse.text()).toBe(true);
    const advance = (await advanceResponse.json()).data;
    await employee.reload(); await employee.getByRole("button", { name: "โหลดข้อมูลการเงิน", exact: true }).click();
    const ownAdvances = (await (await employee.request.get(`/api/v1/advance-requests?employee_id=${onboard.employee.id}`)).json()).data;
    expect(ownAdvances.find((r: { id: string }) => r.id === advance.id)).toMatchObject({ employee_id: onboard.employee.id, amount: "100.01", status: "pending" });
    await expect(employee.getByRole("button", { name: "อนุมัติ", exact: true })).toHaveCount(0);
    expect((await employee.request.post(`/api/v1/advance-requests/${advance.id}/approve`, { headers, data: {} })).status()).toBe(403);
    await page.context().clearCookies(); await login(page, "hr"); await page.goto("/finance");
    const picker = page.getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน", { exact: true });
    await picker.fill(key); const option = page.locator("datalist option").first(); await expect(option).toHaveAttribute("value", new RegExp(key)); await picker.fill((await option.getAttribute("value"))!);
    await page.getByRole("button", { name: "โหลดข้อมูลการเงิน", exact: true }).click();
    const approved = page.waitForResponse(r => new URL(r.url()).pathname === `/api/v1/advance-requests/${advance.id}/approve`);
    await page.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    const approval = await approved; expect(approval.ok(), await approval.text()).toBe(true);
    await employee.reload(); await employee.getByRole("button", { name: "โหลดข้อมูลการเงิน", exact: true }).click();
    await expect(employee.getByRole("article").filter({ hasText: "100.01" })).toContainText("อนุมัติแล้ว");
    const final = (await (await employee.request.get(`/api/v1/advance-requests?employee_id=${onboard.employee.id}`)).json()).data;
    expect(final.find((r: { id: string }) => r.id === advance.id)).toMatchObject({ status: "approved", amount: "100.01" });
    await employee.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/employee-advance-approved.png`, fullPage: true });
    console.log(JSON.stringify({ businessDate: today, workedDays: day, base: "30000.00", advance: advance.id, amount: "100.01", employee: onboard.employee.id, leave: leave.id, positiveAdvance: true }));
  } finally { await context.close(); }
});
