import { OrganizationLive } from "@/features/identity-hr/organization/organization-live";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";

export default function OrganizationPage() {
  return (
    <PreviewFrame
      title="โครงสร้างองค์กร"
      description="ดูความสัมพันธ์ของร้าน สาขา แผนก และตำแหน่ง พร้อมรักษาประวัติด้วยการปิดใช้งานแทนการลบ"
    >
      <OrganizationLive />
    </PreviewFrame>
  );
}
