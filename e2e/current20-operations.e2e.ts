import { expect, test, type Page } from "@playwright/test";
import { paceLogin } from "./login-pacing";

async function login(page: Page, username: string, password = "password") {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await paceLogin(); await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
async function picker(page: Page, code: string) {
  const field = page.locator("form.workspace-filter").getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน", { exact: true });
  await field.fill(code);
  const list = await field.getAttribute("list");
  const option = page.locator(`datalist[id="${list}"] option`).first();
  await expect(option).toHaveAttribute("value", new RegExp(code));
  await field.fill((await option.getAttribute("value"))!);
}

for (const role of ["SUPERVISOR", "BRANCH_MANAGER", "HR", "OWNER"]) test(`UC07/09/10/11 ${role} records scoped attendance and decides employee UI requests with immutable history`, async ({ page, browser, baseURL }) => {
  test.setTimeout(180000);
  await login(page, "admin");
  const headers = { origin: new URL(baseURL!).origin };
  const key = `OP${role.slice(0, 2)}${Date.now().toString(36).toUpperCase()}`;
  const create = async (path: string, data: unknown) => {
    const response = await page.request.post(`/api/v1${path}`, { headers, data });
    expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
    return (await response.json()).data;
  };
  const shop = await create("/shops", { code: key, name: key });
  const branch = await create("/branches", { shop_id: shop.id, code: key, name: key });
  const department = await create("/departments", { branch_id: branch.id, code: key, name: key });
  const position = await create("/positions", { shop_id: shop.id, code: key, name: key });
  const onboard = await create("/employees/onboard", {
    employee: { employee_code: key, passport_id: key, first_name: "Operations", last_name: "Actor", hire_date: "2026-09-01" },
    assignment: { branch_id: branch.id, department_id: department.id, position_id: position.id, employment_type: "full_time", base_salary: "26000.00", welfare_amount: "0.00", effective_from: "2026-09-01" },
    account: { username: key.toLowerCase() },
  });
  const staff = await create("/accounts/", { username: `s_${key.toLowerCase()}` });
  await create(`/accounts/${staff.account.id}/roles`, { role_code: role, branch_id: ["SUPERVISOR", "BRANCH_MANAGER"].includes(role) ? branch.id : null, department_id: role === "SUPERVISOR" ? department.id : null, reason: "Single-role current20 fixture" });
  const type = await create("/leave-types", { code: key, name_th: key, quota_type: "none", quota_days: null, is_deductible: false, requires_document: false, allow_exceed: false, is_active: true });
  const employeeContext = await browser.newContext({ baseURL });
  const staffContext = await browser.newContext({ baseURL });
  try {
    const employee = await employeeContext.newPage();
    const manager = await staffContext.newPage();
    await login(employee, key.toLowerCase(), onboard.temporary_password);
    await login(manager, `s_${key.toLowerCase()}`, staff.temporary_password);
    const actor = (await (await manager.request.get("/api/v1/auth/me")).json()).data;
    expect(actor.grants.map((g: { role_code: string }) => g.role_code)).toEqual([role]);
    if (role !== "SUPERVISOR") {
      await manager.goto("/schedules");
      await manager.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
      await manager.getByRole("combobox", { name: "สาขา", exact: true }).selectOption(branch.id);
      await manager.getByRole("button", { name: "โหลดตารางและวันหยุด", exact: true }).click();
      await manager.getByLabel("เวลาเริ่มงาน", { exact: true }).fill("09:00");
      await manager.getByLabel("เวลาเลิกงาน", { exact: true }).fill("18:00");
      await manager.getByLabel("อนุโลมมาสาย (นาที)", { exact: true }).fill("5");
      await manager.getByLabel("เริ่มใช้วันที่", { exact: true }).fill("2037-01-01");
      await manager.getByRole("button", { name: "บันทึกตารางเวลา", exact: true }).click();
      await expect(manager.getByRole("listitem").filter({ hasText: /2037-01-01.*09:00/ })).toBeVisible();
    } else await create("/branch-schedules", { branch_id: branch.id, work_start_time: "09:00", standard_close_time: "18:00", late_grace_minutes: 5, effective_from: "2037-01-01" });
    await manager.goto("/attendance"); await picker(manager, key);
    await manager.getByLabel("ตั้งแต่", { exact: true }).fill("2037-01-01");
    await manager.getByLabel("ถึง", { exact: true }).fill("2037-01-01");
    const attendance = manager.locator("form").filter({ has: manager.getByRole("button", { name: "บันทึกวันทำงาน", exact: true }) });
    await attendance.getByLabel("วันที่ทำงาน", { exact: true }).fill("2037-01-01");
    await expect(attendance.getByLabel("สาขาตามประวัติการจ้าง", { exact: true })).toHaveValue(key);
    await attendance.getByLabel("เวลาเข้างาน", { exact: true }).fill("2037-01-01T09:00");
    await attendance.getByLabel("เวลาออกงาน", { exact: true }).fill("2037-01-01T18:00");
    await attendance.getByRole("button", { name: "บันทึกวันทำงาน", exact: true }).click();
    await expect(manager.getByText("บันทึกวันทำงานแล้ว", { exact: true })).toBeVisible();
    await manager.getByRole("combobox", { name: "รายการวันทำงาน", exact: true }).selectOption({ index: 1 });
    await manager.getByLabel("เวลาออกงาน (Asia/Bangkok)", { exact: true }).fill("2037-01-01T18:30");
    await manager.getByLabel("เหตุผล / หมายเหตุ", { exact: true }).fill(`Correction ${key}`);
    await manager.getByRole("button", { name: "บันทึกการแก้ไข", exact: true }).click();
    await expect(manager.getByText("บันทึกการแก้ไขแล้ว", { exact: true })).toBeVisible();
    await manager.reload(); await picker(manager, key);
    await manager.getByLabel("ตั้งแต่", { exact: true }).fill("2037-01-01"); await manager.getByLabel("ถึง", { exact: true }).fill("2037-01-01");
    await manager.getByRole("button", { name: "โหลดรายการ", exact: true }).click();
    const records = (await (await manager.request.get(`/api/v1/work-day-records?employee_id=${onboard.employee.id}&start_date=2037-01-01&end_date=2037-01-01`)).json()).data;
    expect(records).toHaveLength(1); expect(records[0].clock_out_at).toContain("11:30:00");
    await employee.goto("/overtime");
    const form = employee.locator("form").filter({ has: employee.getByRole("heading", { name: "ส่งคำขอ OT ใหม่", exact: true }) });
    await form.getByLabel("วันที่ทำ OT", { exact: true }).fill("2037-01-01");
    await form.getByLabel("จำนวนชั่วโมง", { exact: true }).fill("1.25");
    await form.getByLabel("เหตุผล", { exact: true }).fill(key);
    const submitted = employee.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/overtime-records" && r.request().method() === "POST");
    await form.getByRole("button", { name: "ส่งคำขอ", exact: true }).click();
    const response = await submitted; expect(response.ok(), await response.text()).toBe(true);
    const ot = (await response.json()).data;
    const row = employee.getByRole("article").filter({ hasText: key });
    await row.getByRole("button", { name: "แก้ไขคำขอ", exact: true }).click();
    await row.getByLabel("จำนวนชั่วโมง", { exact: true }).fill("2.50");
    await row.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(employee.getByText("แก้ไขคำขอ OT แล้ว", { exact: true })).toBeVisible();
    await employee.reload(); await employee.getByRole("button", { name: "โหลดคำขอ OT", exact: true }).click();
    await expect(employee.getByRole("article").filter({ hasText: key })).toContainText("2.50 ชั่วโมง");
    expect((await employee.request.post(`/api/v1/overtime-records/${ot.id}/approve`, { headers, data: {} })).status()).toBe(403);
    expect((await employee.request.post("/api/v1/overtime-records", { headers, data: { employee_id: "99999999", overtime_date: "2037-01-01", overtime_type: "hourly", hours: "1" } })).status()).toBe(403);
    await employee.goto("/leave");
    const leaveForm = employee.locator("form").filter({ has: employee.getByRole("button", { name: "ส่งคำขอ", exact: true }) });
    await leaveForm.getByRole("combobox", { name: "ประเภทการลา", exact: true }).selectOption(type.id);
    await leaveForm.getByLabel("วันลาเริ่มต้น", { exact: true }).fill("2037-01-02");
    await leaveForm.getByLabel("วันลาสิ้นสุด", { exact: true }).fill("2037-01-02");
    await leaveForm.getByLabel("เหตุผล", { exact: true }).fill(key);
    const leaveSubmit = employee.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/leave-requests" && r.request().method() === "POST");
    await leaveForm.getByRole("button", { name: "ส่งคำขอ", exact: true }).click();
    const leaveResponse = await leaveSubmit; expect(leaveResponse.ok(), await leaveResponse.text()).toBe(true);
    const leave = (await leaveResponse.json()).data;
    for (const [path, loadButton, id] of [["/leave", "โหลดคำขอ", leave.id], ["/overtime", "โหลดคำขอ OT", ot.id]]) {
      await manager.goto(path); await picker(manager, key);
      await manager.getByRole("button", { name: loadButton, exact: true }).click();
      const request = manager.getByRole("article").filter({ hasText: key });
      await request.getByLabel("หมายเหตุการพิจารณา", { exact: true }).fill(`Approved ${role} ${key}`);
      await request.getByRole("button", { name: "อนุมัติ", exact: true }).click();
      await expect(manager.getByText(path === "/leave" ? "อนุมัติคำขอลาแล้ว" : "อนุมัติ OT แล้ว", { exact: true })).toBeVisible();
      const api = path === "/leave" ? "leave-requests" : "overtime-records";
      const history = (await (await manager.request.get(`/api/v1/${api}/${id}/history`)).json()).data;
      expect(history.at(-1)).toMatchObject({ action: "approved", remark: `Approved ${role} ${key}` });
      const duplicate = await manager.request.post(`/api/v1/${api}/${id}/approve`, { headers, data: {} });
      expect(duplicate.ok()).toBe(false);
      await employee.goto(path); await employee.getByRole("button", { name: loadButton, exact: true }).click();
      const ownRow = employee.getByRole("article").filter({ hasText: key });
      await expect(ownRow).toContainText("อนุมัติแล้ว");
      if (path === "/overtime") {
        await expect(ownRow.getByRole("button", { name: "แก้ไขคำขอ", exact: true })).toHaveCount(0);
        expect((await employee.request.patch(`/api/v1/${api}/${id}`, { headers, data: { overtime_date: "2037-01-01", overtime_type: "hourly", hours: "9", reason: "cannot edit approved" } })).status()).toBe(409);
      }
    }
    await manager.goto("/leave"); await picker(manager, key);
    const delegated = manager.locator("form").filter({ has: manager.getByRole("button", { name: "ส่งคำขอ", exact: true }) });
    await delegated.getByRole("combobox", { name: "ประเภทการลา", exact: true }).selectOption(type.id);
    await delegated.getByLabel("วันลาเริ่มต้น", { exact: true }).fill("2037-01-03");
    await delegated.getByLabel("วันลาสิ้นสุด", { exact: true }).fill("2037-01-03");
    await delegated.getByLabel("เหตุผล", { exact: true }).fill(`Delegated ${key}`);
    const delegatedSubmit = manager.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/leave-requests" && r.request().method() === "POST");
    await delegated.getByRole("button", { name: "ส่งคำขอ", exact: true }).click();
    const delegatedResponse = await delegatedSubmit; expect(delegatedResponse.ok(), await delegatedResponse.text()).toBe(true);
    await manager.reload(); await picker(manager, key);
    await manager.getByRole("button", { name: "โหลดคำขอ", exact: true }).click();
    await expect(manager.getByRole("article").filter({ hasText: `Delegated ${key}` })).toContainText("รอพิจารณา");
    await employee.goto("/overtime");
    const rejectedOtForm = employee.locator("form").filter({ has: employee.getByRole("heading", { name: "ส่งคำขอ OT ใหม่", exact: true }) });
    await rejectedOtForm.getByLabel("วันที่ทำ OT", { exact: true }).fill("2037-01-04");
    await rejectedOtForm.getByLabel("จำนวนชั่วโมง", { exact: true }).fill("1");
    await rejectedOtForm.getByLabel("เหตุผล", { exact: true }).fill(`Reject ${key}`);
    const rejectSubmit = employee.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/overtime-records" && r.request().method() === "POST");
    await rejectedOtForm.getByRole("button", { name: "ส่งคำขอ", exact: true }).click();
    const rejectResponse = await rejectSubmit; expect(rejectResponse.ok(), await rejectResponse.text()).toBe(true);
    const rejectOt = (await rejectResponse.json()).data;
    await manager.goto("/overtime"); await picker(manager, key);
    await manager.getByRole("button", { name: "โหลดคำขอ OT", exact: true }).click();
    const rejectedRow = manager.getByRole("article").filter({ hasText: `Reject ${key}` });
    await rejectedRow.getByLabel("หมายเหตุการพิจารณา", { exact: true }).fill(`Rejected ${role}`);
    await rejectedRow.getByRole("button", { name: "ไม่อนุมัติ", exact: true }).click();
    await expect(manager.getByText("ไม่อนุมัติ OT แล้ว", { exact: true })).toBeVisible();
    const rejectHistory = (await (await manager.request.get(`/api/v1/overtime-records/${rejectOt.id}/history`)).json()).data;
    expect(rejectHistory.at(-1)).toMatchObject({ action: "rejected", remark: `Rejected ${role}` });
    await manager.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/current20-operations-${role}.png`, fullPage: true });
  } finally { await employeeContext.close(); await staffContext.close(); }
});
