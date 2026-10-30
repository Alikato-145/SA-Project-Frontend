import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { paceLogin } from "./login-pacing";
const fixture = process.env.PAYABLE_REPORT_FIXTURE_FILE ? JSON.parse(readFileSync(process.env.PAYABLE_REPORT_FIXTURE_FILE, "utf8")) as { shopId:string; periodId:string; branches:string[]; employees:{id:string;code:string;bankId:string|null}[] } : null;
test("report UC10 and UC12 expose locked bank export and per-employee branch CSV", async ({page,baseURL}) => {
  test.skip(!fixture, "Requires disposable payroll report fixture");
  if (!fixture) return;
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้",{exact:true}).fill("hr");
  await page.getByLabel("รหัสผ่าน",{exact:true}).fill("password");
  await paceLogin(); await page.getByRole("button",{name:"เข้าสู่พื้นที่ทำงาน",exact:true}).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto("/reports");
  await page.getByRole("combobox",{name:"ร้าน",exact:true}).selectOption(fixture.shopId);
  await page.getByRole("combobox",{name:"งวดเงินเดือน",exact:true}).selectOption(fixture.periodId);
  await page.getByRole("button",{name:"ไฟล์โอนเงินธนาคาร (CSV)",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"บัญชีธนาคารหลัก"})).toBeVisible();
  for (const employee of fixture.employees.filter(item => item.bankId === null)) {
    const added = await page.request.post(`/api/v1/employees/${employee.id}/bank-accounts`, { headers: { origin: new URL(baseURL!).origin }, data: { bank_code:"004", bank_name:"Test", account_holder_name:"Test Employee", account_number:"0000001234", is_primary:true } });
    expect(added.ok(), await added.text()).toBe(true);
  }
  const bankResponse=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/reports/period-bank-transfer.csv");
  const bankFile=page.waitForEvent("download");
  await page.getByRole("button",{name:"ไฟล์โอนเงินธนาคาร (CSV)",exact:true}).click();
  expect((await bankResponse).status()).toBe(200);
  const bankPath=await (await bankFile).path();expect(readFileSync(bankPath!,"utf8")).toContain("11400.00");
  await page.getByRole("combobox",{name:"สาขา",exact:true}).selectOption(fixture.branches[0]!);
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/reports/employee-salary.csv");
  const download=page.waitForEvent("download");
  await page.getByRole("button",{name:"ส่งออกรายชื่อและยอดเงินเดือน (CSV)",exact:true}).click();
  expect((await response).status()).toBe(200);
  const path=await (await download).path();expect(path).toBeTruthy();
  const csv=readFileSync(path!,"utf8");expect(csv).toContain(fixture.employees[0]!.code);expect(csv).not.toContain(fixture.employees[3]!.code);
  const socialResponse=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/reports/social-security.csv");
  const socialFile=page.waitForEvent("download");
  await page.getByRole("button",{name:"รายงานประกันสังคม (CSV)",exact:true}).click();
  const social=await socialResponse;expect(social.status()).toBe(200);expect(new URL(social.url()).searchParams.get("branch_id")).toBeNull();
  const socialPath=await (await socialFile).path();const socialCsv=readFileSync(socialPath!,"utf8");expect(socialCsv).toContain(fixture.employees[0]!.code);expect(socialCsv).toContain(fixture.employees[3]!.code);
});
