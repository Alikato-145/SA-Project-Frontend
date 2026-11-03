import { expect, test } from "@playwright/test";
import { paceLogin } from "./login-pacing";

async function login(page: import("@playwright/test").Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("linked employee sees own overview and latest generated salary", async ({ page }) => {
  await login(page, "employee");
  const actor = (await (await page.request.get("/api/v1/auth/me")).json()).data;
  const id = actor.account.employee.id;
  await page.route("**/api/v1/payslips/mine", async (route) => route.fulfill({ json: { data: [
    { id: "1", payroll_record_id: "1", employee_id: id, status: "generated", generated_at: "2026-09-01T00:00:00Z", total_earnings: "10000", total_deductions: "500", net_pay: "9500" },
    { id: "2", payroll_record_id: "2", employee_id: id, status: "generated", generated_at: "2026-10-01T00:00:00Z", total_earnings: "20000", total_deductions: "750", net_pay: "19250" },
    { id: "3", payroll_record_id: "3", employee_id: "999999", status: "generated", generated_at: "2026-11-01T00:00:00Z", total_earnings: "99999", total_deductions: "0", net_pay: "99999" },
  ], request_id: "dashboard-fixture" } }));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: actor.account.employee.display_name, exact: true })).toBeVisible();
  await expect(page.getByText("DEMO-EMPLOYEE", { exact: false })).toBeVisible();
  await expect(page.getByText(/19,250\.00/)).toBeVisible();
  await expect(page.getByText(/99,999\.00/)).toHaveCount(0);
  await expect(page.getByText("ประเภทการรับเงินปัจจุบัน:")).toBeVisible();
  await page.screenshot({ path: "/private/tmp/haris-overview-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/private/tmp/haris-overview-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("account without an employee shows an honest empty state", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/dashboard");
  await expect(page.getByText(/บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลพนักงาน/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "เงินเดือนของฉัน" })).toHaveCount(0);
});
