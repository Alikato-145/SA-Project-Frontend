import { AccountListLive } from "@/features/identity-hr/accounts/account-live";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";

export default function AccountsPage() {
  return (
    <PreviewFrame
      title="บัญชีผู้ใช้"
      description="ดูสถานะ การเชื่อมกับพนักงาน และขอบเขตบทบาทจากทะเบียนเดียว"
    >
      <AccountListLive />
    </PreviewFrame>
  );
}
