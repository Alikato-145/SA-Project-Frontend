import { previewOrganization } from "@/features/identity-hr/fixtures/preview-data";
import { OrganizationView } from "@/features/identity-hr/organization/organization-views";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";

export default function OrganizationPage() {
  return (
    <PreviewFrame
      title="โครงสร้างองค์กร"
      description="ดูความสัมพันธ์ของร้าน สาขา แผนก และตำแหน่ง พร้อมรักษาประวัติด้วยการปิดใช้งานแทนการลบ"
    >
      <OrganizationView items={previewOrganization} />
    </PreviewFrame>
  );
}
