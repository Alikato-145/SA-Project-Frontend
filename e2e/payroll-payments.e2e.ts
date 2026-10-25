import { paceLogin } from "./login-pacing";
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import jsQR from "jsqr";
type Fixture = {
  shopId: string;
  periodId: string;
  branches: string[];
  employees: {
    id: string;
    recordId: string;
    code: string;
    branchId: string;
    kind: string;
    amount: string;
  }[];
};
const fixture = () => JSON.parse(readFileSync(process.env.PAYMENT_FIXTURE_FILE ?? "/private/tmp/haris-task7-browser-fixture.json", "utf8")) as Fixture;
const login = async (page: Page, user: string) => { await page.goto("/login"); await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(user); await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password"); await paceLogin(); await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click(); await expect(page).not.toHaveURL(/\/login$/); };
const open = async (page: Page, f: Fixture) => { await page.goto("/payroll"); await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(f.shopId); await page.getByRole("button", { name: "เปิดสมุดงาน", exact: true }).click(); await page.getByRole("button").filter({ hasText: "10/2095" }).click(); await expect(page.getByRole("heading", { name: "เตรียมจ่ายเงินเดือนตามสาขา", exact: true })).toBeVisible(); };
// Independent implementation: no production encoder/checksum imported into browser evidence.
const checksum = (text: string) => { let sum = 65535; for (const byte of new TextEncoder().encode(text)) {
  sum ^= byte * 256;
  for (let bit = 0; bit < 8; bit++)
    sum = sum & 32768 ? (sum * 2 ^ 4129) & 65535 : sum * 2 & 65535;
} return sum.toString(16).toUpperCase().padStart(4, "0"); };
const decode = async (page: Page, amount = "123.45") => {
  const image = page.getByRole("img", { name: /PromptPay/ });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const pixels = await image.evaluate((img: HTMLImageElement) => { const c = document.createElement("canvas"); c.width = 640; c.height = 640; const ctx = c.getContext("2d")!; ctx.fillStyle = "white"; ctx.fillRect(0, 0, 640, 640); ctx.drawImage(img, 0, 0, 640, 640); return Array.from(ctx.getImageData(0, 0, 640, 640).data); });
  const decoded = jsQR(new Uint8ClampedArray(pixels), 640, 640);
  expect(decoded).not.toBeNull();
  const payload = decoded!.data;
  expect(payload).toContain("01130066812345678");
  expect(payload).toContain(`54${String(amount.length).padStart(2, "0")}${amount}`);
  expect(payload.slice(-4)).toBe(checksum(payload.slice(0, -4)));
  return payload;
};
test("HR and OWNER prepare exclusive branch groups; actual displayed QR retains frozen recipient and cents", async ({ page, baseURL }) => {
  test.setTimeout(120000);
  const f = fixture();
  const origin = new URL(baseURL!).origin;
  const transfers = f.employees.filter(e => e.kind === "transfer");
  await login(page, "hr");
  const member = f.employees.find(e => e.kind === "member")!;
  const bankResponse = await page.request.post(`/api/v1/employees/${transfers[0]!.id}/bank-accounts`, { headers: { origin }, data: { bank_code: "004", bank_name: "Frozen bank", account_holder_name: "Frozen transfer holder", account_number: "1234561234", is_primary: true } });
  expect(bankResponse.ok(), await bankResponse.text()).toBe(true);
  const transferBank = (await bankResponse.json()).data;
  expect((await page.request.put(`/api/v1/employees/${member.id}/payment-destination`, { headers: { origin }, data: { payment_method: "transfer", promptpay_phone: "0812345678" } })).ok()).toBe(true);
  await open(page, f);
  const section = page.getByRole("region", { name: "เตรียมจ่ายเงินเดือน", exact: true });
  for (const label of ["สมาชิกประกันสังคม", "เงินสด · ไม่เป็นสมาชิกประกันสังคม", "โอน PromptPay · ไม่เป็นสมาชิกประกันสังคม"])
    await expect(section.getByRole("region", { name: label, exact: true })).toBeVisible();
  expect(await section.locator("[data-payment-record]").count()).toBe(8);
  await expect(section.getByText("ยอดสุทธิเป็นศูนย์ · ไม่มีภาระจ่าย", { exact: false })).toHaveCount(2);
  await section.getByRole("combobox", { name: "สาขาสำหรับเตรียมจ่าย", exact: true }).selectOption(f.branches[0]!);
  await expect(section.locator("[data-payment-record]")).toHaveCount(4);
  await section.getByRole("button", { name: "เตรียมจ่ายสาขาที่เลือก", exact: true }).click();
  await expect(section.getByText("เตรียมจ่ายแล้ว เก็บปลายทางและยอดเงินตามข้อมูลขณะเตรียม ยังไม่ถือว่าจ่ายเงินแล้ว", { exact: true })).toBeVisible();
  await section.getByRole("button", { name: `แสดง QR ${transfers[0]!.code}`, exact: true }).click();
  const first = await decode(page);
  const rows = (await (await page.request.get(`/api/v1/payroll/periods/${f.periodId}/payments`)).json()).data;
  expect(rows.filter((r: {
    payment: unknown;
  }) => r.payment)).toHaveLength(3);
  const saved = rows.find((r: {
    employee_id: string;
  }) => r.employee_id === transfers[0]!.id);
  const qrResponse = await page.request.get(`/api/v1/payroll/payments/${saved.payment.id}/qr`);
  expect(qrResponse.headers()["cache-control"]).toBe("private, no-store");
  expect(JSON.stringify(rows)).not.toContain("ciphertext");
  await page.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/haris-task7-hr-groups-qr.png`, fullPage: true });
  await section.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/haris-task7-hr-payment-panel.png`, style: "header { visibility: hidden }" });
  await page.goto(`/employees/${transfers[0]!.id}`);
  await page.getByRole("combobox", { name: "วิธีรับเงินเดือน", exact: true }).selectOption("transfer");
  await page.getByLabel("หมายเลขรับเงินพร้อมเพย์", { exact: true }).fill("0899999999");
  await page.getByRole("button", { name: "บันทึกช่องทางรับเงิน", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "บันทึกช่องทางรับเงินแล้ว" })).toBeVisible();
  await page.getByText("แก้ข้อมูลติดต่อพนักงาน", { exact: true }).click();
  await page.locator('[name="phone"]').fill("0866666666");
  await page.getByRole("button", { name: "บันทึกข้อมูลพนักงาน", exact: true }).click();
  await expect(page.getByText("บันทึกข้อมูลพนักงานแล้ว", { exact: true })).toBeVisible();
  expect((await page.request.patch(`/api/v1/employees/${transfers[0]!.id}/bank-accounts/${transferBank.id}`, { headers: { origin }, data: { bank_code: "006", bank_name: "Live bank", account_holder_name: "Live transfer holder", account_number: "9876549999" } })).ok()).toBe(true);
  const memberBanks = (await (await page.request.get(`/api/v1/employees/${member.id}/bank-accounts`)).json()).data;
  expect((await page.request.patch(`/api/v1/employees/${member.id}/bank-accounts/${memberBanks[0].id}`, { headers: { origin }, data: { bank_code: "006", bank_name: "Live bank", account_holder_name: "Live member holder", account_number: "9876549999" } })).ok()).toBe(true);
  expect((await page.request.put(`/api/v1/employees/${member.id}/payment-destination`, { headers: { origin }, data: { payment_method: "transfer", promptpay_phone: "0899999999" } })).ok()).toBe(true);
  await open(page, f);
  const form = section.getByRole("region", { name: "ตรวจสอบการจ่ายเงิน", exact: true });
  for (const [employee, holder] of [[transfers[0]!, "Frozen transfer holder"], [member, "Payment member"]] as const) {
    const row = section.locator(`[data-payment-record="${employee.recordId}"]`);
    await row.getByRole("button", { name: "ยืนยันจ่ายเงิน", exact: true }).click();
    await expect(form.getByText(`บัญชีธนาคารที่ตรึงไว้: 004 · ${holder} · บัญชีลงท้าย 1234`, { exact: true })).toBeVisible();
    await expect(form.getByText("เบอร์ PromptPay ที่ตรึงไว้: 0812345678", { exact: true })).toBeVisible();
    await expect(form).not.toContainText("Live");
    await expect(form).not.toContainText("0899999999");
    await expect(form).not.toContainText("1234561234");
    await expect(form).not.toContainText("9876549999");
    if (employee.kind === "member") {
      await expect(row.getByRole("button", { name: /แสดง QR/ })).toHaveCount(0);
      await expect(form).toContainText("กลุ่มสมาชิกประกันสังคมใช้บัญชีธนาคารที่ตรึงไว้ ไม่มี QR สำหรับกลุ่มนี้");
    }
    await form.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/dual-destination-${employee.kind}.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await form.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/dual-destination-${employee.kind}-mobile.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await form.getByRole("button", { name: "ปิด", exact: true }).click();
  }
  await section.getByRole("button", { name: `แสดง QR ${transfers[0]!.code}`, exact: true }).click();
  expect(await decode(page)).toBe(first);
  expect((await page.request.post(`/api/v1/payroll/periods/${f.periodId}/payments/prepare?branch_id=${f.branches[0]}`, { headers: { origin }, data: {} })).ok()).toBe(true);
  await page.context().clearCookies();
  await login(page, "admin");
  await open(page, f);
  await section.getByRole("combobox", { name: "สาขาสำหรับเตรียมจ่าย", exact: true }).selectOption(f.branches[1]!);
  await expect(section.locator("[data-payment-record]")).toHaveCount(4);
  await section.getByRole("button", { name: "เตรียมจ่ายสาขาที่เลือก", exact: true }).click();
  await expect(section.getByRole("button", { name: `แสดง QR ${transfers[1]!.code}`, exact: true })).toBeVisible();
  await section.getByRole("button", { name: `แสดง QR ${transfers[1]!.code}`, exact: true }).click();
  const maximum = await decode(page, "9999999999.99");
  await page.reload();
  await open(page, f);
  await section.getByRole("button", { name: `แสดง QR ${transfers[1]!.code}`, exact: true }).click();
  expect(await decode(page, "9999999999.99")).toBe(maximum);
  await page.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/haris-task7-owner-groups-qr.png`, fullPage: true });
  await section.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/haris-task7-owner-payment-panel.png`, style: "header { visibility: hidden }" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/haris-task7-owner-groups-qr-mobile.png`, fullPage: true });
  await page.getByRole("region", { name: "QR รับเงินเดือน", exact: true }).screenshot({ path: `${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/haris-task7-owner-qr-mobile.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const prepared = (await (await page.request.get(`/api/v1/payroll/periods/${f.periodId}/payments`)).json()).data;
  expect(prepared.filter((r: {
    payment: unknown;
  }) => r.payment)).toHaveLength(6);
  expect(prepared.filter((r: {
    status: string;
  }) => r.status === "paid")).toHaveLength(0);
  console.log(JSON.stringify({ recipient: "0812345678", amount: "123.45", independently_decoded_display_payload: first, maximum_amount: "9999999999.99", independently_decoded_maximum_payload: maximum, active_payments: 6, zero_rows: 2 }));
});
test("employee supervisor and branch manager cannot read prepare or access QR directly", async ({ page, baseURL }) => {
  const f = fixture(), origin = new URL(baseURL!).origin;
  await login(page, "hr");
  const rows = (await (await page.request.get(`/api/v1/payroll/periods/${f.periodId}/payments`)).json()).data;
  const payment = rows.find((r: {
    qr_available: boolean;
  }) => r.qr_available).payment.id;
  for (const user of ["employee", "supervisor", "branch_manager"]) {
    await page.context().clearCookies();
    await login(page, user);
    expect((await page.request.get(`/api/v1/payroll/periods/${f.periodId}/payments`)).status()).toBe(403);
    expect((await page.request.post(`/api/v1/payroll/periods/${f.periodId}/payments/prepare`, { headers: { origin }, data: {} })).status()).toBe(403);
    expect((await page.request.get(`/api/v1/payroll/payments/${payment}/qr`)).status()).toBe(403);
  }
});
