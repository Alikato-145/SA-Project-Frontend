import { expect, test } from "@playwright/test";
import { paceLogin } from "./login-pacing";

test("employment termination blocks linked login and existing sessions on its effective date", async ({ page, browser, baseURL }) => {
  test.setTimeout(90000);
  const origin = new URL(baseURL!).origin;
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("hr");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  const list = async (path: string) => (await (await page.request.get(`/api/v1/${path}`)).json()).data;
  const shop = (await list("shops?search=DEMO" )).find((row: { code: string }) => row.code === "DEMO");
  const branch = (await list(`branches?shop_id=${shop.id}`)).find((row: { code: string }) => row.code === "DEMO-BKK");
  const department = (await list(`departments?branch_id=${branch.id}`))[0];
  const position = (await list(`positions?shop_id=${shop.id}`))[0];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const tomorrowDate = new Date(`${today}T00:00:00Z`); tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const suffix = Date.now().toString();
  const create = async (label: string) => {
    const username = `end${label}${suffix}`;
    const response = await page.request.post("/api/v1/employees/onboard", { headers: { origin }, data: {
      employee: { first_name: "End", last_name: label, passport_id: `${label}${suffix}`, hire_date: today },
      assignment: { branch_id: branch.id, department_id: department.id, position_id: position.id, employment_type: "full_time", base_salary: "18000.00", welfare_amount: "0.00", effective_from: today },
      account: { username, role_code: "EMPLOYEE" },
    } });
    expect(response.ok(), await response.text()).toBe(true);
    return { username, ...(await response.json()).data };
  };
  const immediate = await create("today");
  const context = await browser.newContext({ baseURL });
  await paceLogin();
  const login = await context.request.post("/api/v1/auth/login", { headers: { origin }, data: { username: immediate.username, password: immediate.temporary_password } });
  expect(login.status()).toBe(200);
  expect((await context.request.get("/api/v1/auth/me")).status()).toBe(200);
  await page.goto(`/employees/${immediate.employee.id}`);
  await page.getByText("เปลี่ยนสถานะพนักงาน", { exact: true }).click();
  await page.getByRole("combobox", { name: "สถานะใหม่", exact: true }).selectOption("terminated");
  await page.locator('[name="terminated_at"]').fill(today);
  await page.locator('[name="reason"]').fill("ทดลองสิ้นสุดการจ้าง");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "บันทึกสถานะพนักงาน", exact: true }).click();
  await expect(page.getByText("บันทึกสถานะและประวัติการจ้างแล้ว", { exact: true })).toBeVisible();
  expect((await context.request.get("/api/v1/auth/me")).status()).not.toBe(200);
  expect((await context.request.get("/api/v1/employees")).status()).not.toBe(200);
  await paceLogin();
  expect((await context.request.post("/api/v1/auth/login", { headers: { origin }, data: { username: immediate.username, password: immediate.temporary_password } })).status()).not.toBe(200);
  await context.close();
  const future = await create("future");
  const end = await page.request.patch(`/api/v1/employees/${future.employee.id}/status`, { headers: { origin }, data: { status: "terminated", terminated_at: tomorrow, reason: "ทดลองล่วงหน้า" } });
  expect(end.ok(), await end.text()).toBe(true);
  const second = await browser.newContext({ baseURL });
  await paceLogin();
  expect((await second.request.post("/api/v1/auth/login", { headers: { origin }, data: { username: future.username, password: future.temporary_password } })).status()).toBe(200);
  expect((await second.request.get("/api/v1/auth/me")).status()).toBe(200);
  await second.close();
});
