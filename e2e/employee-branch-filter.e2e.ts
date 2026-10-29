import { expect, test } from "@playwright/test";
import { paceLogin } from "./login-pacing";

for (const username of ["employee", "supervisor", "branch_manager", "hr", "admin"]) {
  test(`${username} filters visible employees by branch and department`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password");
    await paceLogin();
    await page.getByRole("button", { name: "เข้าสู่พื้นที่ทำงาน", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/);
    const roster = await page.request.get("/api/v1/employees?page=1&page_size=100");
    expect(roster.ok()).toBe(true);
    const employee = (await roster.json()).data.find((row: { branch_id: string | null; department_id: string | null }) => row.branch_id && row.department_id);
    expect(employee).toBeDefined();
    await page.goto("/employees");
    const branch = page.getByRole("combobox", { name: "สาขา", exact: true });
    const department = page.getByRole("combobox", { name: "แผนก", exact: true });
    await expect(branch.locator("option")).not.toHaveCount(1);
    const branchValue = employee.branch_id as string;
    await expect(branch.locator(`option[value="${branchValue}"]`)).toHaveCount(1);
    const branchResponse = page.waitForResponse(response => response.url().includes(`/api/v1/employees?`) && response.url().includes(`branch_id=${branchValue}`));
    await branch.selectOption(branchValue!);
    const branchRows = (await (await branchResponse).json()).data;
    expect(branchRows.some((row: { id: string }) => row.id === employee.id)).toBe(true);
    expect(branchRows.every((row: { branch_id: string }) => row.branch_id === branchValue)).toBe(true);
    await expect(department.locator("option")).not.toHaveCount(1);
    const departmentValue = employee.department_id as string;
    await expect(department.locator(`option[value="${departmentValue}"]`)).toHaveCount(1);
    const departmentResponse = page.waitForResponse(response => response.url().includes(`branch_id=${branchValue}`) && response.url().includes(`department_id=${departmentValue}`));
    await department.selectOption(departmentValue!);
    const filtered = (await (await departmentResponse).json()).data;
    expect(filtered.some((row: { id: string }) => row.id === employee.id)).toBe(true);
    expect(filtered.every((row: { branch_id: string; department_id: string }) => row.branch_id === branchValue && row.department_id === departmentValue)).toBe(true);
    await page.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสพนักงาน" }).fill(employee.employee_code);
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    await expect(page.getByRole("list", { name: "รายชื่อพนักงาน" })).toContainText(employee.employee_code);
  });
}
