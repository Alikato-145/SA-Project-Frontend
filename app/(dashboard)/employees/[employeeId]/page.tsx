import { EmployeeReadView } from "@/features/identity-hr/employees/employee-read-view";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  return (
    <EmployeeReadView key={employeeId} employeeId={employeeId} view="profile" />
  );
}
