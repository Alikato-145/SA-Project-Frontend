import type { PayrollPaymentRow } from "./payroll-payment-api";
type Category = PayrollPaymentRow["group"];
type Bucket = { count: number; amount: bigint };
export type CategorySummary = { branchId: string; branchName: string; groups: Record<Category, Bucket> };
export function summarizePaymentCategories(rows: PayrollPaymentRow[]): CategorySummary[] {
  const branches = new Map<string, CategorySummary>();
  for (const row of rows) {
    let branch = branches.get(row.branch_id);
    if (!branch) {
      branch = { branchId: row.branch_id, branchName: row.branch_name, groups: { cash: { count: 0, amount: BigInt(0) }, transfer: { count: 0, amount: BigInt(0) }, social_security: { count: 0, amount: BigInt(0) } } };
      branches.set(row.branch_id, branch);
    }
    const [whole, fraction = ""] = row.amount.split(".");
    if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(fraction)) throw new Error("Invalid payment amount");
    branch.groups[row.group].count += 1;
    branch.groups[row.group].amount += BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0") || "0");
  }
  return [...branches.values()];
}
export const categoryAmount = (satang: bigint) => `${satang / BigInt(100)}.${String(satang % BigInt(100)).padStart(2, "0")}`;
export const formatCategoryAmount = (satang: bigint) => `${new Intl.NumberFormat("th-TH").format(satang / BigInt(100))}.${String(satang % BigInt(100)).padStart(2, "0")}`;
