import { paceLogin } from "./login-pacing";
import {test,expect,type Page} from "@playwright/test";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
const f=JSON.parse(readFileSync(process.env.PAYABLE_REPORT_FIXTURE_FILE??"/private/tmp/haris-task9-browser-fixture.json","utf8"))as{shopId:string;periodId:string;branches:string[];departments:string[];employees:{id:string;recordId:string;code:string;bankId:string|null}[]};
const evidence=process.env.PAYABLE_REPORT_EVIDENCE_DIR??"/private/tmp/haris-task9-evidence";
const login=async(page:Page,user:string)=>{await page.goto("/login");await page.getByLabel("ชื่อผู้ใช้",{exact:true}).fill(user);await page.getByLabel("รหัสผ่าน",{exact:true}).fill("password");await paceLogin(); await page.getByRole("button",{name:"เข้าสู่พื้นที่ทำงาน",exact:true}).click();await expect(page).not.toHaveURL(/\/login$/);};
const open=async(page:Page)=>{await page.goto("/reports");await page.getByRole("combobox",{name:"ร้าน",exact:true}).selectOption(f.shopId);await page.getByRole("combobox",{name:"งวดเงินเดือน",exact:true}).selectOption(f.periodId);};
test("HR and OWNER download both locked salary PDFs with selected filters, reload and role denials",async({page,baseURL})=>{
 test.setTimeout(120000);mkdirSync(evidence,{recursive:true});const origin=new URL(baseURL!).origin;
 const download=async(user:string,kind:"salary"|"creditor",suffix:string,branch?:string,department?:string)=>{
  const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/v1/reports/${kind}-summary.pdf`,{timeout:20000});
  const saved=page.waitForEvent("download",{timeout:20000});await page.getByRole("button",{name:kind==="salary"?"สรุปเงินเดือน (PDF)":"สรุปเจ้าหนี้เงินเดือน (PDF)",exact:true}).click();const r=await response;expect(r.status()).toBe(200);expect(r.headers()["content-type"]).toBe("application/pdf");expect(r.headers()["cache-control"]).toBe("private, no-store");expect(new URL(r.url()).searchParams.get("branch_id")).toBe(branch??null);expect(new URL(r.url()).searchParams.get("department_id")).toBe(department??null);const file=`${evidence}/${user}-${kind}-${suffix}.pdf`;await(await saved).saveAs(file);expect(readFileSync(file).subarray(0,5).toString()).toBe("%PDF-");
 };
 for(const user of["hr","admin"]){await page.context().clearCookies();await login(page,user);await open(page);await page.getByText("ตัวเลือกเพิ่มเติม: รายงาน PDF และไฟล์ที่เตรียมจ่ายแล้ว",{exact:true}).click();
  await download(user,"salary","all");await download(user,"creditor","all");
  await page.getByRole("combobox",{name:"สาขา",exact:true}).selectOption(f.branches[1]!);await page.getByRole("combobox",{name:"แผนก",exact:true}).selectOption(f.departments[1]!);
  await download(user,"salary","filtered",f.branches[1],f.departments[1]);await download(user,"creditor","filtered",f.branches[1],f.departments[1]);
  await page.reload();await open(page);await page.getByText("ตัวเลือกเพิ่มเติม: รายงาน PDF และไฟล์ที่เตรียมจ่ายแล้ว",{exact:true}).click();await download(user,"salary","reload");await download(user,"creditor","reload");
  await page.screenshot({path:`${evidence}/${user}-reports-desktop.png`,fullPage:true,style:"nextjs-portal { visibility: hidden }"});await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${evidence}/${user}-reports-mobile.png`,fullPage:true,style:"nextjs-portal { visibility: hidden }"});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1280,height:900});
 }
 // Unprepared records must give an actionable UI error, never a partial successful CSV.
 await page.getByRole("button",{name:"ไฟล์โอนเงินที่เตรียมจ่ายแล้ว (CSV)",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"เตรียมจ่าย"})).toContainText("เตรียมจ่าย");
 const prepared=await page.request.post(`/api/v1/payroll/periods/${f.periodId}/payments/prepare`,{headers:{origin},data:{}});expect(prepared.status(),await prepared.text()).toBe(200);
 await page.getByRole("button",{name:"ไฟล์โอนเงินที่เตรียมจ่ายแล้ว (CSV)",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"QR"})).toContainText("QR");
 // Live bank edits must not change the already prepared bank export.
 const changedBank=await page.request.patch(`/api/v1/employees/${f.employees[0]!.id}/bank-accounts/${f.employees[0]!.bankId}`,{headers:{origin},data:{bank_code:"006",account_number:"1111119999"}});expect(changedBank.status(),await changedBank.text()).toBe(200);
 for(const user of ["hr","admin"]){
  await page.context().clearCookies();await login(page,user);await open(page);await page.getByText("ตัวเลือกเพิ่มเติม: รายงาน PDF และไฟล์ที่เตรียมจ่ายแล้ว",{exact:true}).click();
  await page.getByRole("combobox",{name:"สาขา",exact:true}).selectOption(f.branches[0]!);
  for(const kind of ["bank-transfer","social-security"]){
   const exported=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/v1/reports/${kind}.csv`);
   const saved=page.waitForEvent("download");
   await page.getByRole("button",{name:kind==="bank-transfer"?"ไฟล์โอนเงินที่เตรียมจ่ายแล้ว (CSV)":"รายงานประกันสังคมตามตัวกรอง (CSV)",exact:true}).click();
   const response=await exported;expect(response.status()).toBe(200);expect(new URL(response.url()).searchParams.get("branch_id")).toBe(f.branches[0]);
   const file=`${evidence}/${user}-${kind}.csv`;await(await saved).saveAs(file);const csv=readFileSync(file,"utf8");
   if(kind==="bank-transfer"){expect(csv.trim().split(/\r?\n/)).toHaveLength(3);expect(csv).toContain('"004","0000001234"');expect(csv).toContain('"11400.00"');expect(csv).toContain('"3800.00"');expect(csv).not.toContain("1111119999");}
   else {expect(csv).toContain('"12000.00","600.00"');expect(csv).toContain('"4000.00","200.00"');expect(csv).not.toContain('"30000.00"');}
  }
 }
 const records=(await(await page.request.get(`/api/v1/payroll/periods/${f.periodId}`)).json()).data.records;expect(records.reduce((n:bigint,r:{net_pay:string})=>n+BigInt(r.net_pay.replace(".","")),BigInt(0))).toBe(BigInt(3180000));
 const slip=await page.request.post(`/api/v1/payslips/payroll-records/${f.employees[0]!.recordId}`,{headers:{origin},data:{}});expect(slip.status(),await slip.text()).toBe(200);const slipData=(await slip.json()).data;expect(slipData).toMatchObject({payroll_record_id:f.employees[0]!.recordId,total_earnings:"12000.00",total_deductions:"600.00",net_pay:"11400.00"});expect(records.find((r:{id:string})=>r.id===f.employees[0]!.recordId)).toMatchObject({total_earnings:"12000.00",total_deductions:"600.00",net_pay:"11400.00"});const slipId=slipData.id;const slipPdf=await page.request.get(`/api/v1/payslips/${slipId}/download`);expect(slipPdf.status()).toBe(200);expect((await slipPdf.body()).subarray(0,5).toString()).toBe("%PDF-");await slipPdf.body().then(b=>writeFileSync(`${evidence}/individual-payslip.pdf`,b));
 for(const user of["employee","supervisor","branch_manager"]){await page.context().clearCookies();await login(page,user);for(const kind of["salary-summary.pdf","creditor-summary.pdf","bank-transfer.csv","social-security.csv"])expect((await page.request.get(`/api/v1/reports/${kind}?period_id=${f.periodId}`)).status()).toBe(403);}
 console.log(JSON.stringify({period:f.periodId,locked_totals:{earnings:"33000.00",deductions:"1200.00",net:"31800.00"},individual_record:f.employees[0]!.recordId,payslip:slipId}));
});
