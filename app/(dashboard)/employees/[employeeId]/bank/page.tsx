import { BankAccounts } from "@/features/identity-hr/employees/bank-accounts";
import {
  previewBanks,
  previewEmployees,
} from "@/features/identity-hr/fixtures/preview-data";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";
import { RequestState } from "@/features/identity-hr/ui/request-states";

export default async function EmployeeBankPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const employee = previewEmployees.find((item) => item.id === employeeId);

  return (
    <PreviewFrame
      title="บัญชีรับเงิน"
      description="เลขบัญชีที่จัดเก็บแล้วแสดงได้เฉพาะรูปแบบปกปิด และบัญชีเดิมยังคงอยู่เพื่อการตรวจสอบ"
    >
      {employee ? (
        <BankAccounts employee={employee} accounts={previewBanks} />
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
