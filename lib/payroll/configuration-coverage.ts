import type { PayrollConfiguration } from "./payroll-api";

export function missingConfigurationCoverage(rows: readonly PayrollConfiguration[], branchId: string, keys: readonly string[], start: string, end: string) {
  const missing: { key: string; date: string }[] = [];
  for (const key of keys) {
    for (const date = new Date(`${start}T00:00:00Z`); date.toISOString().slice(0, 10) <= end; date.setUTCDate(date.getUTCDate() + 1)) {
      const day = date.toISOString().slice(0, 10);
      if (!rows.some((row) => row.config_key === key && (row.branch_id === null || row.branch_id === branchId) && row.effective_from <= day && (row.effective_to === null || row.effective_to >= day))) {
        missing.push({ key, date: day }); break;
      }
    }
  }
  return missing;
}
