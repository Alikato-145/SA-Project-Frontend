import type { ReactNode } from "react";

import type { EmployeeStatus, EmployeeSummary } from "../contracts/types";
import { EmployeeTabs, StatusBadge, styles } from "../ui/primitives";
import { RequestState } from "../ui/request-states";

const statusLabels: Record<EmployeeStatus, string> = {
  active: "ทำงานอยู่",
  inactive: "พักการใช้งาน",
  suspended: "ระงับชั่วคราว",
  terminated: "สิ้นสุดการจ้าง",
};

function OptionalFact({
  present,
  label,
  children,
}: {
  present: boolean;
  label: string;
  children: ReactNode;
}) {
  if (!present) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function EmployeeProfile({ employee }: { employee?: EmployeeSummary }) {
  if (!employee) {
    return (
      <RequestState
        kind="empty"
        title="ไม่พบข้อมูลที่คุณเปิดดูได้"
        detail="ตรวจสอบลิงก์หรือกลับไปยังทะเบียนพนักงาน ระบบไม่ยืนยันว่ารายการนอกขอบเขตมีอยู่หรือไม่"
      />
    );
  }

  const name = `${employee.first_name} ${employee.last_name}`;
  const tone =
    employee.status === "active"
      ? "ok"
      : employee.status === "terminated"
        ? "danger"
        : "warn";

  return (
    <article aria-labelledby="employee-name">
      <div className={styles.sectionHead}>
        <div>
          <h2 id="employee-name">{name}</h2>
          <p className={styles.muted}>{employee.employee_code}</p>
        </div>
        <StatusBadge tone={tone}>{statusLabels[employee.status]}</StatusBadge>
      </div>
      <EmployeeTabs id={employee.id} />

      <div className={styles.grid}>
        <section
          className={`${styles.panel} ${styles.span8}`}
          aria-labelledby="profile-work-heading"
        >
          <h3 id="profile-work-heading">ข้อมูลการทำงานปัจจุบัน</h3>
          <dl className={styles.kv}>
            <div>
              <dt>รหัสพนักงาน</dt>
              <dd>{employee.employee_code}</dd>
            </div>
            <div>
              <dt>สถานะ</dt>
              <dd>{statusLabels[employee.status]}</dd>
            </div>
            <div>
              <dt>สาขา</dt>
              <dd>
                {employee.branch_id
                  ? `#${employee.branch_id}`
                  : "ยังไม่มีข้อมูล"}
              </dd>
            </div>
            <div>
              <dt>แผนก</dt>
              <dd>
                {employee.department_id
                  ? `#${employee.department_id}`
                  : "ยังไม่มีข้อมูล"}
              </dd>
            </div>
            <div>
              <dt>ตำแหน่ง</dt>
              <dd>
                {employee.position_id
                  ? `#${employee.position_id}`
                  : "ยังไม่มีข้อมูล"}
              </dd>
            </div>
            <OptionalFact
              present={"hire_date" in employee}
              label="วันที่เริ่มงาน"
            >
              {employee.hire_date ?? "ยังไม่มีข้อมูล"}
            </OptionalFact>
            <OptionalFact
              present={"terminated_at" in employee}
              label="วันที่สิ้นสุดการจ้าง"
            >
              {employee.terminated_at ?? "ยังไม่สิ้นสุดการจ้าง"}
            </OptionalFact>
          </dl>
        </section>

        <aside
          className={`${styles.panel} ${styles.span4}`}
          aria-labelledby="profile-scope-heading"
        >
          <h3 id="profile-scope-heading">ข้อมูลตามสิทธิ์</h3>
          <p className={styles.muted}>
            หน้านี้สร้างเฉพาะช่องที่ API ส่งมา
            ช่องที่ไม่ได้รับจะไม่ถูกเติมค่าเดาหรือข้อความแทน
          </p>
          <StatusBadge tone="warn">เซิร์ฟเวอร์เป็นผู้ตัดสินสิทธิ์</StatusBadge>
        </aside>

        {("phone" in employee ||
          "personal_email" in employee ||
          "address" in employee) && (
          <section
            className={`${styles.panel} ${styles.span6}`}
            aria-labelledby="profile-contact-heading"
          >
            <h3 id="profile-contact-heading">ข้อมูลติดต่อ</h3>
            <dl className={styles.kv}>
              <OptionalFact present={"phone" in employee} label="โทรศัพท์">
                {employee.phone ?? "ไม่ได้ระบุ"}
              </OptionalFact>
              <OptionalFact
                present={"personal_email" in employee}
                label="อีเมลส่วนตัว"
              >
                {employee.personal_email ?? "ไม่ได้ระบุ"}
              </OptionalFact>
              <OptionalFact present={"address" in employee} label="ที่อยู่">
                {employee.address ?? "ไม่ได้ระบุ"}
              </OptionalFact>
            </dl>
          </section>
        )}

        {("national_id_masked" in employee ||
          "passport_id_masked" in employee) && (
          <section
            className={`${styles.panel} ${styles.span6}`}
            aria-labelledby="profile-identity-heading"
          >
            <h3 id="profile-identity-heading">เอกสารยืนยันตัวตนแบบปกปิด</h3>
            <dl className={styles.kv}>
              <OptionalFact
                present={"national_id_masked" in employee}
                label="บัตรประชาชน"
              >
                {employee.national_id_masked ?? "ไม่ได้ระบุ"}
              </OptionalFact>
              <OptionalFact
                present={"passport_id_masked" in employee}
                label="หนังสือเดินทาง"
              >
                {employee.passport_id_masked ?? "ไม่ได้ระบุ"}
              </OptionalFact>
            </dl>
          </section>
        )}
      </div>
    </article>
  );
}
