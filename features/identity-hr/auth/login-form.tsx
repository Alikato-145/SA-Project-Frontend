"use client";
import { useState, type FormEvent } from "react";
import { styles } from "../ui/primitives";
type DemoState =
  | "idle"
  | "submitting"
  | "invalid"
  | "locked"
  | "disabled"
  | "success";
const messages: Record<
  Exclude<DemoState, "idle" | "submitting">,
  { title: string; detail: string }
> = {
  invalid: {
    title: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
    detail: "ตรวจสอบข้อมูลแล้วลองอีกครั้ง ระบบไม่ระบุว่าส่วนใดไม่ถูกต้อง",
  },
  locked: {
    title: "บัญชีถูกล็อกชั่วคราว",
    detail: "รอ 15 นาทีแล้วลองใหม่ หรือติดต่อ HR หากจำเป็นต้องเข้าใช้งานด่วน",
  },
  disabled: {
    title: "บัญชีนี้ถูกระงับ",
    detail: "ติดต่อ HR หรือ Owner เพื่อตรวจสอบสถานะบัญชี",
  },
  success: {
    title: "ตรวจสอบข้อมูลแล้ว",
    detail: "เมื่อเชื่อม shared auth client ระบบจะพาเข้าสู่พื้นที่ทำงาน",
  },
};
export function LoginForm() {
  const [state, setState] = useState<DemoState>("idle");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("submitting");
    const data = new FormData(e.currentTarget),
      u = String(data.get("username") ?? "");
    setTimeout(
      () =>
        setState(
          u.includes("lock")
            ? "locked"
            : u.includes("disable")
              ? "disabled"
              : u && data.get("password")
                ? "success"
                : "invalid",
        ),
      350,
    );
  };
  const msg =
    state !== "idle" && state !== "submitting" ? messages[state] : null;
  return (
    <form onSubmit={submit} className={styles.field}>
      <h2>เข้าสู่ระบบ</h2>
      <p className={styles.muted}>ใช้บัญชีที่ HR หรือ Owner จัดสรรให้</p>
      <div className={styles.field}>
        <label htmlFor="username">ชื่อผู้ใช้</label>
        <input
          className={styles.input}
          id="username"
          name="username"
          autoComplete="username"
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="password">รหัสผ่าน</label>
        <input
          className={styles.input}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {msg ? (
        <div
          className={`${styles.notice} ${state === "success" ? "" : styles.noticeDanger}`}
          role={state === "success" ? "status" : "alert"}
          aria-live="polite"
        >
          <strong>{msg.title}</strong>
          <p>{msg.detail}</p>
        </div>
      ) : null}
      <button className={styles.button} disabled={state === "submitting"}>
        {state === "submitting" ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
      </button>
      <small className={styles.muted}>
        Preview: ใช้ชื่อที่มีคำว่า lock หรือ disable เพื่อดูสถานะตัวอย่าง
      </small>
    </form>
  );
}
