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
      description="แนบและดาวน์โหลดเอกสารพนักงานตามขอบเขตสิทธิ์ เอกสารที่บันทึกจะเก็บเป็นหลักฐาน"
    >
      <EmployeeDocumentsLive employeeId={employeeId} />
    </PreviewFrame>
  );
}
