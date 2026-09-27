"use client";
import { useReducer, useState, type FormEvent } from "react";
import { Field, styles } from "../ui/primitives";
type Step = 1 | 2;
type Draft = {
  step: Step;
  bank: boolean;
  account: boolean;
  bankNumber: string;
  submitted: boolean;
};
type Action = {
  type: "next" | "back" | "toggleBank" | "toggleAccount" | "bank";
  value?: string;
};
const initial: Draft = {
  step: 1,
  bank: false,
  account: false,
  bankNumber: "",
  submitted: false,
};
function reducer(s: Draft, a: Action): Draft {
  switch (a.type) {
    case "next":
      return { ...s, step: 2 };
    case "back":
      return { ...s, step: 1 };
    case "toggleBank":
      return { ...s, bank: !s.bank, bankNumber: s.bank ? "" : s.bankNumber };
    case "toggleAccount":
      return { ...s, account: !s.account };
    case "bank":
      return { ...s, bankNumber: a.value ?? "" };
    default:
      return s;
  }
}
export function OnboardingForm() {
  const [d, dispatch] = useReducer(reducer, initial);
  const [done, setDone] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    dispatch({ type: "bank", value: "" });
    setDone(true);
  };
  if (done)
    return (
      <section className={styles.notice} role="status">
        <strong>แบบฟอร์มพร้อมส่งแบบ Atomic</strong>
        <p>
          เมื่อเชื่อม API สำเร็จ ระบบจะแสดงผลเพียงครั้งเดียว
          และหากขั้นตอนไหนล้มเหลวจะไม่แจ้งว่าบันทึกบางส่วนแล้ว
        </p>
        <button
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={() => setDone(false)}
        >
          สร้างพนักงานอีกคน
        </button>
      </section>
    );
  return (
    <form onSubmit={submit}>
      <div className={styles.steps}>
        <div
          className={`${styles.step} ${d.step === 1 ? styles.stepActive : ""}`}
        >
          1 · ข้อมูลพนักงาน
        </div>
        <div
          className={`${styles.step} ${d.step === 2 ? styles.stepActive : ""}`}
        >
          2 · การจ้างและตัวเลือก
        </div>
      </div>
      {d.step === 1 ? (
        <div className={styles.formGrid}>
          <Field label="รหัสพนักงาน">
            <input
              className={styles.input}
              name="employee_code"
              required
              maxLength={30}
            />
          </Field>
          <Field label="วันที่เริ่มงาน">
            <input
              className={styles.input}
              name="hire_date"
              type="date"
              required
            />
          </Field>
          <Field label="ชื่อ">
            <input className={styles.input} name="first_name" required />
          </Field>
          <Field label="นามสกุล">
            <input className={styles.input} name="last_name" required />
          </Field>
          <Field label="เลขบัตรประชาชน (อย่างน้อยหนึ่งตัวตน)">
            <input className={styles.input} name="national_id" />
          </Field>
          <Field label="เลขหนังสือเดินทาง">
            <input className={styles.input} name="passport_id" />
          </Field>
        </div>
      ) : (
        <>
          <div className={styles.formGrid}>
            <Field label="สาขา">
              <select className={styles.select} required>
                <option>สาขาสุขุมวิท</option>
              </select>
            </Field>
            <Field label="แผนก">
              <select className={styles.select} required>
                <option>ครัว</option>
              </select>
            </Field>
            <Field label="ตำแหน่ง">
              <select className={styles.select} required>
                <option>ผู้ช่วยครัว</option>
              </select>
            </Field>
            <Field label="ประเภทการจ้าง">
              <select className={styles.select}>
                <option value="full_time">เต็มเวลา</option>
                <option value="part_time">ไม่เต็มเวลา</option>
              </select>
            </Field>
            <Field label="เงินเดือนฐาน" hint="ส่งเป็นเลขทศนิยม 2 ตำแหน่ง">
              <input
                className={styles.input}
                inputMode="decimal"
                defaultValue="18000.00"
                pattern="\d+\.\d{2}"
                required
              />
            </Field>
            <Field label="สวัสดิการ">
              <input
                className={styles.input}
                inputMode="decimal"
                defaultValue="0.00"
                pattern="\d+\.\d{2}"
                required
              />
            </Field>
          </div>
          <div className={styles.panel} style={{ marginTop: 16 }}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={d.bank}
                onChange={() => dispatch({ type: "toggleBank" })}
              />
              <span>
                <strong>เพิ่มบัญชีธนาคาร</strong>
                <br />
                <small className={styles.muted}>
                  เลขเต็มอยู่ในฟอร์มชั่วคราวและจะถูกล้างหลังส่ง
                </small>
              </span>
            </label>
            {d.bank ? (
              <Field label="เลขบัญชี">
                <input
                  className={styles.input}
                  value={d.bankNumber}
                  onChange={(e) =>
                    dispatch({ type: "bank", value: e.target.value })
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  required
                />
              </Field>
            ) : null}
            <label className={styles.check} style={{ marginTop: 14 }}>
              <input
                type="checkbox"
                checked={d.account}
                onChange={() => dispatch({ type: "toggleAccount" })}
              />
              <span>
                <strong>สร้างบัญชีเข้าใช้งาน</strong>
                <br />
                <small className={styles.muted}>
                  รหัสผ่านชั่วคราวจะแสดงครั้งเดียวเมื่อสำเร็จ
                </small>
              </span>
            </label>
          </div>
        </>
      )}
      <div className={styles.actions}>
        {d.step === 2 ? (
          <button
            type="button"
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={() => dispatch({ type: "back" })}
          >
            ย้อนกลับ
          </button>
        ) : null}
        {d.step === 1 ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: "next" })}
          >
            ถัดไป
          </button>
        ) : (
          <button className={styles.button}>ตรวจสอบและสร้างพนักงาน</button>
        )}
      </div>
    </form>
  );
}
