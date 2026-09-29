import Link from "next/link";
import type { ReactNode } from "react";
import { identityHrRoutes } from "../route-metadata";
import { styles } from "./primitives";
export function PreviewFrame({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.scope}>
      <div className={styles.frame}>
        <header className={styles.masthead}>
          <Link className={styles.brand} href="/employees">
            <span className={styles.brandMark}>H</span>
            <span>
              <strong>Haris Payroll</strong>
              <span>พื้นที่งานบุคคล</span>
            </span>
          </Link>
          <nav className={styles.nav} aria-label="เมนูงานบุคคล">
            {identityHrRoutes.map((i) => (
              <Link href={i.href} key={i.href}>
                {i.label}
              </Link>
            ))}
          </nav>
        </header>
        <section className={styles.hero}>
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className={styles.stamp} role="status">
            <strong>ข้อมูลตัวอย่าง</strong>
            <p>หน้านี้ใช้สำหรับดูรูปแบบข้อมูล งานบันทึกและสิทธิ์จริงจะใช้เมื่อเชื่อมระบบส่วนกลางแล้ว</p>
          </div>
        </section>
        {children}
      </div>
    </div>
  );
}
