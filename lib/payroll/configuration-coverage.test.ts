import { test, expect } from "bun:test";
import { missingConfigurationCoverage } from "./configuration-coverage";
import type { PayrollConfiguration } from "./payroll-api";
test("coverage uses shop defaults or the matching branch and detects date gaps", () => {
  const row: PayrollConfiguration = { id: "1", shop_id: "1", branch_id: null, config_key: "STANDARD_WORK_DAYS", numeric_value: "26", unit: "days", effective_from: "2026-09-01", effective_to: "2026-09-15" };
  const keys = [row.config_key];
  expect(missingConfigurationCoverage([row], "1", keys, "2026-09-01", "2026-09-30")).toEqual([{ key: row.config_key, date: "2026-09-16" }]);
  const successor = { ...row, id: "2", branch_id: "1", effective_from: "2026-09-16", effective_to: null };
  expect(missingConfigurationCoverage([row, successor], "1", keys, "2026-09-01", "2026-09-30")).toEqual([]);
  expect(missingConfigurationCoverage([row, successor], "2", keys, "2026-09-01", "2026-09-30")).toHaveLength(1);
});
