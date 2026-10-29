import { expect, test, type Page } from "@playwright/test";
import { paceLogin } from "./login-pacing";

async function login(page: Page, username: string, password: string, accepted = true) {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  const response = page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/auth/login" && r.request().method() === "POST");
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(accepted ? 200 : 401);
  if (accepted) await expect(page).not.toHaveURL(/\/login$/);
  else await expect(page).toHaveURL(/\/login$/);
}

for (const role of ["EMPLOYEE", "SUPERVISOR", "BRANCH_MANAGER", "HR", "OWNER"]) test(`UC01 ${role} changes own password through UI and reauthenticates with unchanged scope`, async ({ page, browser, baseURL }) => {
  test.setTimeout(120000);
  await login(page, "admin", "password");
  const headers = { origin: new URL(baseURL!).origin };
  const key = `PW${role.slice(0, 2)}${Date.now().toString(36).toUpperCase()}`;
  const create = async (path: string, data: unknown) => {
    const response = await page.request.post(`/api/v1${path}`, { headers, data });
    expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
    return (await response.json()).data;
  };
  // Isolated setup is not UI acceptance; no shared fixture account password changes.
  const shop = await create("/shops", { code: key, name: key });
  const branch = await create("/branches", { shop_id: shop.id, code: key, name: key });
  const department = await create("/departments", { branch_id: branch.id, code: key, name: key });
  const position = await create("/positions", { shop_id: shop.id, code: key, name: key });
  const account = await create("/employees/onboard", {
    employee: { employee_code: key, passport_id: key, first_name: "Password", last_name: "Actor", hire_date: "2026-09-01" },
    assignment: { branch_id: branch.id, department_id: department.id, position_id: position.id, employment_type: "full_time", base_salary: "26000.00", welfare_amount: "0.00", effective_from: "2026-09-01" },
    account: { username: key.toLowerCase(), role_code: role },
  });
  const context = await browser.newContext({ baseURL });
  try {
    const actor = await context.newPage();
    await login(actor, key.toLowerCase(), account.temporary_password);
    const identity = (await (await actor.request.get("/api/v1/auth/me")).json()).data;
    expect(identity.grants.map((g: { role_code: string }) => g.role_code)).toEqual([role]);
    const copied = (await context.cookies()).find(cookie => cookie.name === "haris_session")!;
    const copiedHeaders = { cookie: `haris_session=${copied.value}` };
    await actor.goto("/settings");
    const newPassword = `Updated-${key}-42`;
    const change = async (current: string) => {
      await actor.getByLabel("รหัสผ่านปัจจุบัน", { exact: true }).fill(current);
      await actor.getByLabel("รหัสผ่านใหม่", { exact: true }).fill(newPassword);
      await actor.getByLabel("ยืนยันรหัสผ่านใหม่", { exact: true }).fill(newPassword);
      const response = actor.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/auth/change-password" && r.request().method() === "POST");
      await actor.getByRole("button", { name: "เปลี่ยนรหัสผ่าน", exact: true }).click();
      return response;
    };
    const denied = await change("Incorrect-current-password");
    expect(denied.status()).toBe(422);
    expect((await denied.json()).error.code).toBe("CURRENT_PASSWORD_INCORRECT");
    expect((await actor.request.get("/api/v1/auth/me")).status()).toBe(200);
    expect((await change(account.temporary_password)).status()).toBe(200);
    await expect(actor.getByText("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว ใช้รหัสผ่านใหม่ในการเข้าสู่ระบบครั้งถัดไป", { exact: true })).toBeVisible();
    expect((await (await actor.request.get("/api/v1/auth/me")).json()).data).toEqual(identity);
    await actor.getByRole("button", { name: "ออกจากระบบ", exact: true }).click();
    await expect(actor).toHaveURL(/\/login$/);
    expect((await actor.request.get("/api/v1/auth/me", { headers: copiedHeaders })).status()).toBe(401);
    expect((await actor.request.get("/api/v1/employees?page_size=1", { headers: copiedHeaders })).status()).toBe(401);
    await login(actor, key.toLowerCase(), account.temporary_password, false);
    await login(actor, key.toLowerCase(), newPassword);
    expect((await (await actor.request.get("/api/v1/auth/me")).json()).data).toEqual(identity);
    await actor.reload();
    expect((await (await actor.request.get("/api/v1/auth/me")).json()).data).toEqual(identity);
  } finally { await context.close(); }
});
