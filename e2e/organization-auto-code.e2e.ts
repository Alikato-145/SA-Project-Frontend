import { test, expect } from "@playwright/test";
import { paceLogin } from "./login-pacing";

test("creates each organization type without entering a code", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("admin");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto("/organization");
  const suffix = String(Date.now());
  for (const item of [
    { tab: "ร้าน", path: "shops", parent: null },
    { tab: "สาขา", path: "branches", parent: "ร้าน" },
    { tab: "แผนก", path: "departments", parent: "สาขา" },
    { tab: "ตำแหน่ง", path: "positions", parent: "ร้าน" },
  ]) {
    await page.getByRole("tab", { name: item.tab, exact: true }).click();
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: `เพิ่ม${item.tab}`, exact: true }) });
    await expect(form.getByLabel("รหัส", { exact: true })).toHaveCount(0);
    await form.getByLabel("ชื่อ", { exact: true }).fill(`${item.tab} ${suffix}`);
    if (item.parent) {
      const select = form.locator("select");
      await select.selectOption({ index: 1 });
    }
    const responsePromise = page.waitForResponse(response => response.url().endsWith(`/api/v1/${item.path}`) && response.request().method() === "POST");
    await form.getByRole("button", { name: `เพิ่ม${item.tab}`, exact: true }).click();
    const response = await responsePromise;
    expect(response.ok(), await response.text()).toBe(true);
    const record = (await response.json()).data;
    expect(record.code).toBe(record.id);
    await expect(page.getByText(`เพิ่ม${item.tab}แล้ว`, { exact: true })).toBeVisible();
  }
  await page.goto("/settings");
  await expect(page.getByLabel("รหัสร้าน", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("รหัสสาขา", { exact: true })).toHaveCount(0);
});
