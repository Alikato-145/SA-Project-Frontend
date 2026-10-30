import { expect, test } from "@playwright/test";
import { paceLogin } from "./login-pacing";

test("employee workspace remains usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("admin");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto("/employees");
  await expect(page.getByRole("heading", { name: "ทะเบียนพนักงาน" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสพนักงาน" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
