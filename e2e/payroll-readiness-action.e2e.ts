import { test, expect } from "@playwright/test";
import { paceLogin } from "./login-pacing";

test("missing calculation opens the correct branch and date range and saves it", async ({ page }) => {
  test.skip(process.env.PAYROLL_READINESS_MISSING_FIXTURE !== "1", "Requires a disposable seed with the demo LATE_RATE configuration removed.");
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("admin");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto("/payroll");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption({ label: "DEMO · ร้านตัวอย่าง Haris" });
  await page.getByRole("button", { name: "เปิดสมุดงาน", exact: true }).click();
  const readiness = page.getByRole("region", { name: "ความพร้อมของงวด", exact: true });
  const missing = readiness.getByRole("row").filter({ hasText: "Demo Employee" }).filter({ hasText: "อัตราหักเมื่อมาสาย" });
  await expect(missing).toBeVisible();
  await missing.getByRole("button", { name: "ตั้งค่านี้" }).click();
  const form = page.locator("#configuration-form form");
  await expect(form.getByRole("combobox", { name: "ค่าคำนวณ" })).toHaveValue("LATE_RATE");
  await expect(form.locator('select[name="branch_id"] option:checked')).toContainText("สาขาตัวอย่าง กรุงเทพฯ");
  await expect(form.locator('input[name="effective_from"]')).not.toHaveValue("");
  await expect(form.locator('input[name="effective_to"]')).not.toHaveValue("");
  await form.locator('input[name="numeric_value"]').fill("2");
  await form.getByRole("button", { name: "บันทึกค่าคำนวณ" }).click();
  await expect(page.getByText("บันทึกค่าคำนวณแล้ว")).toBeVisible();
  await expect(missing).toHaveCount(0);
});
