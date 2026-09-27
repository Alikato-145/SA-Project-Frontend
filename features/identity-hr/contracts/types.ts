export type AccountStatus = "active" | "disabled" | "locked";
export type EmployeeStatus = "active" | "inactive" | "suspended" | "terminated";
export interface RoleGrant {
  id: string;
  role_code: "EMPLOYEE" | "SUPERVISOR" | "BRANCH_MANAGER" | "HR" | "OWNER";
  scope: "self" | "department" | "branch" | "all";
  branch_id: string | null;
  department_id: string | null;
}
export interface AccountSummary {
  id: string;
  username: string;
  employee_id: string | null;
  status: AccountStatus;
  grants: RoleGrant[];
}
export interface OrganizationItem {
  id: string;
  kind: "shop" | "branch" | "department" | "position";
  code: string;
  name: string;
  is_active: boolean;
  parent_id?: string | null;
  parent_name?: string | null;
  timezone?: string | null;
}
export interface EmployeeSummary {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  status: EmployeeStatus;
  branch_id: string | null;
  department_id: string | null;
  position_id: string | null;
  phone?: string | null;
  personal_email?: string | null;
  address?: string | null;
  hire_date?: string;
  terminated_at?: string | null;
  national_id_masked?: string | null;
  passport_id_masked?: string | null;
}
export interface AssignmentItem {
  id: string;
  branch_name: string;
  department_name: string;
  position_name: string;
  employment_type: "full_time" | "part_time" | "temporary";
  base_salary?: string;
  welfare_amount?: string;
  effective_from: string;
  effective_to: string | null;
}
export interface BankAccountSummary {
  id: string;
  bank_code: string;
  bank_name: string;
  account_holder_name: string;
  account_number_last4: string;
  account_number_masked: string;
  is_primary: boolean;
  is_active: boolean;
}
export interface WeeklyHolidayItem {
  id: string;
  weekday: number;
  effective_from: string;
  effective_to: string | null;
}
export interface PageResult<T> {
  data: T[];
  page: number;
  page_size: number;
  total: number;
  request_id: string;
}
export interface IdentityHrOperations {
  login(input: { username: string; password: string }): Promise<void>;
  listAccounts(): Promise<PageResult<AccountSummary>>;
  listOrganization(
    kind: OrganizationItem["kind"],
  ): Promise<PageResult<OrganizationItem>>;
  listEmployees(
    query: Record<string, string>,
  ): Promise<PageResult<EmployeeSummary>>;
  getEmployee(id: string): Promise<EmployeeSummary>;
}
