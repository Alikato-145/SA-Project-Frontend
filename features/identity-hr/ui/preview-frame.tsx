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
              <span>พื้นที่งานบุคคล · A4 preview</span>
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
          <div className={styles.stamp}>
            <strong>Feature preview</strong>
            <p>
              ข้อมูลตัวอย่างปลอดความลับ รอเชื่อม shared API client
              และสิทธิ์จริงจาก Person C
            </p>
          </div>
        </section>
        {children}
      </div>
    </div>
  );
}
