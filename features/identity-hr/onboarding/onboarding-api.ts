import { apiRequest } from "@/lib/api/client";

export type Choice = { id: string; code: string; name: string };
export type BranchChoice = Choice & { shop_id: string };
export type DepartmentChoice = Choice & { branch_id: string };
export type PositionChoice = Choice & { shop_id: string };

export type OnboardingInput = {
  employee: {
    employee_code: string;
    national_id: string | null;
    passport_id: string | null;
    first_name: string;
    last_name: string;
    hire_date: string;
  };
  assignment: {
    branch_id: string;
    department_id: string;
    position_id: string;
    employment_type: "full_time" | "part_time" | "temporary";
    base_salary: string;
    welfare_amount: string;
    effective_from: string;
  };
  bank_account?: {
    bank_code: string;
    bank_name: string;
    account_holder_name: string;
    account_number: string;
    is_primary: true;
  };
  weekly_holidays?: { weekday: number; effective_from: string }[];
  account?: { username: string };
};

export type OnboardingResult = {
  employee: {
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
  };
  assignment_id: string;
  bank_account_id: string | null;
  weekly_holiday_ids: string[];
  account_id: string | null;
  temporary_password?: string;
};

const PAGE_SIZE = 100;
async function listAll<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const batch = await apiRequest<T[]>(
      `${path}${separator}page=${page}&page_size=${PAGE_SIZE}`,
      { credentials: "include", signal },
    );
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

export const onboardingApi = {
  shops: (signal?: AbortSignal) =>
    listAll<Choice>("/v1/shops?is_active=true", signal),
  branches: (shopId: string, signal?: AbortSignal) =>
    listAll<BranchChoice>(
      `/v1/branches?is_active=true&shop_id=${encodeURIComponent(shopId)}`,
      signal,
    ),
  departments: (branchId: string, signal?: AbortSignal) =>
    listAll<DepartmentChoice>(
      `/v1/departments?is_active=true&branch_id=${encodeURIComponent(branchId)}`,
      signal,
    ),
  positions: (shopId: string, signal?: AbortSignal) =>
    listAll<PositionChoice>(
      `/v1/positions?is_active=true&shop_id=${encodeURIComponent(shopId)}`,
      signal,
    ),
  onboard: (input: OnboardingInput) =>
    apiRequest<OnboardingResult>("/v1/employees/onboard", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
};
