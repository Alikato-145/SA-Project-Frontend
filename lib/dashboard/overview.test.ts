import { expect, test } from "bun:test";
import { latestOwnPayslip } from "./overview";
import type { Payslip } from "@/lib/payslip/payslip-api";

const slip = (id: string, employee_id: string, generated_at: string, status: Payslip["status"] = "generated"): Payslip => ({ id, employee_id, generated_at, status, payroll_record_id: id, total_earnings: "20000.00", total_deductions: "750.00", net_pay: "19250.00" });

test("overview selects the latest generated payslip for the linked employee only", () => {
  const rows = [slip("2", "10", "2026-10-03T00:00:00Z"), slip("1", "10", "2026-09-03T00:00:00Z"), slip("3", "11", "2026-11-03T00:00:00Z"), slip("4", "10", "2026-12-03T00:00:00Z", "voided")];
  expect(latestOwnPayslip(rows, "10")?.id).toBe("2");
  expect(latestOwnPayslip(rows, "12")).toBeNull();
});
