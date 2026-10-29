export function groupPayrollByBranch<T extends { branch_id: string }>(records: readonly T[]): { branchId: string; records: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const group = groups.get(record.branch_id) ?? [];
    group.push(record);
    groups.set(record.branch_id, group);
  }
  return [...groups].map(([branchId, rows]) => ({ branchId, records: rows }));
}
