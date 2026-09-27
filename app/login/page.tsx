import { LoginForm } from "../../features/identity-hr/auth/login-form";
import { styles } from "../../features/identity-hr/ui/primitives";
export default function LoginPage() {
  return (
    <main className={styles.scope}>
      <div className={styles.login}>
        <aside className={styles.loginAside}>
          <div>
            <strong>Haris Payroll</strong>
            <h1>
              คน
              <br />
              เวลา
              <br />
              ความไว้ใจ
            </h1>
            <p>
              ระบบงานบุคคลสำหรับร้านอาหารหลายสาขา
              <br />
              ทุกการเปลี่ยนแปลงตรวจสอบย้อนหลังได้
            </p>
          </div>
          <small>A4 feature preview · ยังไม่เชื่อม cookie จริง</small>
        </aside>
        <section className={styles.loginMain}>
          <div className={styles.loginCard}>
            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
