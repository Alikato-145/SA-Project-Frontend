import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { label: "ภาพรวม", href: "/dashboard", available: true },
  { label: "พนักงาน", available: false },
  { label: "เวลาและการลา", available: false },
  { label: "เงินเดือน", available: false },
  { label: "สลิปและรายงาน", available: false },
] as const;

function NavigationItems() {
  return (
    <ul className="grid gap-1" aria-label="เมนูหลัก">
      {navigation.map((item) => (
        <li key={item.label}>
          {item.available ? (
            <Link href={item.href} aria-current="page" className="block rounded-lg bg-[var(--accent-soft)] px-3 py-2.5 text-sm font-semibold text-[var(--accent)]">
              {item.label}
            </Link>
          ) : (
            <span aria-disabled="true" className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-[var(--muted)]">
              {item.label}<span className="text-xs">เร็ว ๆ นี้</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ApplicationShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--paper)] lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-[var(--line)] bg-[var(--surface)] px-5 py-7 lg:flex lg:flex-col">
        <Link href="/dashboard" className="mb-10 flex items-center gap-3 rounded-md">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--ink)] text-sm font-bold text-white">HP</span>
          <span><span className="block font-semibold">Haris Payroll</span><span className="block text-xs text-[var(--muted)]">ระบบจัดการส่วนกลาง</span></span>
        </Link>
        <nav className="flex-1"><NavigationItems /></nav>
        <div className="border-t border-[var(--line)] pt-4">
          <p className="text-sm font-medium">บัญชีตัวอย่าง</p>
          <p className="mt-1 text-xs text-[var(--muted)]">รอเชื่อมต่อระบบเข้าสู่ระบบ</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <Link href="/dashboard" className="font-semibold lg:hidden">Haris Payroll</Link>
            <p className="hidden text-sm text-[var(--muted)] lg:block">พื้นที่ทำงานส่วนกลาง</p>
            <span className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium">Mock account</span>
          </div>
          <details className="mt-3 lg:hidden">
            <summary className="cursor-pointer rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium">เปิดเมนู</summary>
            <nav className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2"><NavigationItems /></nav>
          </details>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
