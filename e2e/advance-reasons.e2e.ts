import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { paceLogin } from "./login-pacing";
async function login(page:Page,username:string,password="password") {
 await page.goto("/login");await page.getByLabel("ชื่อผู้ใช้",{exact:true}).fill(username);await page.getByLabel("รหัสผ่าน",{exact:true}).fill(password);await paceLogin();await page.getByRole("button",{name:"เข้าสู่พื้นที่ทำงาน",exact:true}).click();await expect(page).not.toHaveURL(/\/login$/);
}
for(const [finance,decision] of [["hr","reject"],["admin","approve"]] as const)test(`UC12 EMPLOYEE reason survives reload and ${finance} ${decision} persists`,async({page,browser,baseURL})=>{
 test.setTimeout(150000);
 const headers={origin:new URL(baseURL!).origin};
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const [year,month,day]=today.split("-").map(Number);
 const start=`${today.slice(0,7)}-01`,end=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10),key=`ADV_${Date.now().toString(36).toUpperCase()}_${finance}`;
 await login(page,"admin");
 const create=async(path:string,data:object)=>{const response=await page.request.post(`/api/v1${path}`,{headers,data});expect(response.ok(),`${path}: ${await response.text()}`).toBe(true);return (await response.json()).data;};
 const shop=await create("/shops",{code:key,name:"UC12 advance UAT"});
 const branch=await create("/branches",{shop_id:shop.id,code:"A",name:"Advance branch"});
 const department=await create("/departments",{branch_id:branch.id,code:"A",name:"Advance department"});
 const position=await create("/positions",{shop_id:shop.id,code:"A",name:"Advance position"});
 const onboard=await create("/employees/onboard",{employee:{employee_code:key,passport_id:key,first_name:"Advance",last_name:finance,hire_date:start},assignment:{branch_id:branch.id,department_id:department.id,position_id:position.id,employment_type:"full_time",base_salary:"30000.00",welfare_amount:"0.00",effective_from:start},account:{username:key.toLowerCase()}});
 await create("/branch-schedules",{branch_id:branch.id,work_start_time:"09:00",standard_close_time:"18:00",late_grace_minutes:0,effective_from:start});
 for(const [config_key,numeric_value,unit] of [["STANDARD_WORK_DAYS","30","days"],["ABSENCE_RATE","1","multiplier"],["LATE_RATE","0","currency_per_minute"],["SOCIAL_SECURITY_RATE","0","ratio"],["SOCIAL_SECURITY_CAP","750","currency"]])await create("/payroll/configurations",{shop_id:shop.id,config_key,numeric_value,unit,effective_from:start});
 await create("/payroll/periods",{shop_id:shop.id,period_year:year,period_month:month,start_date:start,end_date:end});
 for(let n=1;n<=day;n++){const work_date=`${today.slice(0,7)}-${String(n).padStart(2,"0")}`;await create("/work-day-records",{employee_id:onboard.employee.id,branch_id:branch.id,work_date,status:"present",clock_in_at:`${work_date}T02:00:00Z`,clock_out_at:`${work_date}T11:00:00Z`,late_minutes:0,is_deductible:false});}
 const context=await browser.newContext({baseURL});
 try {
  const employee=await context.newPage();await login(employee,key.toLowerCase(),onboard.temporary_password);await employee.goto("/finance");
  const form=employee.locator("form").filter({has:employee.getByRole("button",{name:"ส่งคำขอเงินทดรองจ่าย",exact:true})});
  const reason=form.getByLabel("เหตุผลที่ขอเงินทดรองจ่าย",{exact:true});await expect(reason).toBeVisible();await expect(reason).toHaveAttribute("maxlength","1000");
  await form.getByLabel("จำนวนเงิน",{exact:true}).fill("100.01");
  let posts=0;employee.on("request",r=>{if(new URL(r.url()).pathname==="/api/v1/advance-requests"&&r.method()==="POST")posts++;});
  await form.getByRole("button",{name:"ส่งคำขอเงินทดรองจ่าย",exact:true}).click();expect(posts).toBe(0);
  await reason.fill("   ");await form.getByRole("button",{name:"ส่งคำขอเงินทดรองจ่าย",exact:true}).click();await expect(employee.getByText("กรอกเหตุผลที่ขอเงินทดรองจ่าย 1–1000 ตัวอักษร โดยไม่เว้นว่างทั้งหมด",{exact:true})).toBeVisible();expect(posts).toBe(0);
  await reason.evaluate((node:HTMLTextAreaElement)=>node.removeAttribute("maxlength"));await reason.fill("x".repeat(1001));await form.getByRole("button",{name:"ส่งคำขอเงินทดรองจ่าย",exact:true}).click();expect(posts).toBe(0);
  for(const bad of [undefined,null,""," \t\n ","x".repeat(1001)]){const result=await employee.request.post("/api/v1/advance-requests",{headers,data:{employee_id:onboard.employee.id,amount:"100.01",...(bad===undefined?{}:{reason:bad})}});expect(result.status()).toBe(422);expect((await result.json()).error.code).toBe("VALIDATION_ERROR");}
  const reasonText=`Emergency household expenses ${key}`;await reason.fill(`  ${reasonText}  `);
  const submitted=employee.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/advance-requests"&&r.request().method()==="POST");await form.getByRole("button",{name:"ส่งคำขอเงินทดรองจ่าย",exact:true}).click();const response=await submitted;
  if(day<20){
   expect(response.status()).toBe(422);expect((await response.json()).error.code).toBe("ADVANCE_INELIGIBLE_DATE");
   await employee.reload();await employee.getByRole("button",{name:"โหลดข้อมูลการเงิน",exact:true}).click();
   const ownResponse=await employee.request.get(`/api/v1/advance-requests?employee_id=${onboard.employee.id}`);expect(ownResponse.ok()).toBe(true);expect((await ownResponse.json()).data).toEqual([]);
   console.log(JSON.stringify({businessDate:today,employee:onboard.employee.id,finance,positiveAdvance:false,reason:"Legitimate before-20 eligibility denial"}));
   return;
  }
  expect(response.ok(),await response.text()).toBe(true);const advance=(await response.json()).data;expect(advance.reason).toBe(reasonText);
  await employee.reload();await employee.getByRole("button",{name:"โหลดข้อมูลการเงิน",exact:true}).click();const own=employee.getByTestId(`advance-request-${advance.id}`);await expect(own).toContainText(reasonText);await expect(own).toContainText("รอพิจารณา");
  await employee.screenshot({path:`${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/employee-advance-${finance}-pending.png`,fullPage:true});
  expect((await employee.request.post("/api/v1/advance-requests",{headers,data:{employee_id:"99999999",amount:"100.01",reason:reasonText}})).status()).toBe(403);
  expect((await employee.request.post(`/api/v1/advance-requests/${advance.id}/reject`,{headers,data:{note:"Employee cannot decide"}})).status()).toBe(403);
  await page.context().clearCookies();await login(page,finance);await page.goto("/finance");
  const picker=page.getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน",{exact:true});await picker.fill(key);const option=page.locator("datalist option").first();await expect(option).toHaveAttribute("value",new RegExp(key));await picker.fill((await option.getAttribute("value"))!);await page.getByRole("button",{name:"โหลดข้อมูลการเงิน",exact:true}).click();
  const row=page.getByTestId(`advance-request-${advance.id}`);await expect(row).toContainText(reasonText);
  for(const bad of [undefined,null,""," \t\n ","x".repeat(1001)]){const result=await page.request.post(`/api/v1/advance-requests/${advance.id}/reject`,{headers,data:bad===undefined?{}:{note:bad}});expect(result.status()).toBe(422);expect((await result.json()).error.code).toBe("VALIDATION_ERROR");}
  const note=`Repayment capacity review ${key}`;
  if(decision==="reject"){
   const input=row.getByLabel("เหตุผลที่ไม่อนุมัติเงินทดรองจ่าย",{exact:true});await expect(input).toHaveAttribute("maxlength","1000");
   let rejectionPosts=0;page.on("request",r=>{if(new URL(r.url()).pathname===`/api/v1/advance-requests/${advance.id}/reject`&&r.method()==="POST")rejectionPosts++;});
   await row.getByRole("button",{name:"ไม่อนุมัติ",exact:true}).click();await expect(row).toContainText("รอพิจารณา");expect(rejectionPosts).toBe(0);
   await input.fill("   ");await row.getByRole("button",{name:"ไม่อนุมัติ",exact:true}).click();await expect(page.getByText("กรอกเหตุผลที่ไม่อนุมัติเงินทดรองจ่าย 1–1000 ตัวอักษร โดยไม่เว้นว่างทั้งหมด",{exact:true})).toBeVisible();expect(rejectionPosts).toBe(0);
   await input.evaluate((node:HTMLInputElement)=>node.removeAttribute("maxlength"));await input.fill("x".repeat(1001));await row.getByRole("button",{name:"ไม่อนุมัติ",exact:true}).click();await expect(row).toContainText("รอพิจารณา");expect(rejectionPosts).toBe(0);
   await input.fill(`  ${note}  `);
  }
  const decided=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/v1/advance-requests/${advance.id}/${decision}`);await row.getByRole("button",{name:decision==="approve"?"อนุมัติ":"ไม่อนุมัติ",exact:true}).click();const decisionResponse=await decided;expect(decisionResponse.ok(),await decisionResponse.text()).toBe(true);
  await page.reload();await picker.fill(key);const reloadedOption=page.locator("datalist option").first();await expect(reloadedOption).toHaveAttribute("value",new RegExp(key));await picker.fill((await reloadedOption.getAttribute("value"))!);await page.getByRole("button",{name:"โหลดข้อมูลการเงิน",exact:true}).click();await expect(row).toContainText(reasonText);await expect(row).toContainText(decision==="approve"?"อนุมัติแล้ว":"ไม่อนุมัติ");if(decision==="reject")await expect(row).toContainText(note);
  await employee.reload();await employee.getByRole("button",{name:"โหลดข้อมูลการเงิน",exact:true}).click();await expect(own).toContainText(reasonText);await expect(own).toContainText(decision==="approve"?"อนุมัติแล้ว":"ไม่อนุมัติ");if(decision==="reject")await expect(own).toContainText(note);
  await employee.screenshot({path:`${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/employee-advance-${finance}-${decision}.png`,fullPage:true});await page.screenshot({path:`${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/finance-advance-${finance}-${decision}.png`,fullPage:true});
  if(finance === "hr" && process.env.UC12_LEGACY_FIXTURE_FILE) {
   const legacy = JSON.parse(readFileSync(process.env.UC12_LEGACY_FIXTURE_FILE,"utf8")) as {key:string;employee:string;advance:string};
   await picker.fill(legacy.key);const legacyOption=page.locator("datalist option").first();await expect(legacyOption).toHaveAttribute("value",new RegExp(legacy.key));await picker.fill((await legacyOption.getAttribute("value"))!);await page.getByRole("button",{name:"โหลดข้อมูลการเงิน",exact:true}).click();
   const legacyRow=page.getByTestId(`advance-request-${legacy.advance}`);await expect(legacyRow).toContainText("รายการเดิม: ไม่ได้บันทึกเหตุผลที่ขอ");await expect(legacyRow).toContainText("Legacy request declined after documented review");
   await page.screenshot({path:`${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/finance-legacy-null-reason.png`,fullPage:true});console.log(JSON.stringify({legacyUI:legacy}));
  }
  console.log(JSON.stringify({businessDate:today,employee:onboard.employee.id,account:onboard.account_id,advance:advance.id,reason:reasonText,finance,decision,note:decision==="reject"?note:null}));
 } finally {await context.close();}
});
