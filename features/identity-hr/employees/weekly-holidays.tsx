"use client";

import { type FormEvent, useState } from "react";

import type { EmployeeSummary, WeeklyHolidayItem } from "../contracts/types";
import { previewHolidays } from "../fixtures/preview-data";
import { EmployeeTabs, Field, StatusBadge, styles } from "../ui/primitives";
import { RequestState } from "../ui/request-states";

const weekdayLabels = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];

export function WeeklyHolidays({
  employee,
  holidays = previewHolidays,
}: {
  employee: EmployeeSummary;
  holidays?: WeeklyHolidayItem[];
}) {
  const [prepared, setPrepared] = useState(false);

  const prepareHoliday = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPrepared(true);
  };

  return (
    <section aria-labelledby="holiday-heading">
      <div className={styles.sectionHead}>
        <div>
          <h2 id="holiday-heading">
            วันหยุดประจำสัปดาห์ของ {employee.first_name}
          </h2>
          <p className={styles.muted}>
            ช่วงวันที่มีผลรวมทั้งวันเริ่มและวันสิ้นสุด
          </p>
        </div>
        <StatusBadge>
          {holidays.filter((item) => item.effective_to === null).length}{" "}
          วันที่ใช้อยู่
        </StatusBadge>
      </div>
      <EmployeeTabs id={employee.id} />

      <div className={styles.grid}>
        <section
          className={`${styles.panel} ${styles.span8}`}
          aria-labelledby="holiday-history-heading"
        >
          <h3 id="holiday-history-heading">ประวัติวันหยุด</h3>
          {holidays.length === 0 ? (
            <RequestState
              kind="empty"
              title="ยังไม่มีวันหยุดประจำสัปดาห์"
              detail="เพิ่มช่วงวันหยุดแรกได้เมื่อมีสิทธิ์ ระบบจะตรวจไม่ให้วันเดียวกันมีช่วงวันที่ซ้อนกัน"
            />
          ) : (
            <ol className={styles.timeline}>
              {holidays.map((holiday) => (
                <li className={styles.timelineItem} key={holiday.id}>
                  <div className={styles.sectionHead}>
                    <h3>
                      วัน
                      {weekdayLabels[holiday.weekday] ??
                        `หมายเลข ${holiday.weekday}`}
                    </h3>
                    {holiday.effective_to === null ? (
                      <StatusBadge>ใช้อยู่</StatusBadge>
                    ) : (
                      <StatusBadge tone="warn">สิ้นสุดแล้ว</StatusBadge>
                    )}
                  </div>
                  <p>
                    {holiday.effective_from} –{" "}
                    {holiday.effective_to ?? "ปัจจุบัน"}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside
          className={`${styles.panel} ${styles.span4}`}
          aria-labelledby="holiday-change-heading"
        >
          <h3 id="holiday-change-heading">เตรียมเปลี่ยนวันหยุด</h3>
          <p className={styles.muted}>
            ระบบจะปิดช่วงเดิมก่อนวันเริ่มใหม่หนึ่งวันและสร้างรายการใหม่
            ประวัติเดิมจะยังคงอยู่
          </p>
          <form onSubmit={prepareHoliday}>
            <div className={styles.formGrid}>
              <Field label="วันหยุดใหม่">
                <select
                  className={styles.select}
                  name="weekday"
                  defaultValue="0"
                >
                  {weekdayLabels.map((label, index) => (
                    <option key={label} value={index}>
                      วัน{label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="มีผลตั้งแต่">
                <input
                  className={styles.input}
                  name="effective_from"
                  type="date"
                  required
                />
              </Field>
              <Field
                label="สิ้นสุด (ถ้ามี)"
                hint="ปล่อยว่างสำหรับช่วงที่ยังใช้อยู่"
              >
                <input
                  className={styles.input}
                  name="effective_to"
                  type="date"
                />
              </Field>
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="submit">
                ตรวจสอบช่วงวันหยุด
              </button>
            </div>
          </form>
          {prepared ? (
            <RequestState
              kind="success"
              title="พร้อมให้เซิร์ฟเวอร์ตรวจสอบ"
              detail="preview ยังไม่ได้เปลี่ยนประวัติ ระบบจริงต้องตรวจสิทธิ์และช่วงวันที่ซ้ำก่อนบันทึกแบบธุรกรรมเดียว"
            />
          ) : null}
        </aside>
      </div>
    </section>
  );
}
