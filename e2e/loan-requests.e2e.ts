import { paceLogin } from "./login-pacing";
import { test, expect, type Page } from "@playwright/test";
const login=async(page:Page,username:string)=>{await page.goto("/login");await page.getByLabel("ชื่อผู้ใช้",{exact:true}).fill(username);await page.getByLabel("รหัสผ่าน",{exact:true}).fill("password");await paceLogin(); await page.getByRole("button",{name:"เข้าสู่พื้นที่ทำงาน",exact:true}).click();await expect(page).not.toHaveURL(/\/login$/);};
test("employee submits own loan request and reloads pending",async({page})=>{
 await login(page,"employee");await page.goto("/finance");
 const requests=page.getByRole("region",{name:"คำขอเงินกู้",exact:true});await expect(requests).toBeVisible();
 await requests.getByLabel("ยอดเงินที่ขอกู้",{exact:true}).fill("100.01");await requests.getByLabel("จำนวนงวดที่ขอ (1-5)",{exact:true}).fill("3");await requests.getByLabel("เหตุผลที่ขอกู้",{exact:true}).fill(`ทดสอบคำขอ ${Date.now()}`);
 const submitted=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/loan-requests"&&r.request().method()==="POST");await requests.getByRole("button",{name:"ส่งคำขอเงินกู้",exact:true}).click();const response=await submitted;expect(response.ok(),await response.text()).toBe(true);
 const row=(await response.json()).data;await page.reload();await page.getByRole("button",{name:"โหลดข้อมูลการเงิน",exact:true}).click();await expect(requests.getByTestId(`loan-request-${row.id}`)).toContainText("รอพิจารณา");await expect(requests.getByRole("button",{name:"อนุมัติเงินกู้",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:"สร้างเงินกู้",exact:true})).toHaveCount(0);
});

for(const [finance,decision] of [["hr","approve"],["admin","reject"]] as const) {
 test(`${finance} ${decision}s an employee UI request and employee sees persistent decision`,async({page,browser,baseURL})=>{
  await login(page,"employee");const own=(await (await page.request.get("/api/v1/auth/me")).json()).data.account.employee;
  await page.goto("/finance");const requests=page.getByRole("region",{name:"คำขอเงินกู้",exact:true});
  await requests.getByLabel("ยอดเงินที่ขอกู้",{exact:true}).fill("100.01");await requests.getByLabel("จำนวนงวดที่ขอ (1-5)",{exact:true}).fill("3");const reason=`UI ${finance} ${Date.now()}`;await requests.getByLabel("เหตุผลที่ขอกู้",{exact:true}).fill(reason);
  const submitted=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/loan-requests"&&r.request().method()==="POST");await requests.getByRole("button",{name:"ส่งคำขอเงินกู้",exact:true}).click();const response=await submitted;expect(response.ok(),await response.text()).toBe(true);const row=(await response.json()).data;
  const context=await browser.newContext({baseURL});const reviewer=await context.newPage();
  try {
   await login(reviewer,finance);await reviewer.goto("/finance");const picker=reviewer.getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน");await picker.fill(own.employee_code);const option=reviewer.locator("datalist option").first();await expect(option).toHaveAttribute("value",new RegExp(own.employee_code));await picker.fill((await option.getAttribute("value"))!);await reviewer.getByRole("button",{name:"โหลดข้อมูลการเงิน",exact:true}).click();
   const record=reviewer.getByTestId(`loan-request-${row.id}`);
   if(decision==="approve") {await record.getByLabel("เดือนเริ่มชำระ",{exact:true}).fill("2097-01");await record.getByRole("button",{name:"อนุมัติเงินกู้",exact:true}).click();await expect(record).toContainText("อนุมัติแล้ว ดูตารางผ่อนเงินกู้");
    const duplicate=await reviewer.request.post(`/api/v1/loan-requests/${row.id}/approve`,{data:{first_due_month:"2097-01-01"},headers:{origin:new URL(baseURL!).origin}});expect(duplicate.status()).toBe(409);
    const listed=(await (await reviewer.request.get(`/api/v1/loans?employee_id=${own.id}`)).json()).data;const approved=(await (await reviewer.request.get(`/api/v1/loan-requests?employee_id=${own.id}`)).json()).data.find((r:{id:string})=>r.id===row.id);const loan=listed.find((r:{id:string})=>r.id===approved.loan_id);expect(loan.principal_amount).toBe("100.01");expect(loan.installments.map((r:{amount:string})=>r.amount).sort()).toEqual(["33.33","33.34","33.34"]);
   } else {await record.getByLabel("เหตุผลที่ไม่อนุมัติ",{exact:true}).fill("ขอให้ส่งเอกสารเพิ่มเติม");await record.getByRole("button",{name:"ไม่อนุมัติเงินกู้",exact:true}).click();await expect(record).toContainText("ขอให้ส่งเอกสารเพิ่มเติม");}
   await reviewer.screenshot({path:`${process.env.E2E_EVIDENCE_DIR ?? "../docs/superpowers/reports"}/loan-requests-${finance}.png`,fullPage:true});
   await page.reload();await page.getByRole("button",{name:"โหลดข้อมูลการเงิน",exact:true}).click();const ownRecord=page.getByTestId(`loan-request-${row.id}`);await expect(ownRecord).toContainText(decision==="approve"?"อนุมัติแล้ว ดูตารางผ่อนเงินกู้":"ขอให้ส่งเอกสารเพิ่มเติม");
   if(decision==="approve")await expect(page.getByText("งวด 1: 2097-01-01",{exact:false}).first()).toBeVisible();
   await page.screenshot({path:`${process.env.E2E_EVIDENCE_DIR ?? "../docs/superpowers/reports"}/loan-requests-employee-${decision}.png`,fullPage:true});
  } finally {await context.close();}
 });
}
test("employee cannot forge own scope or decide and manager cannot approve",async({page,baseURL})=>{
 await login(page,"employee");const headers={origin:new URL(baseURL!).origin};const own=(await (await page.request.get("/api/v1/auth/me")).json()).data.account.employee.id;
 const forged=String(Number(own)+1);expect((await page.request.post("/api/v1/loan-requests",{headers,data:{employee_id:forged,principal_amount:"100.01",installment_count:3,reason:"denied"}})).status()).toBe(403);
 expect((await page.request.get(`/api/v1/loan-requests?employee_id=${forged}`)).status()).toBe(403);
 for(const decision of ["approve","reject"])expect((await page.request.post(`/api/v1/loan-requests/1/${decision}`,{headers,data:decision==="approve"?{first_due_month:"2097-01-01"}:{decision_note:"denied"}})).status()).toBe(403);
 await login(page,"branch_manager");expect((await page.request.post("/api/v1/loan-requests/1/approve",{headers,data:{first_due_month:"2097-01-01"}})).status()).toBe(403);
});
