import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { paceLogin } from "./login-pacing";

test("HR changes an unprepared employee destination inside payroll and sees the new group", async ({ page }) => {
  const f = JSON.parse(readFileSync(process.env.PAYMENT_FIXTURE_FILE!, "utf8")) as { shopId: string; branches: string[]; employees: { id: string; recordId: string; kind: string }[] };
  const employee = f.employees.find(item => item.kind === "cash")!;
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("hr");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto("/payroll");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(f.shopId);
  await page.getByRole("button", { name: "เปิดสมุดงาน", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "10/2095" }).click();
  const section = page.getByRole("region", { name: "เตรียมจ่ายเงินเดือน", exact: true });
  const row = section.locator(`[data-payment-record="${employee.recordId}"]`);
  await row.getByRole("button", { name: "เลือกช่องทางรับเงิน" }).click();
  await row.getByRole("combobox", { name: "วิธีรับเงินเดือน" }).selectOption("transfer");
  await row.getByLabel("หมายเลขรับเงินพร้อมเพย์").fill("0812345678");
  await row.getByRole("button", { name: "บันทึกช่องทางรับเงิน" }).click();
  await expect(section.getByText("บันทึกช่องทางรับเงินแล้ว กรุณาตรวจกลุ่มและปลายทางก่อนเตรียมจ่าย")).toBeVisible();
  await expect(section.getByRole("region", { name: "โอน PromptPay · ไม่เป็นสมาชิกประกันสังคม" }).locator(`[data-payment-record="${employee.recordId}"]`)).toBeVisible();
  const saved = await page.request.get(`/api/v1/employees/${employee.id}/payment-destination`);
  expect((await saved.json()).data).toMatchObject({ payment_method: "transfer", promptpay_phone: "0812345678" });
});
