import { AssignmentHistory } from "@/features/identity-hr/employees/assignment-history";
import {
  previewAssignments,
  previewEmployees,
} from "@/features/identity-hr/fixtures/preview-data";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";
import { RequestState } from "@/features/identity-hr/ui/request-states";

export default async function EmployeeEmploymentPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const employee = previewEmployees.find((item) => item.id === employeeId);

  return (
    <PreviewFrame
      title="ประวัติการจ้าง"
      description="การย้ายงานและเปลี่ยนค่าตอบแทนสร้างช่วงใหม่เสมอ เพื่อรักษาข้อเท็จจริงย้อนหลัง"
    >
      {employee ? (
        <AssignmentHistory
          employee={employee}
          assignments={previewAssignments}
        />
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
