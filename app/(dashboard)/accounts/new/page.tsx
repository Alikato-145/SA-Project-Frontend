import { AccountCreateView } from "@/features/identity-hr/accounts/account-views";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";

export default function NewAccountPage() {
  return (
    <PreviewFrame
      title="สร้างบัญชีผู้ใช้"
      description="แยกบัญชีเข้าสู่ระบบออกจากข้อมูลพนักงาน และกำหนดขอบเขตสิทธิ์ตั้งแต่เริ่มต้น"
    >
      <AccountCreateView />
    </PreviewFrame>
  );
}
