import { expect, test } from "@playwright/test";
import { paceLogin } from "./login-pacing";

test("employee filters load named branches with many shops", async ({ page }) => {
  test.skip(process.env.LARGE_ORGANIZATION_FIXTURE !== "1", "Requires a disposable fixture with over 1,000 shops and the DEMO branch.");
  test.setTimeout(180_000);
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("admin");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto("/employees");
  await expect(page.getByRole("combobox", { name: "สาขา", exact: true }).locator("option").filter({ hasText: "สาขาตัวอย่าง กรุงเทพฯ" })).toHaveCount(1, { timeout: 150_000 });
  await expect(page.getByText("โหลดรายชื่อสาขาและแผนกไม่สำเร็จ กรุณาโหลดหน้าใหม่")).toHaveCount(0);
});
