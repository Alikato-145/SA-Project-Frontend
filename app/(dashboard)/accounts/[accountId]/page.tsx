import { AccountDetailLive } from "@/features/identity-hr/accounts/account-live";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;

  return (
    <PreviewFrame
      title="รายละเอียดบัญชี"
      description="ตรวจสถานะ ความปลอดภัย และสิทธิ์ที่มีผลอยู่โดยไม่เปิดเผยข้อมูลรับรองลับ"
    >
      <AccountDetailLive accountId={accountId} />
    </PreviewFrame>
  );
}
