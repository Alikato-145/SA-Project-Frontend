"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError } from "../../lib/api/client";
import { authApi } from "../../lib/auth/auth-api";

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
    <main className="min-h-[100dvh] bg-[var(--paper)] lg:grid lg:place-items-center lg:px-10 lg:py-12">
      <div className="mx-auto w-full max-w-6xl border-y border-[var(--line)] bg-[var(--surface)] lg:grid lg:grid-cols-[1fr_0.9fr] lg:border-x">
        <section className="bg-[var(--ink)] px-6 py-8 text-white sm:px-10 sm:py-12 lg:min-h-[38rem] lg:px-14 lg:py-16">
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-lg bg-white text-sm font-bold text-[var(--ink)]">HP</span>
                <span className="text-lg font-semibold tracking-tight">Haris Payroll</span>
              </div>
              <h1 className="mt-10 max-w-lg text-3xl font-semibold leading-[1.12] tracking-[-0.035em] sm:text-4xl lg:mt-16 lg:text-5xl">
                เข้าสู่พื้นที่ทำงานเงินเดือน
              </h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-white/72 sm:text-base sm:leading-7">
                ตรวจรายการรายวัน แก้ blocker และล็อกรอบเงินเดือนอย่างรอบคอบ
              </p>
            </div>
            <p className="mt-10 max-w-sm border-t border-white/15 pt-5 text-sm leading-6 text-white/62">
              สิทธิ์เข้าถึงจะถูกตรวจสอบตามบทบาทและขอบเขตสาขาของบัญชีคุณ
            </p>
          </div>
        </section>

        <section className="px-6 py-8 sm:px-10 sm:py-12 lg:flex lg:flex-col lg:justify-center lg:px-14">
          <div className="max-w-sm">
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
