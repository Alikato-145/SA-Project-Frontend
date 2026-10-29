import { expect, test } from 'bun:test';
import { groupPayrollByBranch } from './branch-groups';

test('groups each payroll record once by its recorded branch', () => {
  const rows = [{ branch_id: '1', employee_id: 'a' }, { branch_id: '2', employee_id: 'b' }, { branch_id: '1', employee_id: 'c' }];
  expect(groupPayrollByBranch(rows)).toEqual([
    { branchId: '1', records: [rows[0], rows[2]] },
    { branchId: '2', records: [rows[1]] },
  ]);
  expect(groupPayrollByBranch([])).toEqual([]);
});
