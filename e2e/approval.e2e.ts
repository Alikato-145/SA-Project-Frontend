import { test, expect, type Page } from "@playwright/test";

test("supervisor approves three days with corrected type and manager directly approves four days", async ({ page, browser, baseURL }) => {
  test.setTimeout(90000);
  const origin = new URL(baseURL!).origin;
  const signIn = async (target: Page, username: string, password: string) => {
    await target.goto(`${baseURL}/login`);
    await target.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
    await target.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
    await target.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
    await expect(target).not.toHaveURL(/\/login$/);
  };
  await signIn(page, "admin", "password");
  const create = async (path: string, data: unknown) => {
    const response = await page.request.post(`/api/v1${path}`, { data, headers: { origin } });
    expect(response.ok(), `${path}: ${await response.text()}`).toBe(true); return (await response.json()).data;
  };
  const suffix = Date.now().toString(36).toUpperCase();
  const shop = await create("/shops", { code: `APPROVAL_${suffix}`, name: "Approval check" });
  const branch = await create("/branches", { shop_id: shop.id, code: "BRANCH", name: "Approval branch" });
  const department = await create("/departments", { branch_id: branch.id, code: "TEAM", name: "Approval team" });
  const position = await create("/positions", { shop_id: shop.id, code: "STAFF", name: "Staff" });
  const employeeCode = `AP_${suffix}`;
  const onboard = await create("/employees/onboard", { employee: { employee_code: employeeCode, national_id: null, passport_id: employeeCode, first_name: "Approval", last_name: "Check", hire_date: "2026-09-01" }, assignment: { branch_id: branch.id, department_id: department.id, position_id: position.id, employment_type: "full_time", base_salary: "2600.00", welfare_amount: "0.00", effective_from: "2026-09-01" } });
  const employeeId = onboard.employee.id;
  const typeBody = { name_th: "Approval leave", quota_type: "fixed", quota_days: "30", is_deductible: false, requires_document: false, allow_exceed: false, is_active: true };
  const original = await create("/leave-types", { ...typeBody, code: `ORIG_${suffix}` });
  const corrected = await create("/leave-types", { ...typeBody, name_th: "Corrected leave", code: `FIX_${suffix}` });
  for (const type of [original, corrected]) {
    const response = await page.request.put("/api/v1/leave-quotas", { headers: { origin }, data: { employee_id: employeeId, leave_type_id: type.id, quota_year: 2026, entitled_days: "30" } });
    expect(response.ok()).toBe(true);
  }
  const three = await create("/leave-requests", { employee_id: employeeId, leave_type_id: original.id, start_date: "2026-09-01", end_date: "2026-09-03", reason: "Three-day request" });
  const four = await create("/leave-requests", { employee_id: employeeId, leave_type_id: original.id, start_date: "2026-09-08", end_date: "2026-09-11", reason: "Four-day request" });
  const contexts = [];
  for (const role of ["SUPERVISOR", "BRANCH_MANAGER"] as const) {
    const username = `${role.toLowerCase()}_${suffix.toLowerCase()}`;
    const account = await create("/accounts/", { username });
    await create(`/accounts/${account.account.id}/roles`, { role_code: role, branch_id: branch.id, department_id: role === "SUPERVISOR" ? department.id : null, reason: "Synthetic approval scope" });
    const context = await browser.newContext(); contexts.push(context);
    const actorPage = await context.newPage(); await signIn(actorPage, username, account.temporary_password);
    await actorPage.goto(`${baseURL}/leave`);
    const picker = actorPage.getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน", { exact: true });
    await picker.fill(employeeCode);
    await expect(actorPage.locator(`datalist option[value^="${employeeCode}"]`)).toHaveCount(1);
    await picker.fill(`${employeeCode} · Approval Check`);
    await actorPage.getByRole("button", { name: "โหลดคำขอ", exact: true }).click();
    if (role === "SUPERVISOR") {
      const record = actorPage.getByRole("article").filter({ hasText: "Three-day request" });
      await record.getByRole("combobox", { name: "เปลี่ยนประเภทการลา (ถ้าจำเป็น)", exact: true }).selectOption(corrected.id);
      await record.getByLabel("หมายเหตุการพิจารณา", { exact: true }).fill("Corrected type and approved three days");
      await record.getByRole("button", { name: "อนุมัติ", exact: true }).click();
      await expect(actorPage.getByText("อนุมัติคำขอลาแล้ว", { exact: true })).toBeVisible();
      const denied = await actorPage.request.post(`${baseURL}/api/v1/leave-requests/${four.id}/approve`, { data: {}, headers: { origin } });
      expect(denied.status()).toBe(403); expect((await denied.json()).error.code).toBe("SUPERVISOR_APPROVAL_LIMIT");
    } else {
      const record = actorPage.getByRole("article").filter({ hasText: "Four-day request" });
      await record.getByLabel("หมายเหตุการพิจารณา", { exact: true }).fill("Direct manager approval");
      await record.getByRole("button", { name: "อนุมัติ", exact: true }).click();
      await expect(actorPage.getByText("อนุมัติคำขอลาแล้ว", { exact: true })).toBeVisible();
    }
  }
  const requests = (await (await page.request.get(`/api/v1/leave-requests?employee_id=${employeeId}`)).json()).data;
  expect(requests.find((row: { id: string }) => row.id === three.id)).toMatchObject({ status: "approved", original_leave_type_id: original.id, final_leave_type_id: corrected.id });
  expect(requests.find((row: { id: string }) => row.id === four.id)?.status).toBe("approved");
  const quotas = (await (await page.request.get(`/api/v1/leave-quotas?employee_id=${employeeId}&quota_year=2026`)).json()).data;
  expect(quotas.find((row: { leave_type_id: string }) => row.leave_type_id === original.id)?.used_days).toBe("4.00");
  expect(quotas.find((row: { leave_type_id: string }) => row.leave_type_id === corrected.id)?.used_days).toBe("3.00");
  const history = (await (await page.request.get(`/api/v1/leave-requests/${three.id}/history`)).json()).data;
  expect(history.map((row: { action: string }) => row.action)).toContain("type_changed");
  expect(history.at(-1).remark).toBe("Corrected type and approved three days");
  for (const context of contexts) await context.close();
});
