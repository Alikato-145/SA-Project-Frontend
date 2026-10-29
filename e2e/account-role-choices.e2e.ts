import { expect, test } from "@playwright/test";
import { paceLogin } from "./login-pacing";

for (const [username, ownerVisible] of [["hr", false], ["admin", true]] as const) {
  test(`${username} only sees roles they may grant`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
    await paceLogin();
    await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/);
    await page.goto("/accounts");
    await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("employee");
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    const row = page.getByRole("row").filter({ hasText: "employee" }).first();
    await row.getByRole("link", { name: "ดูรายละเอียด", exact: true }).click();
    const role = page.getByRole("combobox", { name: "บทบาท", exact: true });
    await expect(role).toBeEnabled();
    await expect(role.locator('option[value="HR"]')).toHaveCount(1);
    await expect(role.locator('option[value="OWNER"]')).toHaveCount(ownerVisible ? 1 : 0);
  });
}
