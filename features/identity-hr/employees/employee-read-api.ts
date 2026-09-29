import { apiRequest, apiRequestPage } from "@/lib/api/client";

import type {
  BankAccountSummary,
  EmployeeStatus,
  EmployeeSummary,
  WeeklyHolidayItem,
} from "../contracts/types";

export interface EmployeeAssignment {
  id: string;
  employee_id: string;
  branch_id: string;
  department_id: string;
  position_id: string;
  employment_type: "full_time" | "part_time" | "temporary";
  base_salary: string;
  welfare_amount: string;
  effective_from: string;
  effective_to: string | null;
  is_primary: boolean;
}

export interface EmployeeListFilters {
  page: number;
  search: string;
  status: "all" | EmployeeStatus;
}

export type NewAssignment = Pick<
  EmployeeAssignment,
  | "branch_id"
  | "department_id"
  | "position_id"
  | "employment_type"
  | "base_salary"
  | "welfare_amount"
  | "effective_from"
  | "effective_to"
>;
export type NewBank = Pick<
  BankAccountSummary,
  "bank_code" | "bank_name" | "account_holder_name"
> & {
  account_number: string;
  is_primary?: boolean;
};
export type BankUpdate = Partial<
  Pick<
    NewBank,
    "bank_code" | "bank_name" | "account_holder_name" | "account_number"
  >
>;
export type NewHoliday = Pick<
  WeeklyHolidayItem,
  "weekday" | "effective_from" | "effective_to"
>;

const options = (signal?: AbortSignal) => ({
  credentials: "include" as const,
  signal,
});

export const employeeReadApi = {
  list(filters: EmployeeListFilters, signal?: AbortSignal) {
    const query = new URLSearchParams({
      page: String(filters.page),
      page_size: "20",
    });
    if (filters.search.trim()) query.set("search", filters.search.trim());
    if (filters.status !== "all") query.set("status", filters.status);
    return apiRequestPage<EmployeeSummary>(
      `/v1/employees?${query}`,
      options(signal),
    );
  },
  get(employeeId: string, signal?: AbortSignal) {
    return apiRequest<EmployeeSummary>(
      `/v1/employees/${encodeURIComponent(employeeId)}`,
      options(signal),
    );
  },
  assignments(employeeId: string, signal?: AbortSignal) {
    return apiRequest<EmployeeAssignment[]>(
      `/v1/employees/${encodeURIComponent(employeeId)}/assignments`,
      options(signal),
    );
  },
  bankAccounts(employeeId: string, signal?: AbortSignal) {
    return apiRequest<BankAccountSummary[]>(
      `/v1/employees/${encodeURIComponent(employeeId)}/bank-accounts`,
      options(signal),
    );
  },
  weeklyHolidays(employeeId: string, signal?: AbortSignal) {
    return apiRequest<WeeklyHolidayItem[]>(
      `/v1/employees/${encodeURIComponent(employeeId)}/weekly-holidays`,
      options(signal),
    );
  },
  addAssignment(employeeId: string, input: NewAssignment) {
    return apiRequest<{
      created: EmployeeAssignment;
      closed: EmployeeAssignment | null;
    }>(
      `/v1/employees/${encodeURIComponent(employeeId)}/assignments`,
      mutation("POST", input),
    );
  },
  addBankAccount(employeeId: string, input: NewBank) {
    return apiRequest<BankAccountSummary>(
      `/v1/employees/${encodeURIComponent(employeeId)}/bank-accounts`,
      mutation("POST", input),
    );
  },
  updateBankAccount(employeeId: string, bankId: string, input: BankUpdate) {
    return apiRequest<BankAccountSummary>(
      `/v1/employees/${encodeURIComponent(employeeId)}/bank-accounts/${encodeURIComponent(bankId)}`,
      mutation("PATCH", input),
    );
  },
  makePrimaryBankAccount(employeeId: string, bankId: string) {
    return apiRequest<BankAccountSummary>(
      `/v1/employees/${encodeURIComponent(employeeId)}/bank-accounts/${encodeURIComponent(bankId)}/make-primary`,
      mutation("POST"),
    );
  },
  deactivateBankAccount(
    employeeId: string,
    bankId: string,
    input: { replacement_bank_account_id?: string; allow_no_primary?: boolean },
  ) {
    return apiRequest<{
      deactivated: BankAccountSummary;
      replacement: BankAccountSummary | null;
    }>(
      `/v1/employees/${encodeURIComponent(employeeId)}/bank-accounts/${encodeURIComponent(bankId)}/deactivate`,
      mutation("POST", input),
    );
  },
  addWeeklyHoliday(employeeId: string, input: NewHoliday) {
    return apiRequest<{
      created: WeeklyHolidayItem;
      closed: WeeklyHolidayItem | null;
    }>(
      `/v1/employees/${encodeURIComponent(employeeId)}/weekly-holidays`,
      mutation("POST", input),
    );
  },
  endWeeklyHoliday(employeeId: string, holidayId: string, effectiveTo: string) {
    return apiRequest<WeeklyHolidayItem>(
      `/v1/employees/${encodeURIComponent(employeeId)}/weekly-holidays/${encodeURIComponent(holidayId)}/end`,
      mutation("POST", { effective_to: effectiveTo }),
    );
  },
};

function mutation(method: "POST" | "PATCH", body?: object) {
  return {
    method,
    credentials: "include" as const,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  };
}
