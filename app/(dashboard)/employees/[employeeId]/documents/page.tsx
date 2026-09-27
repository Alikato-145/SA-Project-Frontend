import { EmployeeDocuments } from "@/features/identity-hr/employees/documents";
import { previewEmployees } from "@/features/identity-hr/fixtures/preview-data";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";
import { RequestState } from "@/features/identity-hr/ui/request-states";

export default async function EmployeeDocumentsPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const employee = previewEmployees.find((item) => item.id === employeeId);

  return (
    <PreviewFrame
      title="เอกสารพนักงาน"
      description="ขอบเขตเอกสารยังถูกเลื่อนไประยะถัดไป หน้านี้จึงไม่จำลองการอัปโหลดหรืออ้างว่าจัดเก็บไฟล์แล้ว"
    >
      {employee ? (
        <EmployeeDocuments employee={employee} />
      ) : (
        <RequestState
          kind="empty"
          title="ไม่พบข้อมูลที่คุณเปิดดูได้"
          detail="กลับไปยังทะเบียนพนักงานเพื่อเลือกบุคคลที่อยู่ในขอบเขตของคุณ"
        />
      )}
    </PreviewFrame>
  );
}
