import { expect, test } from "bun:test";
import { categoryAmount, formatCategoryAmount, summarizePaymentCategories } from "./payment-category-summary";
import type { PayrollPaymentRow } from "./payroll-payment-api";
test("groups all employee payment categories by branch without losing satang", () => {
  const rows = [
    { branch_id: "1", branch_name: "A", group: "cash", amount: "100.01" },
    { branch_id: "1", branch_name: "A", group: "cash", amount: "0.99" },
    { branch_id: "1", branch_name: "A", group: "social_security", amount: "50.00" },
    { branch_id: "2", branch_name: "B", group: "transfer", amount: "30.10" },
  ] as PayrollPaymentRow[];
  const branches = summarizePaymentCategories(rows);
  expect(branches[0].groups.cash.count).toBe(2);
  expect(categoryAmount(branches[0].groups.cash.amount)).toBe("101.00");
  expect(categoryAmount(branches[0].groups.social_security.amount)).toBe("50.00");
  expect(categoryAmount(branches[1].groups.transfer.amount)).toBe("30.10");
  expect(formatCategoryAmount(BigInt("9007199254740993"))).toBe("90,071,992,547,409.93");
});
