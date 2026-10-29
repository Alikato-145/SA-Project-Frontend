import { expect, test } from "@playwright/test";
import { paceLogin } from "./login-pacing";

test("blank times are filled from the schedule and identified on the attendance page", async ({ page }) => {
  test.skip(process.env.ATTENDANCE_SCHEDULE_FIXTURE !== "1", "Requires a disposable release fixture and an unused 2026-11-04.");
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("employee_other_1");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await page.goto("/attendance");
  await page.getByLabel("ตั้งแต่", { exact: true }).fill("2026-11-04");
  await page.getByLabel("ถึง", { exact: true }).fill("2026-11-04");
  await page.getByRole("button", { name: "โหลดรายการ", exact: true }).click();
  const form = page.locator('form').filter({ has: page.getByRole("button", { name: "บันทึกวันทำงาน", exact: true }) });
  await form.getByLabel("วันที่ทำงาน", { exact: true }).fill("2026-11-04");
  await expect(form.getByText(/ตารางที่มีผล/)).toBeVisible();
  await form.getByRole("button", { name: "บันทึกวันทำงาน", exact: true }).click();
  await expect(page.getByText("บันทึกวันทำงานแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByText("เวลาตามตาราง (ไม่ได้กรอกเวลาจริง)")).toBeVisible();
});
