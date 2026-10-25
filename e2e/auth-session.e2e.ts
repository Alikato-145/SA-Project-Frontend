import { paceLogin } from "./login-pacing";
import { test, expect } from "@playwright/test";

for (const username of ["employee", "supervisor", "branch_manager", "hr", "admin"]) {
  test(`${username} logout revokes copied session on auth and business APIs while another session stays valid`, async ({ page, browser, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    await page.goto("/login");
    await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
    await paceLogin(); await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/);
    const actor = (await (await page.request.get("/api/v1/auth/me")).json()).data;
    expect(actor.grants.map((grant: { role_code: string }) => grant.role_code)).toEqual([username === "admin" ? "OWNER" : username.toUpperCase()]);
    await page.reload();
    expect((await page.request.get("/api/v1/auth/me")).status()).toBe(200);
    const session = (await page.context().cookies()).find(cookie => cookie.name === "haris_session");
    expect(session).toBeDefined();
    const copiedHeaders = { cookie: `haris_session=${session!.value}` };
    expect((await page.request.get("/api/v1/auth/me", { headers: copiedHeaders })).status()).toBe(200);

    const other = await browser.newContext();
    try {
      await paceLogin();
      const login = await other.request.post(`${baseURL}/api/v1/auth/login`, {
        headers: { origin }, data: { username, password: "password" },
      });
      expect(login.status()).toBe(200);
      await page.getByRole("button", { name: "ออกจากระบบ", exact: true }).click();
      await expect(page).toHaveURL(/\/login$/);
      expect((await page.request.get("/api/v1/auth/me")).status()).toBe(401);
      expect((await page.request.get("/api/v1/auth/me", { headers: copiedHeaders })).status()).toBe(401);
      expect((await page.request.get("/api/v1/employees?page_size=1", { headers: copiedHeaders })).status()).toBe(401);
      expect((await other.request.get(`${baseURL}/api/v1/auth/me`)).status()).toBe(200);
    } finally {
      await other.request.post(`${baseURL}/api/v1/auth/logout`, { headers: { origin }, data: {} });
      await other.close();
    }
  });
}
