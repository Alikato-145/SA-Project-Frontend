import { AccountDetailView } from "@/features/identity-hr/accounts/account-views";
import { previewAccounts } from "@/features/identity-hr/fixtures/preview-data";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const account = previewAccounts.find((item) => item.id === accountId);

  return (
    <PreviewFrame
      title="รายละเอียดบัญชี"
      description="ตรวจสถานะ ความปลอดภัย และสิทธิ์ที่มีผลอยู่โดยไม่เปิดเผยข้อมูลรับรองลับ"
    >
      <AccountDetailView account={account} />
    </PreviewFrame>
  );
}
