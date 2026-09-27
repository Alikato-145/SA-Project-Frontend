import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./identity-hr.module.css";
export { styles };
export function StatusBadge({
  tone = "ok",
  children,
}: {
  tone?: "ok" | "warn" | "danger";
  children: ReactNode;
}) {
  return (
    <span
      className={`${styles.status} ${tone === "warn" ? styles.statusWarn : tone === "danger" ? styles.statusDanger : ""}`}
    >
      {children}
    </span>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
      {hint ? <small className={styles.muted}>{hint}</small> : null}
    </div>
  );
}
export function EmployeeTabs({ id }: { id: string }) {
  const b = `/employees/${id}`;
  return (
    <nav className={styles.tabs} aria-label="ข้อมูลพนักงาน">
      <Link href={b}>ข้อมูลทั่วไป</Link>
      <Link href={`${b}/employment`}>ประวัติการจ้าง</Link>
      <Link href={`${b}/bank`}>บัญชีธนาคาร</Link>
      <Link href={`${b}/weekly-holidays`}>วันหยุด</Link>
      <Link href={`${b}/documents`}>เอกสาร</Link>
    </nav>
  );
}
