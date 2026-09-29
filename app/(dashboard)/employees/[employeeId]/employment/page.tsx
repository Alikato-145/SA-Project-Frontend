import { EmployeeReadView } from "@/features/identity-hr/employees/employee-read-view";

export default async function EmployeeEmploymentPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  return (
    <EmployeeReadView
      key={employeeId}
      employeeId={employeeId}
      view="employment"
    />
  );
}
