import { expect, test, type Page } from "@playwright/test";
import { paceLogin } from "./login-pacing";

async function login(page: Page, username: string, password = "password") {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await paceLogin();
  await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test("UC08 EMPLOYEE quota rejection leaves no request; valid submit/reload and invalid pending edit preserve facts before approval", async ({ page, browser, baseURL }) => {
  test.setTimeout(120000);
  const headers = { origin: new URL(baseURL!).origin };
  const key = `QUOTA_${Date.now().toString(36).toUpperCase()}`;
  const start = "2038-02-01", end = "2038-02-02";
  await login(page,"admin");
  const create = async (path: string, data: object) => {
    const response = await page.request.post(`/api/v1${path}`,{headers,data});
    expect(response.ok(),`${path}: ${await response.text()}`).toBe(true);
    return (await response.json()).data;
  };
  const shop = await create("/shops",{code:key,name:"UC08 quota UAT"});
  const branch = await create("/branches",{shop_id:shop.id,code:"Q",name:"Quota branch"});
  const department = await create("/departments",{branch_id:branch.id,code:"Q",name:"Quota department"});
  const position = await create("/positions",{shop_id:shop.id,code:"Q",name:"Quota position"});
  const onboard = await create("/employees/onboard",{
    employee:{employee_code:key,passport_id:key,first_name:"Quota",last_name:"Employee",hire_date:"2020-01-01"},
    assignment:{branch_id:branch.id,department_id:department.id,position_id:position.id,employment_type:"full_time",base_salary:"30000.00",welfare_amount:"0.00",effective_from:"2020-01-01"},
    account:{username:key.toLowerCase()},
  });
  await create(`/accounts/${onboard.account_id}/roles`,{role_code:"EMPLOYEE",reason:"UC08 disposable quota verification"});
  const type = await create("/leave-types",{code:key,name_th:key,quota_type:"fixed",quota_days:"1",is_deductible:false,requires_document:false,allow_exceed:false,is_active:true});
  expect((await page.request.put("/api/v1/leave-quotas",{headers,data:{employee_id:onboard.employee.id,leave_type_id:type.id,quota_year:2038,entitled_days:"1"}})).ok()).toBe(true);
  const context = await browser.newContext({baseURL});
  try {
    const employee = await context.newPage();
    await login(employee,key.toLowerCase(),onboard.temporary_password);
    const actor = (await (await employee.request.get("/api/v1/auth/me")).json()).data;
    expect(actor.grants.map((g:{role_code:string})=>g.role_code)).toEqual(["EMPLOYEE"]);
    await employee.goto("/leave");
    await expect(employee.getByText(/ยังไม่จองหรือตัดสิทธิ์จนกว่าจะอนุมัติ/)).toBeVisible();
    const form = employee.locator("form").filter({has:employee.getByRole("button",{name:"ส่งคำขอ",exact:true})});
    await form.getByRole("combobox",{name:"ประเภทการลา",exact:true}).selectOption(type.id);
    await form.getByLabel("วันลาเริ่มต้น",{exact:true}).fill(start);
    await form.getByLabel("วันลาสิ้นสุด",{exact:true}).fill(end);
    await form.getByLabel("เหตุผล",{exact:true}).fill(key);
    const rejected = employee.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/leave-requests"&&r.request().method()==="POST");
    await form.getByRole("button",{name:"ส่งคำขอ",exact:true}).click();
    const rejection = await rejected;
    expect(rejection.status()).toBe(422);
    expect((await rejection.json()).error.code).toBe("LEAVE_QUOTA_EXCEEDED");
    await expect(employee.getByText("สิทธิ์วันลาไม่เพียงพอหรือยังไม่ได้กำหนดสิทธิ์สำหรับปีที่ขอ",{exact:true})).toBeVisible();
    expect((await (await employee.request.get(`/api/v1/leave-requests?employee_id=${onboard.employee.id}`)).json()).data).toEqual([]);
    await employee.screenshot({path:`${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/employee-quota-rejected.png`,fullPage:true});
    await form.getByLabel("วันลาสิ้นสุด",{exact:true}).fill(start);
    const submitted = employee.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/leave-requests"&&r.request().method()==="POST");
    await form.getByRole("button",{name:"ส่งคำขอ",exact:true}).click();
    const submission = await submitted;
    expect(submission.ok(),await submission.text()).toBe(true);
    const leave = (await submission.json()).data;
    await employee.reload(); await employee.getByRole("button",{name:"โหลดคำขอ",exact:true}).click();
    const row = employee.getByRole("article").filter({hasText:key});
    await expect(row).toContainText("รอพิจารณา");
    const history = (await (await employee.request.get(`/api/v1/leave-requests/${leave.id}/history`)).json()).data;
    expect(history.map((r:{action:string})=>r.action)).toEqual(["submitted"]);
    const quotas = (await (await employee.request.get(`/api/v1/leave-quotas?employee_id=${onboard.employee.id}&quota_year=2038`)).json()).data;
    expect(quotas.find((q:{leave_type_id:string})=>q.leave_type_id===type.id).used_days).toBe("0.00");
    await row.getByRole("button",{name:"แก้ไขคำขอ",exact:true}).click();
    await row.getByLabel("วันลาสิ้นสุด",{exact:true}).fill(end);
    const edited = employee.waitForResponse(r=>new URL(r.url()).pathname===`/api/v1/leave-requests/${leave.id}`&&r.request().method()==="PATCH");
    await row.getByRole("button",{name:"บันทึก",exact:true}).click();
    expect((await edited).status()).toBe(422);
    expect((await (await employee.request.get(`/api/v1/leave-requests/${leave.id}/history`)).json()).data).toEqual(history);
    await employee.reload(); await employee.getByRole("button",{name:"โหลดคำขอ",exact:true}).click();
    const persisted = (await (await employee.request.get(`/api/v1/leave-requests?employee_id=${onboard.employee.id}`)).json()).data;
    expect(persisted).toHaveLength(1); expect(persisted[0]).toMatchObject({id:leave.id,start_date:start,end_date:start,status:"pending"});
    await employee.screenshot({path:`${process.env.E2E_EVIDENCE_DIR ?? "/private/tmp"}/employee-quota-valid-persisted.png`,fullPage:true});
    await page.goto("/leave");
    const picker = page.locator("form").filter({has:page.getByRole("button",{name:"โหลดคำขอ",exact:true})}).getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน",{exact:true});
    await picker.fill(key);
    const option = page.locator(`datalist option[value^="${key}"]`);
    await expect(option).toHaveCount(1); await picker.fill((await option.getAttribute("value"))!);
    await page.getByRole("button",{name:"โหลดคำขอ",exact:true}).click();
    const approval = page.waitForResponse(r=>new URL(r.url()).pathname===`/api/v1/leave-requests/${leave.id}/approve`&&r.request().method()==="POST");
    await page.getByRole("article").filter({hasText:key}).getByRole("button",{name:"อนุมัติ",exact:true}).click();
    const decision = await approval; expect(decision.ok(),await decision.text()).toBe(true);
    await employee.reload(); await employee.getByRole("button",{name:"โหลดคำขอ",exact:true}).click();
    await expect(employee.getByRole("article").filter({hasText:key})).toContainText("อนุมัติแล้ว");
    const after = (await (await employee.request.get(`/api/v1/leave-quotas?employee_id=${onboard.employee.id}&quota_year=2038`)).json()).data;
    expect(after.find((q:{leave_type_id:string})=>q.leave_type_id===type.id).used_days).toBe("1.00");
    console.log(JSON.stringify({uc:"UC08",employee:onboard.employee.id,account:onboard.account_id,leave:leave.id,type:type.id,year:2038,rejectedDays:2,approvedDays:1}));
  } finally { await context.close(); }
});
