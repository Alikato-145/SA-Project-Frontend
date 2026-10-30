import { paceLogin } from "./login-pacing";
import { test, expect, type Page } from "@playwright/test";
const login = async (page: Page, username: string) => {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin(); await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
};
const rows = (body: { data: unknown }) => Array.isArray(body.data) ? body.data : (body.data as { items: unknown[] }).items;

test("Owner opens named branch schedules and persisted payroll", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/schedules");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption({ label: "DEMO · ร้านตัวอย่าง Haris" });
  await expect(page.getByRole("combobox", { name: "สาขา", exact: true })).toBeEnabled();
  await page.getByRole("combobox", { name: "สาขา", exact: true }).selectOption({ label: "DEMO-BKK · สาขาตัวอย่าง กรุงเทพฯ" });
  await page.getByRole("button", { name: "โหลดตารางและวันหยุด", exact: true }).click();
  await expect(page.getByText(/ตารางที่มีผลวันนี้: ตาราง/)).toBeVisible();
  await page.goto("/payroll");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption({ label: "DEMO · ร้านตัวอย่าง Haris" });
  await page.getByRole("button", { name: "เปิดสมุดงาน", exact: true }).click();
  await expect(page.getByText("งวด 09/2026", { exact: true })).toBeVisible();
  const readiness=page.getByRole("region", { name: "ความพร้อมของงวด", exact: true });
  await readiness.getByText(/รายการที่ตรวจแล้วและพร้อม/).click();
  await expect(readiness.getByText(/ประวัติการจ้างในงวด/)).toBeVisible();
  await expect(readiness.getByText(/ตารางสาขาและช่วงวันที่/)).toBeVisible();
  await expect(readiness.getByText(/บัญชีธนาคารสำหรับ CSV โอนเงิน/)).toBeVisible();
  await page.getByRole("button", { name: "คำนวณตัวอย่าง", exact: true }).click();
  await expect(page.getByText("คำนวณตัวอย่างล่าสุดแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^ดู \d+ รายการ$/ }).first()).toBeVisible();
  await page.reload();
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption({ label: "DEMO · ร้านตัวอย่าง Haris" });
  await page.getByRole("button", { name: "เปิดสมุดงาน", exact: true }).click();
  await expect(page.getByRole("button", { name: /^ดู \d+ รายการ$/ }).first()).toBeVisible();
});

for (const [username, denied] of [["employee", "/payroll"], ["supervisor", "/accounts"], ["branch_manager", "/reports"]]) {
  test(`${username} receives safe denial for ${denied}`, async ({ page }) => {
    await login(page, username!);
    await page.goto(denied!);
    await expect(page.getByRole("heading", { name: "ไม่มีสิทธิ์เข้าถึงหน้านี้", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "ออกจากระบบ", exact: true })).toBeVisible();
  });
}

test("Employee advance UI stays own-only and denies another employee through API", async ({ page }) => {
  await login(page, "employee");
  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: "เงินทดรองจ่ายและภาระหนี้ของฉัน", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ส่งคำขอเงินทดรองจ่าย", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "อนุมัติ", exact: true })).toHaveCount(0);
  const response = await page.request.get("/api/v1/advance-requests?employee_id=99999999");
  expect(response.status()).toBe(403);
});

test("HR can read only safe employee DTOs", async ({ page }) => {
  await login(page, "hr");
  const response = await page.request.get("/api/v1/employees?page_size=100");
  expect(response.status()).toBe(200);
  expect(rows(await response.json()).length).toBeGreaterThan(0);
  await page.goto("/employees");
  await expect(page.getByRole("heading", { name: /พนักงาน/ }).first()).toBeVisible();
});

test("fresh organization completes onboarding, evidence, approval, OT, payroll, PDF, SMTP and exports", async ({ page, browser, baseURL }) => {
  test.setTimeout(180_000);
  await login(page, "admin");
  const origin = new URL(baseURL!).origin;
  const mutate = async <T,>(path: string, data: unknown, method = "POST"): Promise<T> => {
    const response = await page.request.fetch(`/api/v1${path}`, { method, data, headers: { origin } });
    expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBe(true);
    return (await response.json()).data as T;
  };
  const suffix = Date.now().toString(36).toUpperCase();

  await page.goto("/organization");
  const createOrganization = async (kind: "shop"|"branch"|"department"|"position", code:string, name:string, parentId?:string) => {
    const labels={shop:"ร้าน",branch:"สาขา",department:"แผนก",position:"ตำแหน่ง"};
    const plurals={shop:"shops",branch:"branches",department:"departments",position:"positions"};
    await page.getByRole("tab", {name:labels[kind],exact:true}).click();
    await page.getByLabel("ค้นหารหัสหรือชื่อ", { exact: true }).fill(code);
    if (parentId) await page.locator("section").filter({ has: page.getByRole("heading", { name: "โครงสร้างองค์กร", exact: true }) }).getByRole("combobox", { name: kind === "department" ? "สาขา" : "ร้าน", exact: true }).selectOption(parentId);
    const form=page.locator("form").filter({has:page.getByRole("button",{name:`เพิ่ม${labels[kind]}`,exact:true})});
    await form.getByLabel("ชื่อ",{exact:true}).fill(`${name} ${code}`);
    if(parentId)await form.getByRole("combobox",{name:kind==="department"?"สาขา":"ร้าน",exact:true}).selectOption(parentId);
    const saved=page.waitForResponse(response=>new URL(response.url()).pathname===`/api/v1/${plurals[kind]}`&&response.request().method()==="POST");
    await form.getByRole("button",{name:`เพิ่ม${labels[kind]}`,exact:true}).click();
    const response=await saved;expect(response.ok(),await response.text()).toBe(true);
    await expect(page.getByText(`เพิ่ม${labels[kind]}แล้ว`,{exact:true})).toBeVisible();
    const created = (await response.json()).data as {id:string;code:string;name:string};
    await page.getByRole("row").filter({ hasText: created.code }).getByRole("button", { name: "แก้ไข", exact: true }).click();
    const editForm = page.locator("form").filter({ has: page.getByRole("button", { name: "บันทึกการแก้ไข", exact: true }) });
    await editForm.getByLabel("ชื่อ", { exact: true }).fill(`${name} ตรวจแล้ว`);
    if (parentId) await expect(editForm.getByRole("combobox", { name: kind === "department" ? "สาขา" : "ร้าน", exact: true })).toBeDisabled();
    const edited = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/${plurals[kind]}/${created.id}` && response.request().method() === "PATCH");
    await editForm.getByRole("button", { name: "บันทึกการแก้ไข", exact: true }).click();
    const update = await edited; expect(update.ok(), await update.text()).toBe(true);
    await expect(page.getByText(`แก้ไข${labels[kind]}แล้ว`, { exact: true })).toBeVisible();
    return (await update.json()).data as {id:string;code:string;name:string};
  };
  const shop=await createOrganization("shop",`UAT_${suffix}`,"ร้านทดสอบครบวงจร");
  const branch=await createOrganization("branch",`BR_${suffix}`,"สาขาทดสอบครบวงจร",shop.id);
  const department=await createOrganization("department","KITCHEN","ครัว",branch.id);
  const position=await createOrganization("position","CHEF","พนักงานครัว",shop.id);
  await page.goto("/employees/new");
  await page.getByLabel("วันที่เริ่มงาน", { exact: true }).fill("2026-09-01");
  await page.getByLabel("ชื่อ", { exact: true }).fill("ทดสอบ");
  await page.getByLabel("นามสกุล", { exact: true }).fill("ครบวงจร");
  await page.getByLabel("เลขหนังสือเดินทาง", { exact: true }).fill(`P${suffix}`);
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
  await page.getByRole("combobox", { name: "สาขา", exact: true }).selectOption(branch.id);
  await page.getByRole("combobox", { name: "แผนก", exact: true }).selectOption(department.id);
  await page.getByRole("combobox", { name: "ตำแหน่ง", exact: true }).selectOption(position.id);
  await page.getByLabel("เงินเดือนฐาน", { exact: true }).fill("2600.00");
  await page.getByLabel("สวัสดิการ", { exact: true }).fill("260.00");
  await page.getByLabel("อาทิตย์", { exact: true }).check();
  await page.getByLabel("เพิ่มบัญชีธนาคาร", { exact: true }).check();
  await page.getByLabel("รหัสธนาคาร", { exact: true }).fill("DEMO");
  await page.getByLabel("ชื่อธนาคาร", { exact: true }).fill("ธนาคารทดสอบ");
  await page.getByLabel("ชื่อเจ้าของบัญชี", { exact: true }).fill("ทดสอบ ครบวงจร");
  await page.getByLabel("เลขบัญชี", { exact: true }).fill("0000000000");
  await page.getByLabel("สร้างบัญชีเข้าใช้งาน", { exact: true }).check();
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(`uat_${suffix.toLowerCase()}`);
  const onboardingResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/employees/onboard" && response.request().method() === "POST");
  await page.getByRole("button", { name: "สร้างพนักงาน", exact: true }).click();
  const savedOnboarding = await onboardingResponse;
  expect(savedOnboarding.ok(), await savedOnboarding.text()).toBe(true);
  const onboard = (await savedOnboarding.json()).data as { employee: { id: string; employee_code: string }; account_id: string; temporary_password: string };
  const employeeId = onboard.employee.id;
  await mutate(`/employees/${employeeId}/payment-destination`, { payment_method: "transfer", promptpay_phone: "0812345678" }, "PUT");
  const employeeContext = await browser.newContext();
  const employeePage = await employeeContext.newPage();
  await employeePage.goto(`${baseURL}/login`);
  await employeePage.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(`uat_${suffix.toLowerCase()}`);
  await employeePage.getByLabel("รหัสผ่าน", { exact: true }).fill(onboard.temporary_password);
  await paceLogin(); await employeePage.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(employeePage.getByRole("link", { name: "การลา", exact: true })).toBeVisible();
  await employeePage.goto(`${baseURL}/leave`);
  await expect(employeePage.getByRole("heading", { name: "การลา", exact: true })).toBeVisible();
  await mutate("/branch-schedules", { branch_id: branch.id, work_start_time: "09:00", standard_close_time: "18:00", late_grace_minutes: 5, effective_from: "2026-09-01" });
  const configs = [
    ["STANDARD_WORK_DAYS", "26", "days"], ["ABSENCE_RATE", "1", "multiplier"], ["LATE_RATE", "1", "currency_per_minute"],
    ["OT_HOURLY_RATE", "1", "multiplier"], ["OT_REST_DAY_RATE", "1", "multiplier"], ["OT_PUBLIC_HOLIDAY_RATE", "2", "multiplier"],
    ["SOCIAL_SECURITY_RATE", "0.05", "ratio"], ["SOCIAL_SECURITY_CAP", "750", "currency"],
  ];
  for (const [config_key, numeric_value, unit] of configs) await mutate("/payroll/configurations", { shop_id: shop.id, branch_id: null, config_key, numeric_value, unit, effective_from: "2026-09-01" });
  await mutate("/payroll/configurations", { shop_id: shop.id, branch_id: branch.id, config_key: "OT_HOURLY_RATE", numeric_value: "1.5", unit: "multiplier", effective_from: "2026-09-01" });
  await page.goto("/leave");
  await page.getByText("จัดการประเภทและสิทธิ์วันลา (HR / เจ้าของ)", { exact: true }).click();
  const typeForm = page.locator("form").filter({ has: page.getByRole("heading", { name: "เพิ่มประเภทการลา", exact: true }) });
  await typeForm.getByLabel("รหัสประเภท", { exact: true }).fill(`LEAVE_${suffix}`);
  await typeForm.getByLabel("ชื่อประเภท", { exact: true }).fill("ลาทดสอบมีเอกสาร");
  await typeForm.getByLabel("จำนวนวันมาตรฐาน (สำหรับสิทธิ์คงที่)", { exact: true }).fill("30");
  await typeForm.getByLabel("ต้องแนบเอกสารก่อนอนุมัติ", { exact: true }).check();
  const typeResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/leave-types" && response.request().method() === "POST");
  await typeForm.getByRole("button", { name: "บันทึกประเภท", exact: true }).click();
  const savedType = await typeResponse; expect(savedType.ok(), await savedType.text()).toBe(true);
  const type = (await savedType.json()).data as { id: string };
  const quotaForm = page.locator("form").filter({ has: page.getByRole("heading", { name: "กำหนดสิทธิ์รายปี", exact: true }) });
  const quotaPicker = quotaForm.getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน", { exact: true });
  await quotaPicker.fill(onboard.employee.employee_code);
  await expect(quotaForm.locator(`datalist option[value^="${onboard.employee.employee_code}"]`)).toHaveCount(1);
  await quotaPicker.fill(`${onboard.employee.employee_code} · ทดสอบ ครบวงจร`);
  await quotaForm.getByLabel("ปี ค.ศ.", { exact: true }).fill("2026");
  await quotaForm.getByRole("combobox", { name: "ประเภทการลา", exact: true }).selectOption(type.id);
  await quotaForm.getByLabel("สิทธิ์ทั้งหมด (วัน)", { exact: true }).fill("30");
  await quotaForm.getByRole("button", { name: "บันทึกสิทธิ์วันลา", exact: true }).click();
  await expect(page.getByText("บันทึกสิทธิ์วันลาแล้ว จำนวนวันที่ใช้ไปคงเดิม", { exact: true })).toBeVisible();
  const leave = await mutate<{ id: string }>("/leave-requests", { employee_id: employeeId, leave_type_id: type.id, start_date: "2026-09-01", end_date: "2026-09-01", reason: "ทดสอบเอกสาร" });
  const missingEvidence = await page.request.post(`/api/v1/leave-requests/${leave.id}/approve`, { data: {}, headers: { origin } });
  expect(missingEvidence.status()).toBe(422);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMxkAAAAASUVORK5CYII=", "base64");
  const upload = await page.request.post(`/api/v1/leave-requests/${leave.id}/attachments`, { headers: { origin }, multipart: { file: { name: "evidence.png", mimeType: "image/png", buffer: png } } });
  expect(upload.ok(), await upload.text()).toBe(true);
  const attachment = (await upload.json()).data as { id: string };
  const ownEvidence = await employeePage.request.get(`${baseURL}/api/v1/attachments/${attachment.id}/download`);
  expect(ownEvidence.status()).toBe(200); expect(await ownEvidence.body()).toEqual(png);
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await otherPage.goto(`${baseURL}/login`);
  await otherPage.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("employee");
  await otherPage.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
  await paceLogin(); await otherPage.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(otherPage).not.toHaveURL(/\/login$/);
  expect((await otherPage.request.get(`${baseURL}/api/v1/attachments/${attachment.id}/download`)).status()).toBe(403);
  await otherContext.close();
  const unsafeUpload = await page.request.post(`/api/v1/leave-requests/${leave.id}/attachments`, { headers: { origin }, multipart: { file: { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("unsafe-content") } } });
  expect(unsafeUpload.status()).toBe(422);
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1); png.copy(oversized);
  const oversizedUpload = await page.request.post(`/api/v1/leave-requests/${leave.id}/attachments`, { headers: { origin }, multipart: { file: { name: "oversized.png", mimeType: "image/png", buffer: oversized } } });
  expect([413, 422]).toContain(oversizedUpload.status());
  const evidenceList = await page.request.get(`/api/v1/leave-requests/${leave.id}/attachments`);
  const evidenceText = await evidenceList.text();
  expect(JSON.parse(evidenceText).data).toHaveLength(1);
  expect(evidenceText).not.toContain("storage_key");
  await mutate(`/leave-requests/${leave.id}/approve`, { remark: "ตรวจเอกสารแล้ว" });
  const quota = await page.request.get(`/api/v1/leave-quotas?employee_id=${employeeId}&quota_year=2026`);
  expect((await quota.json()).data[0].used_days).toBe("1.00");
  await quotaForm.getByLabel("สิทธิ์ทั้งหมด (วัน)", { exact: true }).fill("31");
  const updatedQuotaResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/leave-quotas" && response.request().method() === "PUT");
  await quotaForm.getByRole("button", { name: "บันทึกสิทธิ์วันลา", exact: true }).click();
  const updatedQuota = await updatedQuotaResponse; expect(updatedQuota.ok(), await updatedQuota.text()).toBe(true);
  expect((await updatedQuota.json()).data).toMatchObject({ entitled_days: "31.00", used_days: "1.00" });
  const history = await page.request.get(`/api/v1/leave-requests/${leave.id}/history`);
  expect((await history.json()).data.at(-1).remark).toBe("ตรวจเอกสารแล้ว");
  for (let day = 2; day <= 30; day++) {
    const work_date = `2026-09-${String(day).padStart(2, "0")}`;
    if (new Date(`${work_date}T00:00:00Z`).getUTCDay() === 0) continue;
    await mutate("/work-day-records", { employee_id: employeeId, branch_id: branch.id, work_date, status: "present", clock_in_at: `${work_date}T02:00:00Z`, clock_out_at: `${work_date}T11:00:00Z`, late_minutes: 0, is_deductible: false });
  }
  const ot = await mutate<{ id: string }>("/overtime-records", { employee_id: employeeId, overtime_date: "2026-09-02", overtime_type: "hourly", hours: "2", reason: "ทดสอบ OT" });
  await mutate(`/overtime-records/${ot.id}`, { overtime_date: "2026-09-02", overtime_type: "hourly", hours: "3", reason: "แก้จำนวนชั่วโมง" }, "PATCH");
  await mutate(`/overtime-records/${ot.id}/approve`, { remark: "ตรวจแล้ว" });
  await page.goto("/finance");
  const financePicker = page.getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน", { exact: true });
  await financePicker.fill(onboard.employee.employee_code);
  await expect(page.locator(`datalist option[value^="${onboard.employee.employee_code}"]`)).toHaveCount(1);
  await financePicker.fill(`${onboard.employee.employee_code} · ทดสอบ ครบวงจร`);
  const loanForm = page.locator("form").filter({ has: page.getByRole("button", { name: "สร้างเงินกู้", exact: true }) });
  await loanForm.getByLabel("ยอดเงินกู้", { exact: true }).fill("100.01");
  await loanForm.getByLabel("จำนวนงวด (1-5)", { exact: true }).fill("3");
  await loanForm.getByLabel("เดือนที่เริ่มชำระ", { exact: true }).fill("2026-09");
  await loanForm.getByLabel("เหตุผล", { exact: true }).fill("ทดสอบค่างวด");
  await loanForm.getByRole("button", { name: "สร้างเงินกู้", exact: true }).click();
  await expect(page.getByText("สร้างเงินกู้และตารางผ่อนแล้ว", { exact: true })).toBeVisible();
  const loanList = await page.request.get(`/api/v1/loans?employee_id=${employeeId}`);
  expect((await loanList.json()).data[0].installments.map((row: { amount: string }) => row.amount)).toEqual(["33.34", "33.34", "33.33"]);
  const debtTypeBody = { code: `DEBT_${suffix}`, name_th: "หนี้ทดสอบ", description: "ทดสอบประวัติ", is_active: true };
  const debtType = await mutate<{ id: string }>("/debt-types", debtTypeBody);
  const charge = await mutate<{ id: string }>("/debt-transactions", { employee_id: employeeId, debt_type_id: debtType.id, transaction_kind: "charge", amount: "25.00", description: "ทดสอบหนี้" });
  await mutate(`/debt-transactions/${charge.id}/reverse`, { description: "ทดสอบกลับรายการโดยคงประวัติ" });
  const ledger = await page.request.get(`/api/v1/debt-transactions?employee_id=${employeeId}`);
  const debtLedger = (await ledger.json()).data;
  expect(debtLedger.entries).toHaveLength(2);
  expect(debtLedger.balance).toBe("0.00");
  await mutate(`/debt-types/${debtType.id}`, { ...debtTypeBody, is_active: false }, "PATCH");
  const inactiveDebt = await page.request.post("/api/v1/debt-transactions", { headers: { origin }, data: { employee_id: employeeId, debt_type_id: debtType.id, transaction_kind: "charge", amount: "25.00", description: "ต้องถูกปฏิเสธ" } });
  expect((await inactiveDebt.json()).error.code).toBe("DEBT_TYPE_UNAVAILABLE");
  const period = await mutate<{ id: string }>("/payroll/periods", { shop_id: shop.id, period_year: 2026, period_month: 9, start_date: "2026-09-01", end_date: "2026-09-30" });
  const preview = await mutate<{ blockers: unknown[]; records: { net_pay: string }[] }>(`/payroll/periods/${period.id}/preview`, {});
  expect(preview.blockers).toEqual([]);
  expect(preview.records[0].net_pay).toBe("2752.91");
  await mutate(`/payroll/periods/${period.id}/lock`, {});
  const persisted = await page.request.get(`/api/v1/payroll/periods/${period.id}`);
  const locked = (await persisted.json()).data;
  expect(locked.period.status).toBe("locked");
  expect(locked.roster[0].employeeName).toBe("ทดสอบ ครบวงจร");
  const recordId = locked.records[0].id;
  const pdf = await mutate<{ id: string }>(`/payslips/payroll-records/${recordId}`, {});
  const duplicatePdf = await mutate<{ id: string }>(`/payslips/payroll-records/${recordId}`, {});
  expect(duplicatePdf.id).toBe(pdf.id);
  const downloaded = await page.request.get(`/api/v1/payslips/${pdf.id}/download`);
  expect(downloaded.status()).toBe(200);
  const pdfBytes = await downloaded.body();
  expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
  await test.info().attach("payslip-full-journey.pdf", { body: pdfBytes, contentType: "application/pdf" });
  const delivery = await mutate<{ status: string }>(`/payslips/${pdf.id}/deliveries`, { recipient_email: `uat-${suffix.toLowerCase()}@example.test` });
  expect(delivery.status).toBe("sent");
  await mutate(`/payroll/periods/${period.id}/payments/prepare`, {});
  for (const kind of ["bank-transfer", "social-security"]) {
    const exported = await page.request.get(`/api/v1/reports/${kind}.csv?period_id=${period.id}`);
    expect(exported.status(), await exported.text()).toBe(200);
    expect(exported.headers()["content-type"]).toContain("text/csv");
    const csv = await exported.text();
    expect(csv).toContain(kind === "bank-transfer" ? '"2752.91"' : '"2600.00","130.00"');
    if (kind === "bank-transfer") expect(csv).toContain('"0000000000"');
    await test.info().attach(`${kind}-frozen.csv`, { body: Buffer.from(csv), contentType: "text/csv" });
  }
  const summary = await page.request.get(`/api/v1/reports/summary?period_id=${period.id}`);
  expect(summary.status(), await summary.text()).toBe(200);
  expect((await summary.json()).data.payroll[0].net).toBe("2752.91");
  const scopedSummary = await page.request.get(`/api/v1/reports/summary?period_id=${period.id}&branch_id=${branch.id}&department_id=${department.id}`);
  expect(scopedSummary.status(), await scopedSummary.text()).toBe(200);
  expect((await scopedSummary.json()).data.payroll[0].net).toBe("2752.91");
  const firstPage = await page.request.get(`/api/v1/reports/details?period_id=${period.id}&kind=attendance&branch_id=${branch.id}&page=1&page_size=20`);
  const firstDetails = await firstPage.json();
  expect(firstDetails.total).toBe(26);expect(firstDetails.data).toHaveLength(20);
  const nextPage = await page.request.get(`/api/v1/reports/details?period_id=${period.id}&kind=attendance&branch_id=${branch.id}&page=2&page_size=20`);
  expect((await nextPage.json()).data).toHaveLength(6);
  const summaryExport = await page.request.get(`/api/v1/reports/summary.csv?period_id=${period.id}&department_id=${department.id}`);
  expect(summaryExport.status(), await summaryExport.text()).toBe(200);
  expect(await summaryExport.text()).toContain('"2752.91"');

  const targetPeriod = await mutate<{ id: string }>("/payroll/periods", { shop_id: shop.id, period_year: 2026, period_month: 10, start_date: "2026-10-01", end_date: "2026-10-31" });
  await page.goto("/payroll");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
  await page.getByRole("button", { name: "เปิดสมุดงาน", exact: true }).click();
  await page.getByText("รายการปรับปรุงหลังล็อกรอบ", { exact: true }).click();
  const originalGroup = page.getByRole("group", { name: "ต้นทางที่ล็อกแล้ว", exact: true });
  await originalGroup.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
  await originalGroup.getByRole("combobox", { name: "งวดเงินเดือน", exact: true }).selectOption(period.id);
  await originalGroup.getByRole("combobox", { name: "พนักงาน", exact: true }).selectOption(recordId);
  const targetGroup = page.getByRole("group", { name: "งวดปลายทาง", exact: true });
  await targetGroup.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
  await targetGroup.getByRole("combobox", { name: "งวดเงินเดือน", exact: true }).selectOption(targetPeriod.id);
  const adjustmentForm = page.locator("form").filter({ has: page.getByRole("button", { name: "ส่งรายการปรับปรุง", exact: true }) });
  await adjustmentForm.getByLabel("จำนวนเงิน", { exact: true }).fill("100.00");
  await adjustmentForm.getByLabel("เหตุผล", { exact: true }).fill("ทดสอบส่วนต่างย้อนหลังโดยไม่แก้ผลเดิม");
  await page.getByRole("button", { name: "ส่งรายการปรับปรุง", exact: true }).click();
  await expect(page.getByRole("button", { name: "อนุมัติ", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "อนุมัติ", exact: true }).click();
  await expect(page.getByText("รอคำนวณและล็อกงวดปลายทาง", { exact: true })).toBeVisible();
  for (let day = 1; day <= 31; day++) {
    const work_date = `2026-10-${String(day).padStart(2, "0")}`;
    if (new Date(`${work_date}T00:00:00Z`).getUTCDay() === 0) continue;
    await mutate("/work-day-records", { employee_id: employeeId, branch_id: branch.id, work_date, status: "present", clock_in_at: `${work_date}T02:00:00Z`, clock_out_at: `${work_date}T11:00:00Z`, late_minutes: 0, is_deductible: false });
  }
  const adjustedPreview = await mutate<{ blockers: unknown[]; records: { net_pay: string }[] }>(`/payroll/periods/${targetPeriod.id}/preview`, {});
  expect(adjustedPreview.blockers).toEqual([]);
  // Confirmed policy: SS uses summed daily base earnings, excluding welfare/OT/adjustments.
  expect(adjustedPreview.records[0].net_pay).toBe("2796.76");
  const adjustedLock = await mutate<{ records: { net_pay: string; items: { item_type: string; amount: string }[] }[] }>(`/payroll/periods/${targetPeriod.id}/lock`, {});
  expect(adjustedLock.records[0].net_pay).toBe("2796.76");
  expect(adjustedLock.records[0].items.find(item => item.item_type === "social_security")?.amount).toBe("130.01");
  expect(adjustedLock.records[0].items.filter(item => item.item_type === "adjustment")).toHaveLength(1);
  const originalAfterAdjustment = await page.request.get(`/api/v1/payroll/periods/${period.id}`);
  expect((await originalAfterAdjustment.json()).data.records[0].net_pay).toBe("2752.91");
  const ownPdf = await employeePage.request.get(`${baseURL}/api/v1/payslips/${pdf.id}/download`);
  expect(ownPdf.status()).toBe(200);
  const blockedWrite = await page.request.post("/api/v1/work-day-records", { headers: { origin }, data: { employee_id: employeeId, branch_id: branch.id, work_date: "2026-09-10", status: "absent", late_minutes: 0, is_deductible: true } });
  expect(blockedWrite.ok()).toBe(false);
  await page.goto("/reports");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
  await page.getByRole("combobox", { name: "งวดเงินเดือน", exact: true }).selectOption(period.id);
  await page.getByRole("button", { name: "ดูรายงานสรุป", exact: true }).click();
  await expect(page.getByRole("heading", { name: "เงินเดือน", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "สาขา", exact: true }).selectOption(branch.id);
  await page.getByRole("combobox", { name: "แผนก", exact: true }).selectOption(department.id);
  await page.getByRole("button", { name: "ดูรายงานสรุป", exact: true }).click();
  await page.getByRole("button", { name: "ดูรายการ", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "รายการประกอบรายงาน (26)", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await expect(page.getByText("หน้า 2 / 2", { exact: true })).toBeVisible();
  const summaryDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "ส่งออกสรุปตามตัวกรอง (CSV)", exact: true }).click();
  expect((await summaryDownload).suggestedFilename()).toContain("summary-");
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "รายงานประกันสังคม (CSV)", exact: true }).click();
  expect((await csvDownload).suggestedFilename()).toContain("social-security");
  await test.info().attach("reports-ui.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.goto("/payslips");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
  await page.getByRole("combobox", { name: "งวดเงินเดือน", exact: true }).selectOption(period.id);
  await page.getByRole("combobox", { name: "พนักงาน", exact: true }).selectOption(recordId);
  await page.getByRole("button", { name: "ออกหรือเปิดสลิป", exact: true }).click();
  await expect(page.getByRole("heading", { name: `สลิป #${pdf.id}`, exact: true })).toBeVisible();
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "ดาวน์โหลด PDF", exact: true }).click();
  expect((await pdfDownload).suggestedFilename()).toContain(".pdf");
  await employeePage.goto(`${baseURL}/payslips`);
  await expect(employeePage.getByRole("button", { name: "ดาวน์โหลด PDF", exact: true })).toBeVisible();
  await test.info().attach("employee-payslip-ui.png", { body: await employeePage.screenshot({ fullPage: true }), contentType: "image/png" });
  await employeeContext.close();
});

test("configuration successor preserves history and readiness reveals simultaneous setup gaps", async ({ page, baseURL }) => {
  await login(page, "admin");
  const origin = new URL(baseURL!).origin;
  const create = async (path: string, data: unknown) => {
    const response = await page.request.post(`/api/v1${path}`, { data, headers: { origin } });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()).data;
  };
  const suffix = Date.now().toString(36).toUpperCase();
  const shop = await create("/shops", { code: `CONFIG_${suffix}`, name: "ร้านทดสอบช่วงค่าคำนวณ" });
  const branch = await create("/branches", { shop_id: shop.id, code: `CONFIG_BR_${suffix}`, name: "สาขาทดสอบช่วงค่าคำนวณ" });
  const original = await create("/payroll/configurations", { shop_id: shop.id, branch_id: branch.id, config_key: "ABSENCE_RATE", numeric_value: "1", unit: "multiplier", effective_from: "2026-09-01" });
  const successor = await create(`/payroll/configurations/${original.id}/successor`, { numeric_value: "1.5", effective_from: "2026-10-01" });
  expect(successor.numeric_value).toBe("1.5000");
  const history = await page.request.get(`/api/v1/payroll/configurations?shop_id=${shop.id}`);
  const configurations = (await history.json()).data;
  expect(configurations.find((row: { id: string }) => row.id === original.id)).toMatchObject({ numeric_value: "1.0000", effective_to: "2026-09-30" });
  const overlap = await page.request.post(`/api/v1/payroll/configurations/${original.id}/successor`, { data: { numeric_value: "2", effective_from: "2026-10-02" }, headers: { origin } });
  expect(overlap.status()).toBe(422);
  const period = await create("/payroll/periods", { shop_id: shop.id, period_year: 2026, period_month: 10, start_date: "2026-10-01", end_date: "2026-10-31" });
  const readiness = await page.request.get(`/api/v1/payroll/periods/${period.id}/readiness`);
  expect(readiness.ok(), await readiness.text()).toBe(true);
  expect((await readiness.json()).data).toMatchObject({ can_lock: false, can_export: false, employee_count: 0 });
  await page.goto("/payroll");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
  await page.getByRole("button", { name: "เปิดสมุดงาน", exact: true }).click();
  const checklist = page.getByRole("region", { name: "ความพร้อมของงวด", exact: true });
  await expect(checklist.getByText(/ไม่มีพนักงานที่มีประวัติการจ้าง/)).toBeVisible();
  await page.getByText(/ความพร้อมของค่าคำนวณ \(/).click();
  const historyRow = page.getByRole("row").filter({ hasText: "2026-10-01 ถึง ปัจจุบัน" });
  await historyRow.getByText("เปลี่ยนค่าตั้งแต่วันที่", { exact: true }).click();
  await historyRow.getByLabel(/^ค่าใหม่ \(/).fill("2");
  await historyRow.getByLabel("วันที่เริ่มใช้ค่าใหม่", { exact: true }).fill("2026-11-01");
  await historyRow.getByRole("button", { name: "บันทึกช่วงใหม่", exact: true }).click();
  await expect(page.getByRole("cell", { name: /^2026-10-01 ถึง 2026-10-31/ })).toBeVisible();
  const blockedArchive = await page.request.post(`/api/v1/shops/${shop.id}/deactivate`, { data: { reason: "active child must block" }, headers: { origin } });
  expect(blockedArchive.status()).toBe(409);
  const closeBranch = await page.request.post(`/api/v1/branches/${branch.id}/deactivate`, { data: { reason: "close child before parent" }, headers: { origin } });
  expect(closeBranch.ok(), await closeBranch.text()).toBe(true);
  const archived=await page.request.post(`/api/v1/shops/${shop.id}/deactivate`,{data:{reason:"archive synthetic fixture"},headers:{origin}});
  expect(archived.ok(),await archived.text()).toBe(true);
  await page.reload();
  await page.getByRole("combobox", { name:"ร้าน",exact:true }).selectOption(shop.id);
  await page.getByRole("button", { name:"เปิดสมุดงาน",exact:true }).click();
  await expect(page.getByText("งวด 10/2026", { exact:true })).toBeVisible();
  await expect(page.getByRole("button", { name:"บันทึกค่าคำนวณ",exact:true })).toBeDisabled();
  await page.goto("/reports");
  await page.getByRole("combobox", { name:"ร้าน",exact:true }).selectOption(shop.id);
  await page.getByRole("combobox", { name:"งวดเงินเดือน",exact:true }).selectOption(period.id);
  await expect(page.getByRole("combobox", { name:"งวดเงินเดือน",exact:true })).toHaveValue(period.id);

});

test("schedule changes preserve history and attendance calendar supports clock correction", async ({ page, baseURL }) => {
  test.setTimeout(90000);
  await login(page, "admin");
  const origin = new URL(baseURL!).origin;
  const create = async (path: string, data: unknown) => {
    const response = await page.request.post(`/api/v1${path}`, { data, headers: { origin } });
    expect(response.ok(), `${path}: ${await response.text()}`).toBe(true); return (await response.json()).data;
  };
  const suffix = Date.now().toString(36).toUpperCase();
  const shop = await create("/shops", { code: `SCHEDULE_${suffix}`, name: "ร้านทดสอบลงเวลา" });
  const branch = await create("/branches", { shop_id: shop.id, code: `SB_${suffix}`, name: "สาขาทดสอบลงเวลา" });
  const department = await create("/departments", { branch_id: branch.id, code: "TEAM", name: "ทีมทดสอบ" });
  const position = await create("/positions", { shop_id: shop.id, code: "STAFF", name: "พนักงาน" });
  const employeeCode = `SC_${suffix}`;
  const onboard = await create("/employees/onboard", {
    employee: { employee_code: employeeCode, national_id: null, passport_id: `SC${suffix}`, first_name: "ทดสอบ", last_name: "ลงเวลา", hire_date: "2026-09-01" },
    assignment: { branch_id: branch.id, department_id: department.id, position_id: position.id, employment_type: "full_time", base_salary: "2600.00", welfare_amount: "0.00", effective_from: "2026-09-01" },
    bank_account: { bank_code: "DEMO", bank_name: "ทดสอบ", account_holder_name: "ทดสอบ ลงเวลา", account_number: "0000000000", is_primary: true },
    weekly_holidays: [{ weekday: 0, effective_from: "2026-09-01" }], account: { username: `sc_${suffix.toLowerCase()}` },
  });
  await page.goto("/schedules");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
  await page.getByRole("combobox", { name: "สาขา", exact: true }).selectOption(branch.id);
  await page.getByRole("button", { name: "โหลดตารางและวันหยุด", exact: true }).click();
  await page.getByLabel("เวลาเริ่มงาน", { exact: true }).fill("09:00");
  await page.getByLabel("เวลาเลิกงาน", { exact: true }).fill("18:00");
  await page.getByLabel("อนุโลมมาสาย (นาที)", { exact: true }).fill("5");
  await page.getByLabel("เริ่มใช้วันที่", { exact: true }).fill("2026-09-01");
  await page.getByRole("button", { name: "บันทึกตารางเวลา", exact: true }).click();
  await expect(page.getByText(/ตารางที่มีผลวันนี้: ตาราง/)).toBeVisible();
  const before = await page.request.get(`/api/v1/branch-schedules?branch_id=${branch.id}`);
  const schedule = (await before.json()).data[0];
  await page.getByRole("combobox", { name: "ตารางเดิมที่ต้องการเปลี่ยน", exact: true }).selectOption(schedule.id);
  await page.getByLabel("เวลาเริ่มงาน", { exact: true }).fill("10:00");
  await page.getByLabel("เวลาเลิกงาน", { exact: true }).fill("19:00");
  await page.getByLabel("เริ่มใช้วันที่", { exact: true }).fill("2026-10-01");
  await page.getByRole("button", { name: "บันทึกตารางเวลา", exact: true }).click();
  await expect(page.getByText(/2026-09-01 – 2026-09-30/)).toBeVisible();
  await page.getByLabel("วันที่เปลี่ยนตาราง", { exact: true }).fill("2026-09-02");
  await page.getByLabel("ปิดสาขา", { exact: true }).check();
  await page.getByLabel("เหตุผล", { exact: true }).fill("ทดสอบปิดเฉพาะวัน");
  await page.getByRole("button", { name: "บันทึกตารางเฉพาะวัน", exact: true }).click();
  await page.getByLabel("วันที่หยุด", { exact: true }).fill("2026-09-03");
  await page.getByLabel("ชื่อวันหยุด", { exact: true }).fill("วันหยุดทดสอบ");
  await page.getByRole("button", { name: "เพิ่มวันหยุด", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: /2026-09-03 · วันหยุดทดสอบ/ })).toBeVisible();
  await page.goto("/attendance");
  const picker = page.getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน", { exact: true });
  await picker.fill(employeeCode);
  await expect(page.locator(`datalist option[value^="${employeeCode}"]`)).toHaveCount(1);
  await picker.fill(`${employeeCode} · ทดสอบ ลงเวลา`);
  await page.getByLabel("ตั้งแต่", { exact: true }).fill("2026-09-01");
  await page.getByLabel("ถึง", { exact: true }).fill("2026-09-06");
  await page.getByRole("button", { name: "โหลดรายการ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ความครบถ้วนรายวัน", exact: true })).toBeVisible();
  await expect(page.getByRole("button").filter({ hasText: "ยังไม่มีข้อมูล" }).first()).toBeVisible();
  await page.getByLabel("วันที่ทำงาน", { exact: true }).fill("2026-09-01");
  await expect(page.getByLabel("สาขาตามประวัติการจ้าง", { exact: true })).toHaveValue("สาขาทดสอบลงเวลา");
  await page.getByLabel("เวลาเข้างาน", { exact: true }).fill("2026-09-01T09:07");
  await expect(page.locator("form").filter({ has: page.getByRole("heading", { name: "บันทึกวันทำงาน", exact: true }) }).locator("input[name=lateMinutes]")).toHaveValue("2");
  await page.getByLabel("เวลาออกงาน", { exact: true }).fill("2026-09-01T18:00");
  await page.getByRole("button", { name: "บันทึกวันทำงาน", exact: true }).click();
  await expect(page.getByText("บันทึกวันทำงานแล้ว", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "รายการวันทำงาน", exact: true }).selectOption({ index: 1 });
  await expect(page.getByLabel("เวลาออกงาน (Asia/Bangkok)", { exact: true })).toHaveValue("2026-09-01T18:00");
  await page.getByLabel("เวลาออกงาน (Asia/Bangkok)", { exact: true }).fill("2026-09-01T18:30");
  await page.getByLabel("เหตุผล / หมายเหตุ", { exact: true }).fill("แก้เวลาออกงานที่บันทึกคลาดเคลื่อน");
  await page.getByRole("button", { name: "บันทึกการแก้ไข", exact: true }).click();
  await expect(page.getByText("บันทึกการแก้ไขแล้ว", { exact: true })).toBeVisible();
  await page.goto(`/employees/${onboard.employee.id}`);
  await page.getByText("เปลี่ยนสถานะพนักงาน", { exact: true }).click();
  await page.getByRole("combobox", { name: "สถานะใหม่", exact: true }).selectOption("terminated");
  await page.getByLabel("วันทำงานสุดท้าย", { exact: true }).fill("2026-09-03");
  await page.getByLabel("เหตุผลเปลี่ยนสถานะ", { exact: true }).fill("สิ้นสุดการจ้างในชุดข้อมูลทดสอบ");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "บันทึกสถานะพนักงาน", exact: true }).click();
  await expect(page.getByText("บันทึกสถานะและประวัติการจ้างแล้ว", { exact: true })).toBeVisible();
  const employment = await page.request.get(`/api/v1/employees/${onboard.employee.id}/assignments`);
  expect((await employment.json()).data[0]).toMatchObject({ effective_to: "2026-09-03", base_salary: "2600.00" });
  const calendar = await page.request.get(`/api/v1/work-day-records/calendar?employee_id=${onboard.employee.id}&start_date=2026-09-01&end_date=2026-09-06`);
  expect((await calendar.json()).data.find((day: { date: string }) => day.date === "2026-09-04").status).toBe("not_employed");
  const period = await create("/payroll/periods", { shop_id: shop.id, period_year: 2026, period_month: 10, start_date: "2026-10-01", end_date: "2026-10-31" });
  const details = await page.request.get(`/api/v1/payroll/periods/${period.id}`);
  expect((await details.json()).data.roster).toEqual([]);

});

test("new account receives named branch scope, changes password and loses access when disabled", async ({ page, browser, baseURL }) => {
  await login(page, "admin");
  const username = `scope_${Date.now().toString(36)}`;
  await page.goto("/accounts/new");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByRole("button", { name: "สร้างบัญชี", exact: true }).click();
  const password = (await page.locator("code").textContent())!;
  const detailLink = page.getByRole("link", { name: "กำหนดบทบาทบัญชีนี้", exact: true });
  const accountId = (await detailLink.getAttribute("href"))!.split("/").at(-1)!;
  await page.getByRole("button", { name: "ปิดรหัสผ่าน", exact: true }).click();
  await detailLink.click();
  await page.getByRole("combobox", { name: "บทบาท", exact: true }).selectOption("BRANCH_MANAGER");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption({ label: "DEMO · ร้านตัวอย่าง Haris" });
  await page.getByRole("combobox", { name: "สาขา", exact: true }).selectOption({ label: "สาขาตัวอย่าง กรุงเทพฯ" });
  await page.getByLabel("เหตุผล", { exact: true }).fill("ทดสอบกำหนดสาขาจากชื่อ");
  await page.getByRole("button", { name: "เพิ่มบทบาท", exact: true }).click();
  await expect(page.getByText("เพิ่มบทบาทแล้ว", { exact: true })).toBeVisible();
  const managed = await browser.newContext();
  const manager = await managed.newPage();
  await manager.goto(`${baseURL}/login`);
  await manager.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await manager.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await paceLogin(); await manager.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(manager).not.toHaveURL(/\/login$/);
  const me = (await (await manager.request.get("/api/v1/auth/me")).json()).data;
  expect(me.grants).toHaveLength(1); expect(me.grants[0]).toMatchObject({ role_code: "BRANCH_MANAGER", scope: "branch" });
  const departments = await page.request.get(`/api/v1/departments?branch_id=${me.grants[0].branch_id}`);
  const departmentId = (await departments.json()).data[0].id;
  const secondRole = await page.request.post(`/api/v1/accounts/${accountId}/roles`, {data:{role_code:"SUPERVISOR",branch_id:me.grants[0].branch_id,department_id:departmentId,reason:"test manager with supervisor role"},headers:{origin:new URL(baseURL!).origin}});
  expect(secondRole.ok(),await secondRole.text()).toBe(true);

  await manager.goto(`${baseURL}/payroll`);
  await manager.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption({ label: "DEMO · ร้านตัวอย่าง Haris" });
  await manager.getByRole("button", { name: "เปิดสมุดงาน", exact: true }).click();
  await expect(manager.getByText(/โหมดอ่านอย่างเดียว/)).toBeVisible();
  await expect(manager.getByRole("button", { name: "ล็อกรอบ", exact: true })).toHaveCount(0);
  await manager.goto(`${baseURL}/settings`);
  const replacement = `Changed_${Date.now().toString(36)}`;
  await manager.getByLabel("รหัสผ่านปัจจุบัน", { exact: true }).fill(password);
  await manager.getByLabel("รหัสผ่านใหม่", { exact: true }).fill(replacement);
  await manager.getByLabel("ยืนยันรหัสผ่านใหม่", { exact: true }).fill(replacement);
  await manager.getByRole("button", { name: "เปลี่ยนรหัสผ่าน", exact: true }).click();
  await expect(manager.getByText(/เปลี่ยนรหัสผ่านเรียบร้อยแล้ว/)).toBeVisible();
  await manager.goto(`${baseURL}/login`);
  await manager.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await manager.getByLabel("รหัสผ่าน", { exact: true }).fill(replacement);
  await paceLogin(); await manager.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
  await expect(manager).not.toHaveURL(/\/login$/);
  const origin = new URL(baseURL!).origin;
  const disable = await page.request.patch(`/api/v1/accounts/${accountId}/status`, { data: { status: "disabled", reason: "ทดสอบระงับ session บัญชี" }, headers: { origin } });
  expect(disable.ok(), await disable.text()).toBe(true);
  expect((await manager.request.get("/api/v1/auth/me")).status()).toBe(401);
  await managed.close();
});

for (const actor of ["admin", "hr"]) test(`${actor} approved adjustments apply once without editing source payroll and negative net cannot lock`, async ({ page, baseURL }) => {
  test.setTimeout(90000);
  await login(page, actor);
  const origin = new URL(baseURL!).origin;
  const create = async (path: string, data: unknown) => {
    const response = await page.request.post(`/api/v1${path}`, { data, headers: { origin } });
    expect(response.ok(), `${path}: ${await response.text()}`).toBe(true); return (await response.json()).data;
  };
  const suffix = Date.now().toString(36).toUpperCase();
  const shop = await create("/shops", { code: `ADJ_${suffix}`, name: "ร้านทดสอบรายการปรับปรุง" });
  const branch = await create("/branches", { shop_id: shop.id, code: `AB_${suffix}`, name: "สาขาทดสอบรายการปรับปรุง" });
  const department = await create("/departments", { branch_id: branch.id, code: "TEAM", name: "ทีม" });
  const position = await create("/positions", { shop_id: shop.id, code: "STAFF", name: "พนักงาน" });
  const onboard = await create("/employees/onboard", {
    employee: { employee_code: `AE_${suffix}`, national_id: null, passport_id: `AP${suffix}`, first_name: "ทดสอบ", last_name: "ปรับปรุง", hire_date: "2026-09-30" },
    assignment: { branch_id: branch.id, department_id: department.id, position_id: position.id, employment_type: "full_time", base_salary: "2600.00", welfare_amount: "0.00", effective_from: "2026-09-30" },
    bank_account: { bank_code: "DEMO", bank_name: "ทดสอบ", account_holder_name: "ทดสอบ ปรับปรุง", account_number: "0000000000", is_primary: true },
    weekly_holidays: [{ weekday: 0, effective_from: "2026-09-30" }], account: { username: `adj_${suffix.toLowerCase()}` },
  });
  const employeeId = onboard.employee.id;
  await create("/branch-schedules", { branch_id: branch.id, work_start_time: "09:00", standard_close_time: "18:00", late_grace_minutes: 0, effective_from: "2026-09-30" });
  // Zero SS isolates adjustment accounting from the pending social-security basis decision.
  for (const [config_key, numeric_value, unit] of [["STANDARD_WORK_DAYS", "26", "days"], ["ABSENCE_RATE", "1", "multiplier"], ["LATE_RATE", "0", "currency_per_minute"], ["SOCIAL_SECURITY_RATE", "0", "ratio"], ["SOCIAL_SECURITY_CAP", "750", "currency"]]) {
    await create("/payroll/configurations", { shop_id: shop.id, config_key, numeric_value, unit, effective_from: "2026-09-30" });
  }
  const attendance = (date: string) => create("/work-day-records", { employee_id: employeeId, branch_id: branch.id, work_date: date, status: "present", clock_in_at: `${date}T02:00:00Z`, clock_out_at: `${date}T11:00:00Z`, late_minutes: 0, is_deductible: false });
  await attendance("2026-09-30");
  const source = await create("/payroll/periods", { shop_id: shop.id, period_year: 2026, period_month: 9, start_date: "2026-09-01", end_date: "2026-09-30" });
  const original = await create(`/payroll/periods/${source.id}/lock`, {});
  expect(original.records[0].net_pay).toBe("2600.00");
  const persistedSource = await page.request.get(`/api/v1/payroll/periods/${source.id}`);
  const originalRecordId = (await persistedSource.json()).data.records[0].id;
  const target = await create("/payroll/periods", { shop_id: shop.id, period_year: 2026, period_month: 10, start_date: "2026-10-01", end_date: "2026-10-31" });
  for (let day = 1; day <= 31; day++) { const date = `2026-10-${String(day).padStart(2, "0")}`; if (new Date(`${date}T00:00:00Z`).getUTCDay() !== 0) await attendance(date); }
  await page.goto("/payroll");
  await page.getByRole("combobox", { name: "ร้าน", exact: true }).first().selectOption(shop.id);
  await page.getByRole("button", { name: "เปิดสมุดงาน", exact: true }).click();
  await page.getByText("รายการปรับปรุงหลังล็อกรอบ", { exact: true }).click();
  const adjustmentSection = page.locator("details").filter({ has: page.getByText("รายการปรับปรุงหลังล็อกรอบ", { exact: true }) });
  const sourcePicker = adjustmentSection.locator("fieldset").filter({ hasText: "ต้นทางที่ล็อกแล้ว" });
  const targetPicker = adjustmentSection.locator("fieldset").filter({ hasText: "งวดปลายทาง" });
  await sourcePicker.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
  await sourcePicker.getByRole("combobox", { name: "งวดเงินเดือน", exact: true }).selectOption(source.id);
  await sourcePicker.getByRole("combobox", { name: "พนักงาน", exact: true }).selectOption(originalRecordId);
  await targetPicker.getByRole("combobox", { name: "ร้าน", exact: true }).selectOption(shop.id);
  await targetPicker.getByRole("combobox", { name: "งวดเงินเดือน", exact: true }).selectOption(target.id);
  await adjustmentSection.getByLabel("จำนวนเงิน", { exact: true }).fill("100");
  await adjustmentSection.getByLabel("เหตุผล", { exact: true }).fill("เพิ่มส่วนต่างจากงวดเดิม");
  const requested = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/payroll/adjustments" && response.request().method() === "POST");
  await adjustmentSection.getByRole("button", { name: "ส่งรายการปรับปรุง", exact: true }).click();
  const requestedResponse = await requested; expect(requestedResponse.ok(), await requestedResponse.text()).toBe(true);
  const adjustment = (await requestedResponse.json()).data;
  const approved = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/payroll/adjustments/${adjustment.id}/approve` && response.request().method() === "POST");
  await adjustmentSection.getByRole("button", { name: "อนุมัติ", exact: true }).click();
  expect((await approved).ok()).toBe(true);
  const firstPreview = await create(`/payroll/periods/${target.id}/preview`, {});
  expect(firstPreview.blockers).toEqual([]); expect(firstPreview.records[0].net_pay).toBe("2700.10");
  const secondPreview = await create(`/payroll/periods/${target.id}/preview`, {});
  expect(secondPreview.records[0].net_pay).toBe("2700.10");
  await create(`/payroll/periods/${target.id}/lock`, {});
  for(const [path, data, method] of [
    [`/employees/${employeeId}/assignments`, { branch_id:branch.id,department_id:department.id,position_id:position.id,employment_type:"full_time",base_salary:"9999.00",welfare_amount:"0.00",effective_from:"2026-10-15",effective_to:null }, "POST"],
    [`/employees/${employeeId}/weekly-holidays`, { weekday:6,effective_from:"2026-10-15",effective_to:null }, "POST"],
    [`/employees/${employeeId}/status`, { status:"terminated",terminated_at:"2026-10-15",reason:"cannot change locked coverage" }, "PATCH"],
    ["/payroll/configurations", { shop_id:shop.id,branch_id:branch.id,config_key:"STANDARD_WORK_DAYS",numeric_value:"25",unit:"days",effective_from:"2026-10-15" }, "POST"],
  ] as const) {
    const blocked=await page.request.fetch(`/api/v1${path}`,{method,data,headers:{origin}});
    expect(blocked.ok(),path).toBe(false);expect((await blocked.json()).error.code,path).toBe("PAYROLL_PERIOD_LOCKED");
  }
  const employeeAfterDenied = await page.request.get(`/api/v1/employees/${employeeId}`);
  expect((await employeeAfterDenied.json()).data.status).toBe("active");

  const applied = await page.request.get(`/api/v1/payroll/adjustments?record_id=${originalRecordId}`);
  expect((await applied.json()).data.find((row: { id: string }) => row.id === adjustment.id).status).toBe("applied");
  const preserved = await page.request.get(`/api/v1/payroll/periods/${source.id}`);
  expect((await preserved.json()).data.records[0].net_pay).toBe("2600.00");
  const next = await create("/payroll/periods", { shop_id: shop.id, period_year: 2026, period_month: 11, start_date: "2026-11-01", end_date: "2026-11-30" });
  for (let day = 1; day <= 30; day++) { const date = `2026-11-${String(day).padStart(2, "0")}`; if (new Date(`${date}T00:00:00Z`).getUTCDay() !== 0) await attendance(date); }
  const deduction = await create("/payroll/adjustments", { original_payroll_record_id: originalRecordId, applied_payroll_period_id: next.id, direction: "deduction", amount: "100000", reason: "ทดสอบป้องกันยอดสุทธิติดลบ" });
  await create(`/payroll/adjustments/${deduction.id}/approve`, {});
  const negative = await create(`/payroll/periods/${next.id}/preview`, {});
  expect(negative.blockers.some((row: { code: string }) => row.code === "PAYROLL_NEGATIVE_NET_PAY")).toBe(true);

  await page.goto("/payroll");
  await page.getByRole("combobox",{name:"ร้าน",exact:true}).selectOption(shop.id);
  await page.getByRole("button",{name:"เปิดสมุดงาน",exact:true}).click();
  await expect(page.getByText("งวด 11/2026",{exact:true})).toBeVisible();
  const refreshed=page.waitForResponse(response=>new URL(response.url()).pathname===`/api/v1/payroll/periods/${next.id}/readiness`);
  await page.getByRole("button",{name:"คำนวณตัวอย่าง",exact:true}).click();
  await refreshed;
  await expect(page.getByRole("heading",{name:"ยังล็อกรอบไม่ได้",exact:true})).toBeVisible();
  await expect(page.getByText("เงินสุทธิติดลบ",{exact:true})).toBeVisible();
  const lock = await page.request.post(`/api/v1/payroll/periods/${next.id}/lock`, { data: {}, headers: { origin } });
  expect(lock.ok()).toBe(false); expect((await lock.json()).error.code).toBe("PAYROLL_NEGATIVE_NET_PAY");
});

test("mobile keyboard navigation, error recovery and logout keep session state honest", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page, "employee");
  await page.keyboard.press("Tab");
  await page.getByRole("link", { name: "ข้ามไปยังเนื้อหาหลัก", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.route("**/api/v1/payslips/mine", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "synthetic-internal-detail" }, request_id: "mobile-check" }) }));
  await page.goto("/payslips");
  await expect(page.getByRole("alert").filter({ hasText: /.+/ })).toContainText("ไม่สามารถเปิดสลิปได้");
  await expect(page.getByText("synthetic-internal-detail", { exact: true })).toHaveCount(0);
  await page.unroute("**/api/v1/payslips/mine");
  await page.reload();
  await expect(page.getByRole("heading", { name: "สลิปเงินเดือนของฉัน", exact: true })).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  await page.getByText("เมนูหลัก", { exact: true }).click();
  await page.route("**/api/v1/auth/logout", route => route.abort());
  await page.getByRole("button", { name: "ออกจากระบบ", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /.+/ })).toContainText("ออกจากระบบไม่สำเร็จ");
  expect((await page.request.get("/api/v1/auth/me")).status()).toBe(200);
  await page.unroute("**/api/v1/auth/logout");
  await page.getByRole("button", { name: "ออกจากระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/v1/auth/me")).status()).toBe(401);
});

test("existing employee links through named picker and concurrent links preserve one account per employee", async ({ page, baseURL }) => {
  await login(page, "admin");
  const origin = new URL(baseURL!).origin;
  const suffix = Date.now().toString(36).toUpperCase();
  const create = async (path: string, data: unknown) => {
    const response = await page.request.post(`/api/v1${path}`, { data, headers: { origin } });
    expect(response.ok(), `${path}: ${await response.text()}`).toBe(true); return (await response.json()).data;
  };
  const employeeCode = `LINK_${suffix}`;
  const employee = await create("/employees", { employee_code:employeeCode,passport_id:`LP${suffix}`,first_name:"ทดสอบ",last_name:"ผูกบัญชี",hire_date:"2026-09-01" });
  await page.goto("/accounts/new");
  await page.getByLabel("ชื่อผู้ใช้", { exact:true }).fill(`link_${suffix.toLowerCase()}`);
  await page.getByRole("button", { name:"สร้างบัญชี",exact:true }).click();
  await page.getByRole("button", { name:"ปิดรหัสผ่าน",exact:true }).click();
  await page.getByRole("link", { name:"กำหนดบทบาทบัญชีนี้",exact:true }).click();
  await expect(page.getByRole("button", { name:"เพิ่มบทบาท",exact:true })).toBeDisabled();
  const picker=page.getByPlaceholder("ค้นหาชื่อหรือรหัสพนักงาน", { exact:true });
  await picker.fill(employeeCode);
  await expect(page.locator(`datalist option[value^="${employeeCode}"]`)).toHaveCount(1);
  await picker.fill(`${employeeCode} · ทดสอบ ผูกบัญชี`);
  await page.getByLabel("เหตุผลที่เชื่อมบัญชี", { exact:true }).fill("ตรวจสอบว่าเป็นพนักงานที่ยังไม่มีบัญชี");
  await page.getByRole("button", { name:"เชื่อมพนักงาน",exact:true }).click();
  await expect(page.getByText(/เชื่อมพนักงานแล้ว เลือกบทบาท/)).toBeVisible();
  await expect(page.getByRole("button", { name:"เพิ่มบทบาท",exact:true })).toBeEnabled();
  await page.getByLabel("เหตุผล", { exact:true }).fill("เพิ่มสิทธิ์ดูข้อมูลตนเองหลังเชื่อมบัญชี");
  await page.getByRole("button", { name:"เพิ่มบทบาท",exact:true }).click();
  await expect(page.getByText("เพิ่มบทบาทแล้ว", { exact:true })).toBeVisible();
  const other=await create("/accounts/", {username:`link_other_${suffix.toLowerCase()}`});
  const duplicate=await page.request.post(`/api/v1/accounts/${other.account.id}/employee`,{data:{employee_id:employee.id,reason:"attempt duplicate link"},headers:{origin}});
  expect(duplicate.status()).toBe(409);expect((await duplicate.json()).error.code).toBe("EMPLOYEE_ACCOUNT_ALREADY_EXISTS");
  const raceEmployee=await create("/employees",{employee_code:`RACE_${suffix}`,passport_id:`RP${suffix}`,first_name:"ทดสอบ",last_name:"การผูกพร้อมกัน",hire_date:"2026-09-01"});
  const accountA=await create("/accounts/",{username:`race_a_${suffix.toLowerCase()}`});
  const accountB=await create("/accounts/",{username:`race_b_${suffix.toLowerCase()}`});
  const attempts=await Promise.all([accountA,accountB].map(account=>page.request.post(`/api/v1/accounts/${account.account.id}/employee`,{data:{employee_id:raceEmployee.id,reason:"concurrent synthetic link"},headers:{origin}})));
  expect(attempts.map(response=>response.status()).sort()).toEqual([200,409]);
  const conflict=attempts.find(response=>response.status()===409)!;
  expect((await conflict.json()).error.code).toBe("EMPLOYEE_ACCOUNT_ALREADY_EXISTS");
  const details=await Promise.all([accountA,accountB].map(async account=>(await (await page.request.get(`/api/v1/accounts/${account.account.id}`)).json()).data.account));
  expect(details.filter(account=>account.employee?.id===raceEmployee.id)).toHaveLength(1);
  expect(details.filter(account=>account.employee===null)).toHaveLength(1);
});
