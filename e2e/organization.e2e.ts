import { paceLogin } from "./login-pacing";
import { test, expect } from "@playwright/test";

test("organization duplicate codes, pagination and child-first archival preserve history", async ({ page, baseURL }) => {
  test.setTimeout(90000);
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("admin");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin(); await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  const origin = new URL(baseURL!).origin;
  const suffix = `ORG_${Date.now().toString(36).toUpperCase()}`;
  const create = async (path: string, data: unknown) => {
    const response = await page.request.post(`/api/v1/${path}`, { data, headers: { origin } });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()).data as { id: string };
  };
  const shopBody = { code: `${suffix}_00`, name: "Organization lifecycle" };
  const shop = await create("shops", shopBody);
  const branchBody = { shop_id: shop.id, code: "BR", name: "Lifecycle branch" };
  const branch = await create("branches", branchBody);
  const departmentBody = { branch_id: branch.id, code: "TEAM", name: "Lifecycle department" };
  const department = await create("departments", departmentBody);
  const positionBody = { shop_id: shop.id, code: "STAFF", name: "Lifecycle position" };
  const position = await create("positions", positionBody);
  for (const [path, data] of [["shops", shopBody], ["branches", branchBody], ["departments", departmentBody], ["positions", positionBody]] as const) {
    const duplicate = await page.request.post(`/api/v1/${path}`, { data, headers: { origin } });
    expect(duplicate.status()).toBe(409);
    expect((await duplicate.json()).error.code).toBe("DUPLICATE_CODE");
  }
  for (let index = 1; index <= 20; index++) {
    await create("shops", { code: `${suffix}_${String(index).padStart(2, "0")}`, name: "Pagination fixture" });
  }
  await page.goto("/organization");
  await page.getByLabel("ค้นหารหัสหรือชื่อ", { exact: true }).fill(suffix);
  await expect(page.getByText("หน้า 1 · รวม 21 รายการ", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await expect(page.getByText("หน้า 2 · รวม 21 รายการ", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("ค้นหารหัสหรือชื่อ", { exact: true }).fill(shopBody.code);
  const row = page.getByRole("row").filter({ hasText: shopBody.code });
  await row.getByRole("button", { name: "ปิดใช้งาน", exact: true }).click();
  await page.getByLabel(/^เหตุผล/).fill("Synthetic child-first archival");
  await page.getByRole("button", { name: "ยืนยันปิดใช้งาน", exact: true }).click();
  await expect(page.getByText("ปิดใช้งานสาขาและตำแหน่งที่อยู่ในร้านก่อนปิดร้าน", { exact: true })).toBeVisible();
  const close = (path: string, id: string) => page.request.post(`/api/v1/${path}/${id}/deactivate`, { data: { reason: "Synthetic child-first archival" }, headers: { origin } });
  expect((await close("branches", branch.id)).status()).toBe(409);
  expect((await close("departments", department.id)).ok()).toBe(true);
  expect((await close("branches", branch.id)).ok()).toBe(true);
  expect((await close("shops", shop.id)).status()).toBe(409); // Position is also a child of the shop.
  expect((await close("positions", position.id)).ok()).toBe(true);
  await page.getByRole("button", { name: "ยืนยันปิดใช้งาน", exact: true }).click();
  await expect(page.getByText("ปิดใช้งานร้านแล้ว ข้อมูลเดิมยังคงอยู่ในประวัติ", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "สถานะ", exact: true }).selectOption("false");
  await expect(page.getByRole("row").filter({ hasText: shopBody.code })).toBeVisible();
  expect((await close("shops", shop.id)).status()).toBe(409);
  const invalidChild = await page.request.post("/api/v1/branches", { data: { ...branchBody, code: "AFTER_CLOSE" }, headers: { origin } });
  expect(invalidChild.status()).toBe(409);
  for (const [path, id] of [["shops", shop.id], ["branches", branch.id], ["departments", department.id], ["positions", position.id]]) {
    const historical = await page.request.get(`/api/v1/${path}/${id}`);
    expect(historical.ok(), await historical.text()).toBe(true);
    expect((await historical.json()).data.is_active).toBe(false);
  }
});
