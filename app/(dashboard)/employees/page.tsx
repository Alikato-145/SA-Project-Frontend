import { EmployeeList } from "@/features/identity-hr/employees/employee-list";
import { previewEmployees } from "@/features/identity-hr/fixtures/preview-data";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";

export default function EmployeesPage() {
  return (
    <PreviewFrame
      title="ทะเบียนพนักงาน"
      description="ค้นหาบุคลากรตามขอบเขตสาขาและแผนก พร้อมสถานะที่ใช้ทำงานต่อได้อย่างชัดเจน"
    >
      <EmployeeList employees={previewEmployees} />
    </PreviewFrame>
  );
}
