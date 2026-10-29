import { paceLogin } from "./login-pacing";
import { test, expect, type Page } from "@playwright/test";

const login = async (page: Page, username: string) => {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin(); await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
};

for (const username of ["admin", "hr"]) {
  test(`${username} creates period, adjusts, previews and locks through UI with persistent single application`, async ({ page, baseURL }) => {
    test.setTimeout(120000);
    await login(page, username);
    const origin = new URL(baseURL!).origin;
    const create = async (path: string, data: unknown) => {
      const response = await page.request.post(`/api/v1${path}`, { data, headers: { origin } });
      expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
      return (await response.json()).data;
    };
    const suffix = `${username}${Date.now().toString(36)}`;
    const shop = await create("/shops", { code: `CA${suffix}`, name: "ร้านทดสอบรายการงวดปัจจุบัน" });
    const branch = await create("/branches", { shop_id: shop.id, code: "MAIN", name: "สาขาทดสอบ" });
    const department = await create("/departments", { branch_id: branch.id, code: "TEAM", name: "ทีม" });
    const position = await create("/positions", { shop_id: shop.id, code: "STAFF", name: "พนักงาน" });
    const onboard = await create("/employees/onboard", {
      employee: { employee_code: `CE${suffix}`, national_id: null, passport_id: `CP${suffix}`, first_name: "ทดสอบ", last_name: "งวดปัจจุบัน", hire_date: "2026-09-30" },
      assignment: { branch_id: branch.id, department_id: department.id, position_id: position.id, employment_type: "full_time", base_salary: "2600.00", welfare_amount: "0.00", effective_from: "2026-09-30" },
      bank_account: { bank_code: "DEMO", bank_name: "ทดสอบ", account_holder_name: "ทดสอบ", account_number: "0000000000", is_primary: true },
      weekly_holidays: [{ weekday: 0, effective_from: "2026-09-30" }], account: { username: `ca_${suffix}` },
    });
    const employeeId = onboard.employee.id;
    await create("/branch-schedules", { branch_id: branch.id, work_start_time: "09:00", standard_close_time: "18:00", late_grace_minutes: 0, effective_from: "2026-09-30" });
    for (const [config_key, numeric_value, unit] of [["STANDARD_WORK_DAYS", "26", "days"], ["ABSENCE_RATE", "1", "multiplier"], ["LATE_RATE", "0", "currency_per_minute"], ["SOCIAL_SECURITY_RATE", "0", "ratio"], ["SOCIAL_SECURITY_CAP", "750", "currency"]]) {
      await create("/payroll/configurations", { shop_id: shop.id, config_key, numeric_value, unit, effective_from: "2026-09-30" });
    }
    await create("/work-day-records", { employee_id: employeeId, branch_id: branch.id, work_date: "2026-09-30", status: "present", clock_in_at: "2026-09-30T02:00:00Z", clock_out_at: "2026-09-30T11:00:00Z", late_minutes: 0, is_deductible: false });
    await page.goto("/payroll");
    await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
    await page.getByRole("button", { name: "เปิดสมุดงาน", exact: true }).click();
    await page.getByLabel("เดือน", { exact: true }).fill("2026-09");
    const opened = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/payroll/periods" && response.request().method() === "POST");
    await page.getByRole("button", { name: "เปิดรอบ", exact: true }).click();
    const openedResponse = await opened; expect(openedResponse.ok(), await openedResponse.text()).toBe(true);
    const period = (await openedResponse.json()).data;
    await page.reload();
    await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
    await page.getByRole("button", { name: "เปิดสมุดงาน", exact: true }).click();
    const current = page.getByRole("region", { name: "รายการเพิ่มและหักในงวดปัจจุบัน", exact: true });
    await current.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
    await current.getByRole("combobox", { name: "งวดเงินเดือน", exact: true }).selectOption(period.id);
    await current.getByRole("combobox", { name: "พนักงานในงวด", exact: true }).selectOption(employeeId);
    await current.getByLabel("จำนวนเงิน", { exact: true }).fill("25.01");
    await current.getByLabel("เหตุผล", { exact: true }).fill("โบนัสงวดปัจจุบัน");
    const submitted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/payroll/adjustments" && response.request().method() === "POST");
    await current.getByRole("button", { name: "ส่งรายการในงวดนี้", exact: true }).click();
    const adjustmentResponse = await submitted;
    expect(adjustmentResponse.ok(), await adjustmentResponse.text()).toBe(true);
    const adjustment = (await adjustmentResponse.json()).data;
    expect(adjustment.employee_id).toBe(employeeId);
    expect(adjustment.original_payroll_record_id).toBeNull();
    await expect(current.getByRole("button", { name: "อนุมัติ", exact: true })).toBeVisible();
    const readiness = await page.request.get(`/api/v1/payroll/periods/${period.id}/readiness`);
    expect((await readiness.json()).data.checks.some((check: { status: string; key: string }) => check.status === "pending")).toBe(true);
    const pendingLock = await page.request.post(`/api/v1/payroll/periods/${period.id}/lock`, { data: {}, headers: { origin } });
    expect((await pendingLock.json()).error.code).toBe("PAYROLL_APPROVALS_PENDING");
    await current.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    await expect(current.getByText("อนุมัติแล้ว คำนวณงวดนี้เพื่อนำรายการไปใช้", { exact: true })).toBeVisible();
    const uiPreview = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/payroll/periods/${period.id}/preview` && response.request().method() === "POST");
    await page.getByRole("button", { name: "คำนวณตัวอย่าง", exact: true }).click();
    const uiPreviewResponse = await uiPreview;
    expect(uiPreviewResponse.ok(), await uiPreviewResponse.text()).toBe(true);
    expect((await uiPreviewResponse.json()).data.records[0].net_pay).toBe("2625.01");
    for (let repeat = 0; repeat < 2; repeat++) {
      const preview = await create(`/payroll/periods/${period.id}/preview`, {});
      expect(preview.records[0].net_pay).toBe("2625.01");
      expect(preview.records[0].items.filter((item: { source_table: string }) => item.source_table === "payroll_adjustments")).toHaveLength(1);
    }
    const locked = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/payroll/periods/${period.id}/lock` && response.request().method() === "POST");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "ล็อกรอบ", exact: true }).click();
    const lockedResponse = await locked; expect(lockedResponse.ok(), await lockedResponse.text()).toBe(true);
    await page.reload();
    const persistent = await page.request.get(`/api/v1/payroll/periods/${period.id}`);
    expect((await persistent.json()).data.records[0].net_pay).toBe("2625.01");
    const applied = await page.request.get(`/api/v1/payroll/adjustments?period_id=${period.id}`);
    expect((await applied.json()).data[0]).toMatchObject({ status: "applied", employee_id: employeeId });
    await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
    await page.getByRole("button", { name: "เปิดสมุดงาน", exact: true }).click();
    await current.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
    await current.getByRole("combobox", { name: "งวดเงินเดือน", exact: true }).selectOption(period.id);
    await expect(current.getByRole("button", { name: "ส่งรายการในงวดนี้", exact: true })).toBeDisabled();
    await page.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "../docs/superpowers/reports"}/current-adjustments-${username}.png`, fullPage: true });
  });
}

test("employee cannot submit or approve payroll adjustments", async ({ page, baseURL }) => {
  await login(page, "employee");
  const headers = { origin: new URL(baseURL!).origin };
  for (const [path, data] of [["/adjustments", { employee_id: "1", applied_payroll_period_id: "1", direction: "earning", amount: "1.00", reason: "Denied" }], ["/adjustments/1/approve", {}]] as const) {
    const response = await page.request.post(`/api/v1/payroll${path}`, { data, headers });
    expect(response.status()).toBe(403);
  }
});
