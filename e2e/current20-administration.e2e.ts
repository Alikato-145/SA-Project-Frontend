import { expect, test, type Page } from "@playwright/test";
import { paceLogin } from "./login-pacing";

async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function saved(page: Page, path: string, method: string, submit: () => Promise<unknown>) {
  const pending = page.waitForResponse(r => new URL(r.url()).pathname === `/api/v1${path}` && r.request().method() === method);
  await submit();
  const response = await pending;
  expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBe(true);
  return (await response.json()).data;
}

async function pickEmployee(page: Page, code: string) {
  const picker = page.getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน", { exact: true });
  await picker.fill(code);
  const option = page.locator("datalist option").first();
  await expect(option).toHaveAttribute("value", new RegExp(code));
  await picker.fill((await option.getAttribute("value"))!);
}

for (const username of ["hr", "admin"]) test(`UC02/03/04/05/06/13/20 ${username} submits administration forms and audits persisted changes`, async ({ page, baseURL }) => {
  test.setTimeout(180000);
  await login(page, username);
  const key = `A${username.toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
  const headers = { origin: new URL(baseURL!).origin };
  // Every operation asserted as UI coverage below is submitted through its form.
  await page.goto("/organization");
  const ids: Record<string, string> = {};
  for (const [kind, label, parent, parentLabel] of [
    ["shops", "ร้าน", "", ""], ["branches", "สาขา", "shops", "ร้าน"],
    ["departments", "แผนก", "branches", "สาขา"], ["positions", "ตำแหน่ง", "shops", "ร้าน"],
  ]) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await page.getByLabel("ค้นหารหัสหรือชื่อ", { exact: true }).fill(key);
    if (parent) await page.locator("section").filter({ has: page.getByRole("heading", { name: "โครงสร้างองค์กร", exact: true }) }).getByRole("combobox", { name: parentLabel, exact: true }).selectOption(ids[parent]);
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: `เพิ่ม${label}`, exact: true }) });
    await form.getByLabel("ชื่อ", { exact: true }).fill(`${label} ${key}`);
    if (parent) await form.getByRole("combobox", { name: parentLabel, exact: true }).selectOption(ids[parent]);
    const created = await saved(page, `/${kind}`, "POST", () => form.getByRole("button", { name: `เพิ่ม${label}`, exact: true }).click());
    ids[kind] = created.id;
    await page.getByRole("row").filter({ hasText: key }).getByRole("button", { name: "แก้ไข", exact: true }).click();
    const edit = page.locator("form").filter({ has: page.getByRole("button", { name: "บันทึกการแก้ไข", exact: true }) });
    await edit.getByLabel("ชื่อ", { exact: true }).fill(`${label} ${key} reviewed`);
    await saved(page, `/${kind}/${created.id}`, "PATCH", () => edit.getByRole("button", { name: "บันทึกการแก้ไข", exact: true }).click());
    await expect(page.getByRole("row").filter({ hasText: key })).toContainText("reviewed");
    expect((await (await page.request.get(`/api/v1/${kind}/${created.id}`)).json()).data.name).toContain("reviewed");
  }
  // Isolated employee is setup only; employee CRUD has its own three-actor UI test.
  const setup = await page.request.post("/api/v1/employees/onboard", { headers, data: {
    employee: { employee_code: key, passport_id: key, first_name: "Actor", last_name: "Administration", hire_date: "2036-01-01" },
    assignment: { branch_id: ids.branches, department_id: ids.departments, position_id: ids.positions, employment_type: "full_time", base_salary: "26000.00", welfare_amount: "0.00", effective_from: "2036-01-01" },
  } });
  expect(setup.ok(), await setup.text()).toBe(true);
  const employee = (await setup.json()).data.employee;
  await page.goto(`/employees/${employee.id}/employment`);
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(ids.shops);
  await page.getByRole("combobox", { name: "สาขา", exact: true }).selectOption(ids.branches);
  await page.getByRole("combobox", { name: "แผนก", exact: true }).selectOption(ids.departments);
  await page.getByRole("combobox", { name: "ตำแหน่ง", exact: true }).selectOption(ids.positions);
  await page.getByLabel("เงินเดือนฐาน", { exact: true }).fill("27000.00");
  await page.getByLabel("สวัสดิการ", { exact: true }).fill("1000.00");
  await page.getByLabel("มีผลตั้งแต่", { exact: true }).fill("2036-02-01");
  await saved(page, `/employees/${employee.id}/assignments`, "POST", () => page.getByRole("button", { name: "บันทึกช่วงใหม่", exact: true }).click());
  await page.reload();
  const assignments = (await (await page.request.get(`/api/v1/employees/${employee.id}/assignments`)).json()).data;
  expect(assignments).toHaveLength(2);
  expect(assignments[0]).toMatchObject({ base_salary: "26000.00", welfare_amount: "0.00", effective_to: "2036-01-31" });
  expect(assignments[1]).toMatchObject({ base_salary: "27000.00", welfare_amount: "1000.00", effective_from: "2036-02-01" });
  await page.goto(`/employees/${employee.id}/weekly-holidays`);
  await page.getByRole("combobox", { name: "วันหยุด", exact: true }).selectOption("0");
  await page.getByLabel("วันเริ่มต้นวันหยุด", { exact: true }).fill("2036-01-01");
  await saved(page, `/employees/${employee.id}/weekly-holidays`, "POST", () => page.getByRole("button", { name: "บันทึกช่วงใหม่", exact: true }).click());
  await page.getByLabel("วันเริ่มต้นวันหยุด", { exact: true }).fill("2036-02-01");
  await saved(page, `/employees/${employee.id}/weekly-holidays`, "POST", () => page.getByRole("button", { name: "บันทึกช่วงใหม่", exact: true }).click());
  await page.reload();
  const holidays = (await (await page.request.get(`/api/v1/employees/${employee.id}/weekly-holidays`)).json()).data;
  expect(holidays).toHaveLength(2);
  expect(holidays[0]).toMatchObject({ weekday: 0, effective_to: "2036-01-31" });
  await page.goto(`/employees/${employee.id}/bank`);
  await page.getByLabel("รหัสธนาคาร", { exact: true }).fill("DEMO");
  await page.getByLabel("ชื่อธนาคาร", { exact: true }).fill("Synthetic verification bank");
  await page.getByLabel("ชื่อบัญชี", { exact: true }).fill("Synthetic recipient");
  await page.getByLabel("เลขบัญชีเต็ม", { exact: true }).fill("0000000000");
  await saved(page, `/employees/${employee.id}/bank-accounts`, "POST", () => page.getByRole("button", { name: "เพิ่มบัญชี", exact: true }).click());
  await page.reload();
  const bankResponse = await page.request.get(`/api/v1/employees/${employee.id}/bank-accounts`);
  const bankText = await bankResponse.text();
  expect(bankText).not.toContain("0000000000"); expect(bankText).not.toContain("ciphertext");
  expect(JSON.parse(bankText).data).toHaveLength(1);
  await page.goto("/accounts/new");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(key.toLowerCase());
  const account = await saved(page, "/accounts/", "POST", () => page.getByRole("button", { name: "สร้างบัญชี", exact: true }).click());
  await page.getByRole("button", { name: "ปิดรหัสผ่าน", exact: true }).click();
  await page.getByRole("link", { name: "กำหนดบทบาทบัญชีนี้", exact: true }).click();
  await page.getByRole("combobox", { name: "บทบาท", exact: true }).selectOption("BRANCH_MANAGER");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(ids.shops);
  await page.getByRole("combobox", { name: "สาขา", exact: true }).selectOption(ids.branches);
  await page.getByLabel("เหตุผล", { exact: true }).fill(`Scope ${key}`);
  await saved(page, `/accounts/${account.account.id}/roles`, "POST", () => page.getByRole("button", { name: "เพิ่มบทบาท", exact: true }).click());
  await page.reload();
  const accountDetail = (await (await page.request.get(`/api/v1/accounts/${account.account.id}`)).json()).data;
  expect(accountDetail.grants).toEqual([expect.objectContaining({ role_code: "BRANCH_MANAGER", branch_id: ids.branches, scope: "branch" })]);
  if (username === "hr") {
    const denied = await page.request.post(`/api/v1/accounts/${account.account.id}/roles`, { headers, data: { role_code: "OWNER", reason: "HR cannot grant owner" } });
    expect(denied.status()).toBe(403);
  }
  await page.goto("/schedules");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(ids.shops);
  await page.getByRole("combobox", { name: "สาขา", exact: true }).selectOption(ids.branches);
  await page.getByRole("button", { name: "โหลดตารางและวันหยุด", exact: true }).click();
  await page.getByLabel("เวลาเริ่มงาน", { exact: true }).fill("09:00");
  await page.getByLabel("เวลาเลิกงาน", { exact: true }).fill("18:00");
  await page.getByLabel("อนุโลมมาสาย (นาที)", { exact: true }).fill("5");
  await page.getByLabel("เริ่มใช้วันที่", { exact: true }).fill("2036-01-01");
  const schedule = await saved(page, "/branch-schedules", "POST", () => page.getByRole("button", { name: "บันทึกตารางเวลา", exact: true }).click());
  await page.getByRole("combobox", { name: "ตารางเดิมที่ต้องการเปลี่ยน", exact: true }).selectOption(schedule.id);
  await page.getByLabel("เวลาเริ่มงาน", { exact: true }).fill("10:00");
  await page.getByLabel("เริ่มใช้วันที่", { exact: true }).fill("2036-02-01");
  await saved(page, `/branch-schedules/${schedule.id}`, "PATCH", () => page.getByRole("button", { name: "บันทึกตารางเวลา", exact: true }).click());
  await page.getByLabel("วันที่หยุด", { exact: true }).fill("2036-01-03");
  await page.getByLabel("ชื่อวันหยุด", { exact: true }).fill(key);
  await saved(page, "/holiday-calendars", "POST", () => page.getByRole("button", { name: "เพิ่มวันหยุด", exact: true }).click());
  await page.reload();
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(ids.shops);
  await page.getByRole("combobox", { name: "สาขา", exact: true }).selectOption(ids.branches);
  await page.getByRole("button", { name: "โหลดตารางและวันหยุด", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "2036-01-01 – 2036-01-31" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: key })).toBeVisible();
  await page.goto("/payroll");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(ids.shops);
  await page.getByRole("button", { name: "เปิดสมุดงาน", exact: true }).click();
  const configForm = page.locator("form").filter({ has: page.getByRole("button", { name: "บันทึกค่าคำนวณ", exact: true }) });
  await configForm.getByLabel(/^ค่า \(/).fill("26");
  await configForm.getByLabel("เริ่มใช้", { exact: true }).fill("2036-01-01");
  const configuration = await saved(page, "/payroll/configurations", "POST", () => configForm.getByRole("button", { name: "บันทึกค่าคำนวณ", exact: true }).click());
  await page.getByText("ความพร้อมของค่าคำนวณ (1)", { exact: true }).click();
  await page.getByText("เปลี่ยนค่าตั้งแต่วันที่", { exact: true }).click();
  await page.getByLabel(/^ค่าใหม่ \(/).fill("25");
  await page.getByLabel("วันที่เริ่มใช้ค่าใหม่", { exact: true }).fill("2036-02-01");
  await saved(page, `/payroll/configurations/${configuration.id}/successor`, "POST", () => page.getByRole("button", { name: "บันทึกช่วงใหม่", exact: true }).click());
  const configurations = (await (await page.request.get(`/api/v1/payroll/configurations?shop_id=${ids.shops}`)).json()).data;
  expect(configurations).toHaveLength(2);
  expect(configurations.find((c: { id: string }) => c.id === configuration.id).effective_to).toBe("2036-01-31");
  await page.goto("/leave");
  await page.getByText("จัดการประเภทและสิทธิ์วันลา (HR / เจ้าของ)", { exact: true }).click();
  const typeForm = page.locator("form").filter({ has: page.getByRole("button", { name: "บันทึกประเภท", exact: true }) });
  await typeForm.getByLabel("รหัสประเภท", { exact: true }).fill(key);
  await typeForm.getByLabel("ชื่อประเภท", { exact: true }).fill(key);
  await typeForm.getByLabel("จำนวนวันมาตรฐาน (สำหรับสิทธิ์คงที่)", { exact: true }).fill("5");
  const leaveType = await saved(page, "/leave-types", "POST", () => typeForm.getByRole("button", { name: "บันทึกประเภท", exact: true }).click());
  const quota = page.locator("form").filter({ has: page.getByRole("button", { name: "บันทึกสิทธิ์วันลา", exact: true }) });
  const quotaPicker = quota.getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน", { exact: true });
  await quotaPicker.fill(key);
  await expect(quota.locator("datalist option").first()).toHaveAttribute("value", new RegExp(key));
  await quotaPicker.fill((await quota.locator("datalist option").first().getAttribute("value"))!);
  await quota.getByLabel("ปี ค.ศ.", { exact: true }).fill("2036");
  await quota.getByRole("combobox", { name: "ประเภทการลา", exact: true }).selectOption(leaveType.id);
  await quota.getByLabel("สิทธิ์ทั้งหมด (วัน)", { exact: true }).fill("5");
  await saved(page, "/leave-quotas", "PUT", () => quota.getByRole("button", { name: "บันทึกสิทธิ์วันลา", exact: true }).click());
  expect((await (await page.request.get(`/api/v1/leave-quotas?employee_id=${employee.id}&quota_year=2036`)).json()).data[0]).toMatchObject({ entitled_days: "5.00", used_days: "0.00" });
  await page.goto("/finance");
  await pickEmployee(page, key);
  await page.getByRole("button", { name: "โหลดข้อมูลการเงิน", exact: true }).click();
  await page.getByText("จัดการประเภทหนี้", { exact: true }).click();
  const debtTypeForm = page.locator("form").filter({ has: page.getByRole("button", { name: "บันทึกประเภทหนี้", exact: true }) });
  await debtTypeForm.getByLabel("รหัสประเภท", { exact: true }).fill(key);
  await debtTypeForm.getByLabel("ชื่อประเภท", { exact: true }).fill(key);
  const debtType = await saved(page, "/debt-types", "POST", () => debtTypeForm.getByRole("button", { name: "บันทึกประเภทหนี้", exact: true }).click());
  const debt = page.locator("form").filter({ has: page.getByRole("button", { name: "บันทึกรายการ", exact: true }) });
  await debt.getByRole("combobox", { name: "ประเภทหนี้", exact: true }).selectOption(debtType.id);
  await debt.getByLabel("จำนวนเงิน", { exact: true }).fill("25.01");
  await debt.getByLabel("รายละเอียด", { exact: true }).fill(key);
  const charge = await saved(page, "/debt-transactions", "POST", () => debt.getByRole("button", { name: "บันทึกรายการ", exact: true }).click());
  const chargeRow = page.getByRole("article").filter({ hasText: key });
  await chargeRow.getByLabel("เหตุผลการกลับรายการ", { exact: true }).fill(`Correction ${key}`);
  await saved(page, `/debt-transactions/${charge.id}/reverse`, "POST", () => chargeRow.getByRole("button", { name: "กลับรายการ", exact: true }).click());
  await page.reload(); await pickEmployee(page, key);
  await page.getByRole("button", { name: "โหลดข้อมูลการเงิน", exact: true }).click();
  await expect(page.getByRole("article").filter({ hasText: key })).toHaveCount(2);
  const ledger = (await (await page.request.get(`/api/v1/debt-transactions?employee_id=${employee.id}`)).json()).data;
  expect(ledger.balance).toBe("0.00"); expect(ledger.entries).toHaveLength(2);
  await page.goto("/audit");
  await page.getByLabel("ตารางข้อมูล", { exact: true }).fill("shops");
  await page.getByLabel("รหัสรายการ", { exact: true }).fill(ids.shops);
  await page.getByRole("button", { name: "ค้นหาประวัติ", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("tbody")).toContainText(key);
  await expect(page.locator("tbody")).toContainText("reviewed");
  await page.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/current20-admin-audit-${username}.png`, fullPage: true });
});

for (const username of ["employee", "supervisor", "branch_manager", "hr", "admin"]) test(`UC19 ${username} opens permitted workspace links and financial scope stays explicit`, async ({ page }) => {
  await login(page, username);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "พื้นที่ทำงาน", exact: true })).toBeVisible();
  const workspace = page.getByRole("region", { name: "เริ่มงานประจำวัน", exact: true });
  await workspace.getByRole("link", { name: /การลา/ }).click();
  await expect(page.getByRole("heading", { name: "การลา", exact: true })).toBeVisible();
  await page.goto("/audit");
  await expect(page.getByRole("heading", { name: ["hr", "admin"].includes(username) ? "ประวัติการเปลี่ยนแปลง" : "ไม่มีสิทธิ์เข้าถึงหน้านี้", exact: true })).toBeVisible();
  if (!["hr", "admin"].includes(username)) {
    expect((await page.request.get("/api/v1/audit-logs")).status()).toBe(403);
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "ไม่มีสิทธิ์เข้าถึงหน้านี้", exact: true })).toBeVisible();
  }
});
