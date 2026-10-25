import { paceLogin } from "./login-pacing";
import { test, expect } from "@playwright/test";

for (const username of ["branch_manager", "hr", "admin"]) test(`${username} creates, edits and terminates an employee through UI with persistence`, async ({ page, browser, baseURL }) => {
  test.setTimeout(120000);
  const origin = new URL(baseURL!).origin;
  const code = `CRUD-${username.slice(0, 3)}-${Date.now().toString(36)}`;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin(); await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto("/employees");
  await page.getByRole("link", { name: "เพิ่มพนักงาน", exact: true }).click();
  await page.getByLabel("รหัสพนักงาน", { exact: true }).fill(code);
  await page.getByLabel("วันที่เริ่มงาน", { exact: true }).fill(today);
  await page.getByLabel("ชื่อ", { exact: true }).fill("Scoped");
  await page.getByLabel("นามสกุล", { exact: true }).fill("Manager");
  await page.getByLabel("เลขหนังสือเดินทาง", { exact: true }).fill(code);
  await page.getByRole("button", { name: /ถัดไป/ }).click();
  const demoShop = page.getByRole("combobox", { name: "ร้าน", exact: true }).getByRole("option", { name: /^DEMO ·/ });
  await expect(demoShop).toBeAttached();
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(await demoShop.getAttribute("value") ?? "");
  await expect(page.getByRole("combobox", { name: "สาขา", exact: true })).toBeEnabled();
  await page.getByRole("combobox", { name: "สาขา", exact: true }).selectOption({ index: username === "branch_manager" ? 1 : 2 });
  const branch = await page.getByRole("combobox", { name: "สาขา", exact: true }).inputValue();
  await expect(page.getByRole("combobox", { name: "แผนก", exact: true })).toBeEnabled();
  await page.getByRole("combobox", { name: "แผนก", exact: true }).selectOption({ index: 1 });
  await page.getByRole("combobox", { name: "ตำแหน่ง", exact: true }).selectOption({ index: 1 });
  const department = await page.getByRole("combobox", { name: "แผนก", exact: true }).inputValue();
  const position = await page.getByRole("combobox", { name: "ตำแหน่ง", exact: true }).inputValue();
  await page.getByLabel("เงินเดือนฐาน", { exact: true }).fill("18000.00");
  if (username === "branch_manager") {
  await expect(page.getByRole("checkbox", { name: "เพิ่มบัญชีธนาคาร" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "สร้างบัญชีเข้าใช้งาน" })).toBeDisabled();
  const input = { employee: { employee_code: code + "-DENY", first_name: "Denied", last_name: "Scope", passport_id: code + "-DENY", hire_date: today }, assignment: { branch_id: branch, department_id: department, position_id: position, employment_type: "full_time", base_salary: "18000.00", welfare_amount: "0.00", effective_from: today } };
  for (const data of [{ ...input, account: { username: code } }, { ...input, assignment: { ...input.assignment, branch_id: "999999" } }]) {
    const response = await page.request.post("/api/v1/employees/onboard", { headers: { origin }, data });
    expect(response.status()).toBe(403);
  }
  const denied = await page.request.get(`/api/v1/employees?search=${code}-DENY`);
  expect((await denied.json()).data).toHaveLength(0);
  }
  await page.getByRole("button", { name: "สร้างพนักงาน", exact: true }).click();
  await page.getByRole("link", { name: "ดูข้อมูลพนักงาน", exact: true }).click();
  await expect(page.getByRole("definition").filter({ hasText: code })).toBeVisible();
  const employeeId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByText("แก้ข้อมูลติดต่อพนักงาน", { exact: true }).click();
  await page.locator('[name="phone"]').fill("0812345678");
  await page.getByRole("button", { name: "บันทึกข้อมูลพนักงาน", exact: true }).click();
  await expect(page.getByText("บันทึกข้อมูลพนักงานแล้ว", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByText("แก้ข้อมูลติดต่อพนักงาน", { exact: true }).click();
  await expect(page.locator('[name="phone"]')).toHaveValue("0812345678");
  const persisted = await page.request.get(`/api/v1/employees/${employeeId}`);
  const profile = (await persisted.json()).data;
  expect(profile.phone).toBe("0812345678");
  if (username === "branch_manager") expect(profile).not.toHaveProperty("national_id_masked");
  await page.getByText("เปลี่ยนสถานะพนักงาน", { exact: true }).click();
  await page.getByRole("combobox", { name: "สถานะใหม่", exact: true }).selectOption("terminated");
  await page.locator('[name="terminated_at"]').fill(today);
  await page.locator('[name="reason"]').fill("Disposable manager journey");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "บันทึกสถานะพนักงาน", exact: true }).click();
  await expect(page.getByText("บันทึกสถานะและประวัติการจ้างแล้ว", { exact: true })).toBeVisible();
  await page.reload();
  const terminated = await page.request.get(`/api/v1/employees/${employeeId}`);
  expect((await terminated.json()).data.status).toBe("terminated");
  // Assignment administration remains HR/OWNER-only even after a manager's valid termination.
  const observer = await browser.newContext({ baseURL });
  try {
    await paceLogin();
    expect((await observer.request.post("/api/v1/auth/login", { headers: { origin }, data: { username: "hr", password: "password" } })).status()).toBe(200);
    const stored = await observer.request.get(`/api/v1/employees/${employeeId}/assignments`);
    expect(stored.status()).toBe(200);
    const assignments = (await stored.json()).data;
    expect(assignments).toHaveLength(1);
    expect(assignments[0].effective_to).toBe(today);
  } finally { await observer.close(); }
  await page.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/employee-crud-${username}.png`, fullPage: true });
});
