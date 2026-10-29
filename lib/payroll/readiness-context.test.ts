import { expect, test } from "bun:test";
import { configurationTarget } from "./readiness-context";

test("selects the employee's branch and the first contiguous missing interval", () => {
  const result = configurationTarget({ employee_id: "1", config_keys: ["LATE_RATE"], dates: ["2026-10-01", "2026-10-02", "2026-10-04"], message: "", href: "" }, [
    { employeeId: "1", employeeCode: "1", employeeName: "A", branchId: "2", branchName: "B", effectiveFrom: "2026-10-01", effectiveTo: "2026-10-02" },
    { employeeId: "1", employeeCode: "1", employeeName: "A", branchId: "3", branchName: "C", effectiveFrom: "2026-10-03", effectiveTo: null },
  ]);
  expect(result).toEqual({ key: "LATE_RATE", branchId: "2", from: "2026-10-01", to: "2026-10-02" });
});
