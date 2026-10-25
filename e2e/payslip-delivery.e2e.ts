import { paceLogin } from "./login-pacing";
import { createMailbox } from "./mailbox";
import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { AuthenticatedActor } from "../lib/auth/auth-api";

type Employee = { id: string; recordId: string; username: string; role: string; earnings: string; deductions: string; net: string; base: string; code: string };
type Slip = { id: string; payroll_record_id: string; employee_id: string; total_earnings: string; total_deductions: string; net_pay: string };
type Attempt = { id: string; recipient_email: string; status: string; attempted_at: string };
const fixture = JSON.parse(readFileSync(process.env.PAYSLIP_FIXTURE_FILE ?? "../docs/superpowers/reports/payslip-email-evidence/browser-fixture.json", "utf8")) as {
  key: string; shopId: string; periodId: string; employees: Employee[];
  report: { branches: { rows: { recordId: number; earnings: string; deductions: string; net: string }[] }[]; totals: { earnings: string; deductions: string; net: string; paid: string; outstanding: string } };
};
const evidence = process.env.PAYSLIP_EVIDENCE_DIR ?? "../docs/superpowers/reports/payslip-email-evidence";
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const slips: Slip[] = [];
const pdfs: Buffer[] = [];
const attempts: Attempt[] = [];

async function login(page: Page, username: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin(); await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  const actor = (await (await page.request.get("/api/v1/auth/me")).json()).data as AuthenticatedActor;
  return actor;
}

async function openSlip(page: Page, employee: Employee): Promise<Slip> {
  await page.goto("/payslips");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(fixture.shopId);
  await page.getByRole("combobox", { name: "งวดเงินเดือน", exact: true }).selectOption(fixture.periodId);
  await page.getByRole("combobox", { name: "พนักงาน", exact: true }).selectOption(employee.recordId);
  const response = page.waitForResponse(r => new URL(r.url()).pathname === `/api/v1/payslips/payroll-records/${employee.recordId}` && r.request().method() === "POST");
  await page.getByRole("button", { name: "ออกหรือเปิดสลิป", exact: true }).click();
  const result = await response;
  expect(result.status(), await result.text()).toBe(200);
  const slip = (await result.json()).data as Slip;
  await expect(page.getByRole("heading", { name: `สลิป #${slip.id}`, exact: true })).toBeVisible();
  expect(slip).toMatchObject({ payroll_record_id: employee.recordId, employee_id: employee.id, total_earnings: employee.earnings, total_deductions: employee.deductions, net_pay: employee.net });
  const projection = fixture.report.branches.flatMap(b => b.rows).find(r => String(r.recordId) === employee.recordId)!;
  expect({ earnings: projection.earnings, deductions: projection.deductions, net: projection.net }).toEqual({ earnings: slip.total_earnings, deductions: slip.total_deductions, net: slip.net_pay });
  return slip;
}

async function download(page: Page, filename: string): Promise<Buffer> {
  const response = page.waitForResponse(r => /\/api\/v1\/payslips\/\d+\/download$/.test(new URL(r.url()).pathname));
  const saved = page.waitForEvent("download");
  await page.getByRole("button", { name: "ดาวน์โหลด PDF", exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  expect(result.headers()["content-type"]).toBe("application/pdf");
  expect(result.headers()["cache-control"]).toBe("private, no-store");
  const file = `${evidence}/${filename}.pdf`;
  await (await saved).saveAs(file);
  const bytes = readFileSync(file);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  // Chromium may expose an empty body for the download response; read the stored PDF independently.
  const stored = await page.request.get(result.url());
  expect(stored.status()).toBe(200);
  expect(bytes.equals(await stored.body())).toBe(true);
  return bytes;
}

test.describe.serial("locked payslip UI and local email regression", () => {
  test("HR and OWNER each generate/download/send with frozen decimals and durable attempts", async ({ page }) => {
    const mailbox = createMailbox(page.request);
    test.setTimeout(150000);
    mkdirSync(evidence, { recursive: true });
    expect(fixture.report.totals).toMatchObject({ earnings: "19100.65", deductions: "950.00", net: "18150.65", paid: "0.00", outstanding: "18150.65" });
    const proofs = [];
    for (const [index, username, role] of [[0, "hr", "HR"], [1, "admin", "OWNER"]] as const) {
      const actor = await login(page, username);
      expect(actor.grants.map((g: { role_code: string }) => g.role_code)).toEqual([role]);
      const employee = fixture.employees[index]!;
      const records = (await (await page.request.get(`/api/v1/payroll/periods/${fixture.periodId}`)).json()).data.records;
      expect(records.find((r: { id: string }) => r.id === employee.recordId)).toMatchObject({ status: "locked", total_earnings: employee.earnings, total_deductions: employee.deductions, net_pay: employee.net });
      slips[index] = await openSlip(page, employee);
      pdfs[index] = await download(page, `${role}-original`);
      const recipient = `${fixture.key.toLowerCase()}-${role.toLowerCase()}-${Date.now()}@example.test`;
      // A lost submit, hidden history, wrong attachment, or cross-actor permission regression fails here.
      const response = page.waitForResponse(r => new URL(r.url()).pathname === `/api/v1/payslips/${slips[index]!.id}/deliveries` && r.request().method() === "POST");
      await page.getByLabel("อีเมลผู้รับ", { exact: true }).fill(recipient);
      await page.getByRole("button", { name: "ส่งสลิป", exact: true }).click();
      const result = await response;
      expect(result.status(), await result.text()).toBe(200);
      const attempt = (await result.json()).data as Attempt;
      expect(attempt).toMatchObject({ recipient_email: recipient, status: "sent" });
      attempts.push(attempt);
      await expect(page.getByText("SMTP รับข้อความแล้ว ตรวจสอบประวัติการส่งได้ด้านล่าง", { exact: true })).toBeVisible();
      let messageId = "";
      await expect.poll(async () => {
        const inbox = await (await mailbox.messages()).json();
        messageId = inbox.messages.find((m: { MessageID: string }) => m.MessageID === `payslip-attempt-${attempt.id}@haris-payroll.local`)?.ID ?? "";
        return Boolean(messageId);
      }).toBe(true);
      const message = await (await mailbox.message(messageId)).json();
      expect(message.To.map((to: { Address: string }) => to.Address)).toEqual([recipient]);
      expect(message.Text).toContain("ไม่ใช่หลักฐานการโอนหรือจ่ายเงิน");
      expect(message.Attachments).toHaveLength(1);
      expect(message.Attachments[0]).toMatchObject({ FileName: `payslip-${employee.recordId}.pdf`, ContentType: "application/pdf" });
      const attachment = await mailbox.attachment(messageId, message.Attachments[0].PartID);
      expect(attachment.status()).toBe(200);
      expect((await attachment.body()).equals(pdfs[index]!)).toBe(true);
      await attachment.body().then(bytes => writeFileSync(`${evidence}/${role}-mail-attachment.pdf`, bytes));
      await page.reload();
      expect((await openSlip(page, employee)).id).toBe(slips[index]!.id);
      expect((await download(page, `${role}-reload`)).equals(pdfs[index]!)).toBe(true);
      const history = (await (await page.request.get(`/api/v1/payslips/${slips[index]!.id}/deliveries`)).json()).data;
      expect(history.find((a: Attempt) => a.id === attempt.id)).toEqual(attempt);
      await expect(page.getByRole("listitem").filter({ hasText: recipient })).toBeVisible();
      await page.screenshot({ path: `${evidence}/${role}-payslip-history.png`, fullPage: true, style: "nextjs-portal { visibility: hidden }" });
      proofs.push({ actor: role, slip: slips[index], attempt, smtpAccepted: true, localInboxReceived: true, messageId, attachmentSha256: sha256(await attachment.body()), downloadSha256: sha256(pdfs[index]!) });
    }
    expect(attempts[0]!.id).not.toBe(attempts[1]!.id);
    // HR opens two extra linked slips so scoped actors can prove self-read without elevated grants.
    await login(page, "hr");
    for (const index of [2, 3]) { slips[index] = await openSlip(page, fixture.employees[index]!); pdfs[index] = await download(page, `scoped-${index}`); }
    const paymentRows = (await (await page.request.get(`/api/v1/payroll/periods/${fixture.periodId}/payments`)).json()).data;
    expect(paymentRows.every((r: { status: string }) => r.status === "unprepared")).toBe(true);
    const csv = await (await page.request.get(`/api/v1/reports/social-security.csv?period_id=${fixture.periodId}`)).text();
    for (const employee of fixture.employees) expect(csv).toContain(`"${employee.base}","${employee.deductions}"`);
    writeFileSync(`${evidence}/delivery-proof.json`, JSON.stringify({ period: fixture.periodId, proofs, slips, allPaymentsUnprepared: true, reportTotals: fixture.report.totals }, null, 2));
  });

  test("employees and scoped actors see/download only their own slips and cannot administer", async ({ page, baseURL, playwright }) => {
    test.setTimeout(120000);
    const origin = new URL(baseURL!).origin;
    for (const [index, employee] of fixture.employees.entries()) {
      const actor = await login(page, employee.username);
      expect(actor.account.employee?.id).toBe(employee.id);
      expect(actor.grants.map((g: { role_code: string }) => g.role_code)).toEqual([employee.role]);
      await page.getByRole("link", { name: "สลิปเงินเดือน", exact: true }).click();
      await expect(page).toHaveURL(/\/payslips$/);
      await expect(page.getByRole("heading", { name: "สลิปเงินเดือนของฉัน", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "ออกหรือเปิดสลิป", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "ส่งสลิป", exact: true })).toHaveCount(0);
      expect((await (await page.request.get("/api/v1/payslips/mine")).json()).data.map((s: Slip) => s.id)).toEqual([slips[index]!.id]);
      expect((await page.request.get(`/api/v1/payslips/${slips[index]!.id}`)).status()).toBe(200);
      expect((await download(page, `own-${employee.role}-${index}`)).equals(pdfs[index]!)).toBe(true);
      const other = slips[index === 0 ? 1 : 0]!;
      for (const suffix of ["", "/download", "/deliveries"]) expect((await page.request.get(`/api/v1/payslips/${other.id}${suffix}`)).status()).toBe(403);
      expect((await page.request.post(`/api/v1/payslips/${other.id}/deliveries`, { headers: { origin }, data: { recipient_email: "denied@example.test" } })).status()).toBe(403);
      expect((await page.request.post(`/api/v1/payslips/payroll-records/${employee.recordId}`, { headers: { origin }, data: {} })).status()).toBe(403);
      expect((await page.request.post(`/api/v1/payslips/${slips[index]!.id}/deliveries`, { headers: { origin }, data: { recipient_email: "denied@example.test" } })).status()).toBe(403);
      await page.screenshot({ path: `${evidence}/own-${employee.role}-${index}.png`, fullPage: true, style: "nextjs-portal { visibility: hidden }" });
    }
    const anonymous = await playwright.request.newContext({ baseURL });
    try { expect((await anonymous.get(`/api/v1/payslips/${slips[0]!.id}/download`)).status()).toBe(401); }
    finally { await anonymous.dispose(); }
  });
});
