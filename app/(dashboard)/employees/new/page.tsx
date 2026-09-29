import { OnboardingForm } from "@/features/identity-hr/onboarding/onboarding-form";
import { styles } from "@/features/identity-hr/ui/primitives";

export default function NewEmployeePage() {
  return (
    <section className={styles.scope}>
      <div className={styles.frame}>
        <header className={styles.sectionHead}>
          <div>
            <h1>รับพนักงานใหม่</h1>
            <p className={styles.muted}>
              กรอกข้อมูลพนักงานและการจ้างครั้งแรก ระบบจะบันทึกทุกส่วนพร้อมกัน
            </p>
          </div>
        </header>
        <OnboardingForm />
      </div>
    </section>
  );
}
