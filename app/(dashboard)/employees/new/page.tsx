import { OnboardingForm } from "@/features/identity-hr/onboarding/onboarding-form";
import { PreviewFrame } from "@/features/identity-hr/ui/preview-frame";

export default function NewEmployeePage() {
  return (
    <PreviewFrame
      title="รับพนักงานใหม่"
      description="กรอกตัวตนและข้อมูลการจ้างครั้งแรกเป็นขั้นตอนเดียว ผลลัพธ์ต้องสำเร็จทั้งหมดหรือไม่บันทึกเลย"
    >
      <OnboardingForm />
    </PreviewFrame>
  );
}
