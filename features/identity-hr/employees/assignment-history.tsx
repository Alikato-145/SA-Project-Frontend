"use client";

import { type FormEvent, useState } from "react";

import type { AssignmentItem, EmployeeSummary } from "../contracts/types";
import { previewAssignments } from "../fixtures/preview-data";
import { EmployeeTabs, Field, StatusBadge, styles } from "../ui/primitives";
import { RequestState } from "../ui/request-states";

const employmentLabels: Record<AssignmentItem["employment_type"], string> = {
  full_time: "เต็มเวลา",
  part_time: "พาร์ตไทม์",
  temporary: "ชั่วคราว",
};

export function AssignmentHistory({
  employee,
  assignments = previewAssignments,
}: {
  employee: EmployeeSummary;
  assignments?: AssignmentItem[];
}) {
  const current =
    assignments.find((item) => item.effective_to === null) ?? assignments[0];
  const [prepared, setPrepared] = useState(false);

  const prepareChange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPrepared(true);
  };

  return (
    <section aria-labelledby="assignment-heading">
      <div className={styles.sectionHead}>
        <div>
          <h2 id="assignment-heading">
            ประวัติการจ้างของ {employee.first_name}
          </h2>
          <p className={styles.muted}>{employee.employee_code}</p>
        </div>
        <StatusBadge>{assignments.length} ช่วงเวลา</StatusBadge>
      </div>
      <EmployeeTabs id={employee.id} />

      <div className={styles.grid}>
        <section
          className={`${styles.panel} ${styles.span8}`}
          aria-labelledby="assignment-timeline-heading"
        >
          <h3 id="assignment-timeline-heading">เส้นเวลาที่บันทึกไว้</h3>
          {assignments.length === 0 ? (
            <RequestState
              kind="empty"
              title="ยังไม่มีประวัติการจ้าง"
              detail="เริ่มต้นด้วย assignment แรก โดยระบบจะตรวจสาขา แผนก ตำแหน่ง และช่วงวันที่"
            />
          ) : (
            <ol className={styles.timeline}>
              {assignments.map((assignment) => (
                <li className={styles.timelineItem} key={assignment.id}>
                  <div className={styles.sectionHead}>
                    <div>
                      <h3>{assignment.position_name}</h3>
                      <p className={styles.muted}>
                        {assignment.branch_name} · {assignment.department_name}
                      </p>
                    </div>
                    {assignment.effective_to === null ? (
                      <StatusBadge>ช่วงปัจจุบัน</StatusBadge>
                    ) : null}
                  </div>
                  <dl className={styles.kv}>
                    <div>
                      <dt>ช่วงวันที่ (รวมวันเริ่มและวันสิ้นสุด)</dt>
                      <dd>
                        {assignment.effective_from} –{" "}
                        {assignment.effective_to ?? "ปัจจุบัน"}
                      </dd>
                    </div>
                    <div>
                      <dt>ประเภทการจ้าง</dt>
                      <dd>{employmentLabels[assignment.employment_type]}</dd>
                    </div>
                    {"base_salary" in assignment ? (
                      <div>
                        <dt>เงินเดือนฐาน</dt>
                        <dd>
                          {assignment.base_salary
                            ? `฿${assignment.base_salary}`
                            : "ไม่ได้รับอนุญาตให้ดู"}
                        </dd>
                      </div>
                    ) : null}
                    {"welfare_amount" in assignment ? (
                      <div>
                        <dt>สวัสดิการ</dt>
                        <dd>
                          {assignment.welfare_amount
                            ? `฿${assignment.welfare_amount}`
                            : "ไม่ได้รับอนุญาตให้ดู"}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside
          className={`${styles.panel} ${styles.span4}`}
          aria-labelledby="assignment-change-heading"
        >
          <h3 id="assignment-change-heading">เตรียมการเปลี่ยนแปลง</h3>
          <p className={styles.muted}>
            การย้ายสาขา เลื่อนตำแหน่ง
            หรือเปลี่ยนค่าตอบแทนจะสิ้นสุดช่วงเดิมในวันก่อนวันที่ใหม่
            แล้วสร้างช่วงใหม่ ประวัติเดิมไม่ถูกเขียนทับ
          </p>
          <form onSubmit={prepareChange}>
            <div className={styles.formGrid}>
              <Field label="สาขาใหม่">
                <input
                  className={styles.input}
                  name="branch"
                  defaultValue={current?.branch_name ?? ""}
                  required
                />
              </Field>
              <Field label="แผนกใหม่">
                <input
                  className={styles.input}
                  name="department"
                  defaultValue={current?.department_name ?? ""}
                  required
                />
              </Field>
              <Field label="ตำแหน่งใหม่">
                <input
                  className={styles.input}
                  name="position"
                  defaultValue={current?.position_name ?? ""}
                  required
                />
              </Field>
              <Field label="ประเภทการจ้าง">
                <select
                  className={styles.select}
                  name="employment_type"
                  defaultValue={current?.employment_type ?? "full_time"}
                >
                  {Object.entries(employmentLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="เงินเดือนฐาน" hint="เก็บและส่งเป็น decimal string">
                <input
                  className={styles.input}
                  name="base_salary"
                  inputMode="decimal"
                  defaultValue={current?.base_salary ?? ""}
                />
              </Field>
              <Field label="สวัสดิการ" hint="เก็บและส่งเป็น decimal string">
                <input
                  className={styles.input}
                  name="welfare_amount"
                  inputMode="decimal"
                  defaultValue={current?.welfare_amount ?? ""}
                />
              </Field>
              <Field label="มีผลตั้งแต่">
                <input
                  className={styles.input}
                  name="effective_from"
                  type="date"
                  required
                />
              </Field>
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="submit">
                ตรวจสอบช่วงใหม่
              </button>
            </div>
          </form>
          {prepared ? (
            <RequestState
              kind="success"
              title="พร้อมส่งให้บริการกลางตรวจสอบ"
              detail="นี่คือ preview เท่านั้น ระบบจริงต้องตรวจสิทธิ์ ลำดับองค์กร และช่วงวันที่ซ้ำที่เซิร์ฟเวอร์"
            />
          ) : null}
        </aside>
      </div>
    </section>
  );
}
