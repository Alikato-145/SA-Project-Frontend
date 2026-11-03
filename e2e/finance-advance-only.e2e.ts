import { expect, test } from "@playwright/test";
import { paceLogin } from "./login-pacing";

test("finance retains advances without debt and loan management", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", request => requested.push(new URL(request.url()).pathname));
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("employee");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: "เงินทดรองจ่าย", exact: true })).toBeVisible();
  const loaded = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/advance-requests");
  await page.getByRole("button", { name: "โหลดข้อมูลการเงิน", exact: true }).click();
  expect((await loaded).ok()).toBe(true);
  await expect(page.getByRole("button", { name: "ส่งคำขอเงินทดรองจ่าย", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "คำขอเงินกู้", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "เงินกู้", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "บัญชีหนี้", exact: true })).toHaveCount(0);
  expect(requested.filter(path => /\/api\/v1\/(loans|loan-requests|debt-types|debt-transactions)/.test(path))).toEqual([]);
});
