import { paceLogin } from "./login-pacing";
import { test, expect } from "@playwright/test";

test("mid-month transfer, salary and weekly holiday changes retain dated payroll and all OT rates", async ({ page, baseURL }) => {
  test.setTimeout(90000);
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("admin");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin(); await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  const origin = new URL(baseURL!).origin;
  const create = async (path: string, data: unknown) => {
    const response = await page.request.post(`/api/v1${path}`, { data, headers: { origin } });
    expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
    return (await response.json()).data;
  };
  const suffix = Date.now().toString(36).toUpperCase();
  const shop = await create("/shops", { code: `HISTORY_${suffix}`, name: "Historical payroll check" });
  const a = await create("/branches", { shop_id: shop.id, code: "A", name: "First branch" });
  const b = await create("/branches", { shop_id: shop.id, code: "B", name: "Second branch" });
  const da = await create("/departments", { branch_id: a.id, code: "TEAM", name: "First team" });
  const db = await create("/departments", { branch_id: b.id, code: "TEAM", name: "Second team" });
  const position = await create("/positions", { shop_id: shop.id, code: "STAFF", name: "Staff" });
  const onboard = await create("/employees/onboard", {
    employee: { employee_code: `H_${suffix}`, national_id: null, passport_id: `H${suffix}`, first_name: "History", last_name: "Check", hire_date: "2026-09-01" },
    assignment: { branch_id: a.id, department_id: da.id, position_id: position.id, employment_type: "full_time", base_salary: "2600.00", welfare_amount: "0.00", effective_from: "2026-09-01" },
    weekly_holidays: [{ weekday: 0, effective_from: "2026-09-01" }],
  });
  const employeeId = onboard.employee.id;
  const successor = await create(`/employees/${employeeId}/assignments`, { branch_id: b.id, department_id: db.id, position_id: position.id, employment_type: "full_time", base_salary: "5200.00", welfare_amount: "0.00", effective_from: "2026-09-16" });
  const holidays = await page.request.get(`/api/v1/employees/${employeeId}/weekly-holidays`);
  await create(`/employees/${employeeId}/weekly-holidays/${(await holidays.json()).data[0].id}/end`, { effective_to: "2026-09-15" });
  await create(`/employees/${employeeId}/weekly-holidays`, { weekday: 6, effective_from: "2026-09-16" });
  await create("/holiday-calendars", { shop_id: shop.id, holiday_date: "2026-09-24", name: "Synthetic holiday" });
  for (const branch of [a, b]) await create("/branch-schedules", { branch_id: branch.id, work_start_time: "09:00", standard_close_time: "18:00", late_grace_minutes: 5, effective_from: "2026-09-01" });
  for (const [config_key, numeric_value, unit] of [
    ["STANDARD_WORK_DAYS", "26", "days"], ["ABSENCE_RATE", "1", "multiplier"], ["LATE_RATE", "1", "currency_per_minute"],
    ["SOCIAL_SECURITY_RATE", "0", "ratio"], ["SOCIAL_SECURITY_CAP", "750", "currency"],
    ["OT_HOURLY_RATE", "1.5", "multiplier"], ["OT_REST_DAY_RATE", "2", "multiplier"], ["OT_PUBLIC_HOLIDAY_RATE", "2", "multiplier"],
  ]) await create("/payroll/configurations", { shop_id: shop.id, branch_id: null, config_key, numeric_value, unit, effective_from: "2026-09-01" });
  for (let day = 1; day <= 30; day++) {
    const date = `2026-09-${String(day).padStart(2, "0")}`;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if ((day < 16 ? weekday === 0 : weekday === 6) || day === 24) continue;
    await create("/work-day-records", { employee_id: employeeId, branch_id: day < 16 ? a.id : b.id, work_date: date, status: "present", clock_in_at: `${date}T02:00:00Z`, clock_out_at: `${date}T11:00:00Z`, late_minutes: 0, is_deductible: false });
  }
  for (const [overtime_type, overtime_date, hours, day_units] of [["hourly", "2026-09-16", "2.00", null], ["rest_day", "2026-09-19", null, "1.00"], ["public_holiday", "2026-09-24", null, "1.00"]]) {
    const ot = await create("/overtime-records", { employee_id: employeeId, overtime_type, overtime_date, ...(hours ? { hours } : { day_units }), reason: "Historical rate check" });
    await create(`/overtime-records/${ot.id}/approve`, { remark: "Synthetic approval" });
  }
  await create("/work-day-records", { employee_id: employeeId, branch_id: a.id, work_date: "2026-09-06", status: "weekly_holiday", late_minutes: 0, is_deductible: false });
  await create("/work-day-records", { employee_id: employeeId, branch_id: b.id, work_date: "2026-09-24", status: "public_holiday", late_minutes: 0, is_deductible: false });
  const period = await create("/payroll/periods", { shop_id: shop.id, period_year: 2026, period_month: 9, start_date: "2026-09-01", end_date: "2026-09-30" });
  const preview = await create(`/payroll/periods/${period.id}/preview`, {});
  expect(preview.blockers).toEqual([]);
  expect(preview.records[0]).toMatchObject({ net_pay: "4575.00", total_earnings: "4575.00", total_deductions: "0.00" });
  const items = preview.records[0].items as { item_type: string; amount: string; rate: string; occurred_on: string }[];
  expect(items.filter(item => item.item_type === "base_salary" && item.rate === "100.00")).toHaveLength(13);
  expect(items.filter(item => item.item_type === "base_salary" && item.rate === "200.00")).toHaveLength(12);
  for (const [type, amount] of [["overtime_hourly", "75.00"], ["overtime_rest_day", "400.00"], ["overtime_public_holiday", "400.00"]]) {
    expect(items.find(item => item.item_type === type)?.amount).toBe(amount);
  }
  await create(`/payroll/periods/${period.id}/lock`, {});
  const history = await page.request.get(`/api/v1/employees/${employeeId}/assignments`);
  const assignments = (await history.json()).data;
  expect(assignments.find((row: { branch_id: string }) => row.branch_id === a.id)).toMatchObject({ base_salary: "2600.00", effective_to: "2026-09-15" });
  expect(assignments.find((row: { id: string }) => row.id === successor.created.id)).toMatchObject({ base_salary: "5200.00", effective_from: "2026-09-16" });
  for (const [branch, count] of [[a, 13], [b, 12]] as const) {
    const report = await page.request.get(`/api/v1/reports/summary?period_id=${period.id}&branch_id=${branch.id}`);
    expect(report.status()).toBe(200);
    expect((await report.json()).data.attendance.find((row: { status: string }) => row.status === "present").count).toBe(count);
  }
  await page.goto(`/employees/${employeeId}/bank`);
  const addBank = async (code: string, number: string, primary: string) => {
    const form = page.locator("form").filter({ has: page.getByRole("heading", { name: "เพิ่มบัญชีธนาคาร", exact: true }) });
    await form.getByLabel("รหัสธนาคาร", { exact: true }).fill(code);
    await form.getByLabel("ชื่อธนาคาร", { exact: true }).fill(code);
    await form.getByLabel("ชื่อบัญชี", { exact: true }).fill("History Check");
    await form.getByLabel("เลขบัญชีเต็ม", { exact: true }).fill(number);
    await form.getByRole("combobox", { name: "ตั้งเป็นบัญชีหลัก", exact: true }).selectOption(primary);
    const saved = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/employees/${employeeId}/bank-accounts` && response.request().method() === "POST");
    await form.getByRole("button", { name: "เพิ่มบัญชี", exact: true }).click();
    const response = await saved; expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()).data;
  };
  const firstBank = await addBank("FIRST", "0000001234", "true");
  const secondBank = await addBank("SECOND", "0000005678", "false");
  const bankList = async () => {
    const response = await page.request.get(`/api/v1/employees/${employeeId}/bank-accounts`);
    const text = await response.text();
    expect(text).not.toContain("0000001234"); expect(text).not.toContain("0000005678");
    return JSON.parse(text).data as { id: string; is_primary: boolean; is_active: boolean; account_holder_name: string }[];
  };
  expect((await bankList()).filter(bank => bank.is_primary)).toHaveLength(1);
  await page.getByRole("combobox", { name: "เลือกบัญชีที่จะแก้", exact: true }).selectOption(secondBank.id);
  await page.getByLabel("ชื่อบัญชีใหม่", { exact: true }).fill("Updated holder");
  await page.getByRole("button", { name: "บันทึกการแก้ไข", exact: true }).click();
  await expect(page.getByText("แก้ข้อมูลบัญชีธนาคารแล้ว", { exact: true })).toBeVisible();
  expect((await bankList()).find(bank => bank.id === secondBank.id)?.account_holder_name).toBe("Updated holder");
  await page.getByRole("button", { name: "ตั้งเป็นบัญชีหลัก", exact: true }).click();
  await expect(page.getByText("ตั้งบัญชีหลักแล้ว", { exact: true })).toBeVisible();
  expect((await bankList()).filter(bank => bank.is_primary).map(bank => bank.id)).toEqual([secondBank.id]);
  await page.getByRole("combobox", { name: "บัญชีที่จะปิด", exact: true }).selectOption(secondBank.id);
  page.once("dialog", async dialog => { expect(dialog.message()).toContain("ไม่มีบัญชีทดแทน"); await dialog.dismiss(); });
  await page.getByRole("button", { name: "ยืนยันปิดใช้งาน", exact: true }).click();
  expect((await bankList()).find(bank => bank.id === secondBank.id)).toMatchObject({ is_active: true, is_primary: true });
  await page.getByRole("combobox", { name: "บัญชีหลักทดแทน", exact: true }).selectOption(firstBank.id);
  await page.getByRole("button", { name: "ยืนยันปิดใช้งาน", exact: true }).click();
  await expect(page.getByText("ปิดใช้งานบัญชีแล้ว โดยเก็บรายการเดิมไว้ตรวจสอบย้อนหลัง", { exact: true })).toBeVisible();
  const finalBanks = await bankList();
  expect(finalBanks.find(bank => bank.id === secondBank.id)).toMatchObject({ is_active: false, is_primary: false });
  expect(finalBanks.filter(bank => bank.is_primary).map(bank => bank.id)).toEqual([firstBank.id]);
  await page.goto("/audit");
  await page.getByLabel("ตารางข้อมูล", { exact: true }).fill("employee_bank_accounts");
  await page.getByLabel("รหัสรายการ", { exact: true }).fill(secondBank.id);
  const auditResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/audit-logs/" && new URL(response.url()).searchParams.get("record_id") === secondBank.id);
  await page.getByRole("button", { name: "ค้นหาประวัติ", exact: true }).click();
  const audit = await auditResponse; expect(audit.status()).toBe(200);
  const auditText = await audit.text();
  for (const forbidden of ["0000001234", "0000005678", "password_hash", "account_number_ciphertext"]) expect(auditText).not.toContain(forbidden);
  const auditRows = JSON.parse(auditText).data as { action: string; table_name: string; record_id: string; request_id: string }[];
  expect(auditRows.some(row => row.action === "employee.bank.make-primary.succeeded")).toBe(true);
  expect(auditRows.some(row => row.action === "employee.bank.deactivate.succeeded")).toBe(true);
  expect(auditRows.every(row => row.table_name === "employee_bank_accounts" && row.record_id === secondBank.id && !!row.request_id)).toBe(true);
  await expect(page.getByRole("heading", { name: "ผลการค้นหา", exact: true })).toBeVisible();
  await page.getByText("ข้อมูลใหม่", { exact: true }).first().click();
  await expect(page.locator("details").filter({ has: page.getByText("ข้อมูลใหม่", { exact: true }) }).first().locator("pre")).toBeVisible();
});
