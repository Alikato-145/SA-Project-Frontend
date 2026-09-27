import { EmployeeProfile } from "@/features/identity-hr/employees/employee-profile";
import { previewEmployees } from "@/features/identity-hr/fixtures/preview-data";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const employee = previewEmployees.find((item) => item.id === employeeId);

  return (
    <PreviewFrame
      title="แฟ้มพนักงาน"
      description="แสดงเฉพาะข้อมูลที่ response ตามสิทธิ์ส่งมา และเชื่อมไปยังประวัติที่เก็บตามช่วงเวลา"
    >
      <EmployeeProfile employee={employee} />
    </PreviewFrame>
  );
}
