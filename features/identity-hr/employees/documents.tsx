import type { EmployeeSummary } from "../contracts/types";
import { EmployeeTabs, StatusBadge, styles } from "../ui/primitives";
import { RequestState } from "../ui/request-states";

export function EmployeeDocuments({ employee }: { employee: EmployeeSummary }) {
  return (
    <section aria-labelledby="documents-heading">
      <div className={styles.sectionHead}>
        <div>
          <h2 id="documents-heading">เอกสารของ {employee.first_name}</h2>
          <p className={styles.muted}>{employee.employee_code}</p>
        </div>
        <StatusBadge tone="warn">อยู่นอกขอบเขต demo</StatusBadge>
      </div>
      <EmployeeTabs id={employee.id} />
      <div className={styles.grid}>
        <div className={styles.span8}>
          <RequestState
            kind="empty"
            title="การแนบเอกสารยังไม่รวมใน demo นี้"
            detail="หน้านี้มีไว้ยืนยันขอบเขตเท่านั้น ยังไม่มีการเลือกไฟล์ อัปโหลด จัดเก็บ หรือ OCR เพื่อไม่ให้ผู้ใช้เข้าใจว่าข้อมูลถูกบันทึกแล้ว"
          />
        </div>
        <aside className={`${styles.panel} ${styles.span4}`}>
          <h3>เมื่อเพิ่มในระยะถัดไป</h3>
          <p className={styles.muted}>
            ต้องกำหนดชนิดเอกสาร สิทธิ์เข้าถึง อายุการเก็บรักษา การปกปิดข้อมูล
            และหลักฐานการตรวจสอบก่อน จึงจะเปิดรับไฟล์จริง
          </p>
        </aside>
      </div>
    </section>
  );
}
