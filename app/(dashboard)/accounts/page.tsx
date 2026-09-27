import { AccountListView } from "@/features/identity-hr/accounts/account-views";
import { previewAccounts } from "@/features/identity-hr/fixtures/preview-data";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";

export default function AccountsPage() {
  return (
    <PreviewFrame
      title="บัญชีผู้ใช้"
      description="ดูสถานะ การเชื่อมกับพนักงาน และขอบเขตบทบาทจากทะเบียนเดียว"
    >
      <AccountListView accounts={previewAccounts} />
    </PreviewFrame>
  );
}
