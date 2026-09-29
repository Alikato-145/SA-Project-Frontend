import { EmployeeDocumentsLive } from "@/features/identity-hr/employees/documents";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";

export default async function EmployeeDocumentsPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  return (
    <PreviewFrame
      title="เอกสารพนักงาน"
      description="พื้นที่เอกสารยังไม่เปิดใช้งาน รายละเอียดพนักงานแสดงตามสิทธิ์ของบัญชีที่เข้าสู่ระบบ"
    >
      <EmployeeDocumentsLive employeeId={employeeId} />
    </PreviewFrame>
  );
}
