"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError } from "../../lib/api/client";
import { authApi } from "../../lib/auth/auth-api";
import styles from "./login.module.css";

const messageFor = (error: unknown) => {
  if (error instanceof ApiClientError) {
    if (error.code === "INVALID_CREDENTIALS") {
      return "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง ลองตรวจสอบแล้วเข้าสู่ระบบอีกครั้ง";
    }
    if (error.code === "ACCOUNT_LOCKED") {
      return "บัญชีนี้ถูกพักการเข้าสู่ระบบชั่วคราว กรุณารอสักครู่แล้วลองใหม่";
    }
    return error.message;
  }

  return "ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาลองใหม่อีกครั้ง";
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      await authApi.login({ username, password });
      router.replace("/payroll");
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <main className={`${styles.shell} bg-[var(--paper)]`}>
      <div className={styles.card}>
        <section className={`${styles.hero} bg-[var(--ink)] text-white`}>
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-lg bg-white text-sm font-bold text-[var(--ink)]">HP</span>
                <span className="text-lg font-semibold tracking-tight">Haris Payroll</span>
              </div>
              <h1 className="mt-8 max-w-lg text-balance text-[clamp(2rem,7vw,3rem)] font-semibold leading-[1.12] tracking-[-0.035em] sm:mt-10 lg:mt-16">
                เข้าสู่พื้นที่ทำงานเงินเดือน
              </h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-white/72 sm:text-base sm:leading-7">
                ตรวจรายการรายวัน แก้ blocker และล็อกรอบเงินเดือนอย่างรอบคอบ
              </p>
            </div>
            <p className="mt-8 max-w-sm border-t border-white/15 pt-5 text-sm leading-6 text-white/62 sm:mt-10">
              สิทธิ์เข้าถึงจะถูกตรวจสอบตามบทบาทและขอบเขตสาขาของบัญชีคุณ
            </p>
          </div>
        </section>

        <section className={styles.formPanel}>
          <div className={styles.formContent}>
            <h2 className="text-3xl font-semibold tracking-[-0.03em]">เข้าสู่ระบบ</h2>
            <p className="mt-3 leading-7 text-[var(--muted)]">
              ใช้บัญชีที่ได้รับสิทธิ์เพื่อไปยังสมุดงานเงินเดือน
            </p>

            <form className="mt-7 space-y-5" onSubmit={submit}>
              <label className="block text-sm font-semibold" htmlFor="username">
                ชื่อผู้ใช้
                <input
                  autoComplete="username"
                  autoFocus
                  className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-3.5 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                  disabled={pending}
                  id="username"
                  name="username"
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  value={username}
                />
              </label>

              <label className="block text-sm font-semibold" htmlFor="password">
                รหัสผ่าน
                <input
                  autoComplete="current-password"
                  className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-3.5 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                  disabled={pending}
                  id="password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>

              {error ? (
                <p className="border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-6 text-red-900" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                className="w-full rounded-lg bg-[var(--accent)] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1d5e49] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={pending}
                type="submit"
              >
                {pending ? "กำลังตรวจสอบบัญชี…" : "เข้าสู่พื้นที่ทำงาน"}
              </button>
              <p aria-live="polite" className="min-h-5 text-center text-xs text-[var(--muted)]">
                {pending ? "กำลังสร้าง session ที่ปลอดภัย" : ""}
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
