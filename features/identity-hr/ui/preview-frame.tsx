import type { ReactNode } from "react";
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
        <section className={styles.hero}>
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className={styles.stamp}>
            <strong>ข้อมูลบุคลากร</strong>
            <p>ข้อมูลที่แสดงเป็นไปตามสิทธิ์ของบัญชีที่เข้าสู่ระบบ</p>
          </div>
        </section>
        {children}
      </div>
    </div>
  );
}
