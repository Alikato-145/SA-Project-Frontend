import { apiRequest } from "../api/client";

export type Employee = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  status: "active" | "inactive" | "suspended" | "terminated";
  branch_id: string | null;
  department_id: string | null;
};

export const employeeApi = {
  list: () => apiRequest<Employee[]>("/v1/employees?page=1&page_size=50", { credentials: "include" }),
  create: (input: { employee_code: string; national_id: string; first_name: string; last_name: string; hire_date: string }) =>
    apiRequest<Employee>("/v1/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    }),
};
