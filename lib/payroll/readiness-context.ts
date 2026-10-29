import type { PayrollReadiness, PayrollRosterEntry } from "./payroll-api";
type Issue = PayrollReadiness["checks"][number]["issues"][number];
export function configurationTarget(issue: Issue, roster: PayrollRosterEntry[]): { key: string; branchId: string; from: string; to: string } | null {
  const dates = [...(issue.dates ?? [])].sort();
  const from = dates[0];
  const key = issue.config_keys?.[0];
  const assignment = roster.find(row => row.employeeId === issue.employee_id && from && row.effectiveFrom <= from && (!row.effectiveTo || row.effectiveTo >= from));
  if (!from || !key || !assignment) return null;
  let to = from;
  for (const date of dates.slice(1)) {
    const next = new Date(`${to}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    if (next.toISOString().slice(0, 10) !== date || (assignment.effectiveTo && date > assignment.effectiveTo)) break;
    to = date;
  }
  return { key, branchId: assignment.branchId, from, to };
}
