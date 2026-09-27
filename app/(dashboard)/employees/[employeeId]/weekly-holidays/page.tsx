import { WeeklyHolidays } from "@/features/identity-hr/employees/weekly-holidays";
import {
  previewEmployees,
  previewHolidays,
} from "@/features/identity-hr/fixtures/preview-data";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";
import { RequestState } from "@/features/identity-hr/ui/request-states";

export default async function EmployeeWeeklyHolidaysPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const employee = previewEmployees.find((item) => item.id === employeeId);

  return (
    <PreviewFrame
      title="วันหยุดประจำสัปดาห์"
      description="กำหนดวันหยุดด้วยช่วงวันที่ที่ไม่ซ้อนกัน และคงประวัติของรอบเดิมไว้"
    >
      {employee ? (
        <WeeklyHolidays employee={employee} holidays={previewHolidays} />
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
