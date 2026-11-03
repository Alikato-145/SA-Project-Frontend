import type { Payslip } from "@/lib/payslip/payslip-api";

export function latestOwnPayslip(rows: Payslip[], employeeId: string): Payslip | null {
  return rows.filter((row) => row.employee_id === employeeId && row.status === "generated")
    .sort((a, b) => Date.parse(b.generated_at) - Date.parse(a.generated_at))[0] ?? null;
}
