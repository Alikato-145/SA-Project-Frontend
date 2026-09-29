"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { canAccessDashboardPath } from "@/lib/auth/route-access";
import { authApi } from "@/lib/auth/auth-api";
import { identityHrRoutes } from "@/features/identity-hr/route-metadata";

const navigation = [
  { label: "ภาพรวม", href: "/dashboard" },
  { label: "พนักงาน", href: "/employees" },
  ...identityHrRoutes.filter((item) => item.href !== "/employees"),
  { label: "ลงเวลา", href: "/attendance" },
  { label: "การลา", href: "/leave" },
  { label: "ทำงานล่วงเวลา", href: "/overtime" },
  { label: "เงินทดรองและหนี้", href: "/finance" },
  { label: "เงินเดือน", href: "/payroll" },
  { label: "การตั้งค่า", href: "/settings" },
  { label: "สลิปเงินเดือน", href: "/payslips" },
  { label: "รายงาน", href: "/reports" },
  { label: "ประวัติการเปลี่ยนแปลง", href: "/audit" },
] as const;

function NavigationItems({ roleCodes }: { roleCodes: readonly string[] }) {
  const pathname = usePathname();
  return (
    <ul className="grid gap-1" aria-label="เมนูหลัก">
      {navigation.map((item) => {
        if (!canAccessDashboardPath(item.href, roleCodes)) return null;
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <li key={item.label}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"}`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ApplicationShell({ children, roleCodes = [], username }: { children: ReactNode; roleCodes?: readonly string[]; username?: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    setSigningOut(true);
    try { await authApi.logout(); } finally { router.replace("/login"); }
  };
  return (
    <div className="min-h-[100dvh] bg-[var(--paper)] lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a>
      <aside className="hidden border-r border-[var(--line)] bg-[var(--surface)] px-5 py-7 lg:flex lg:flex-col">
        <Link
          href="/dashboard"
          className="mb-10 flex items-center gap-3 rounded-md"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--ink)] text-sm font-bold text-white">
            HP
          </span>
          <span>
            <span className="block font-semibold">Haris Payroll</span>
            <span className="block text-xs text-[var(--muted)]">
              ระบบจัดการส่วนกลาง
            </span>
          </span>
        </Link>
        <nav className="flex-1">
          <NavigationItems roleCodes={roleCodes} />
        </nav>
        <div className="border-t border-[var(--line)] pt-4">
          <p className="truncate text-sm font-medium">{username ?? "บัญชีผู้ใช้"}</p>
          <button type="button" onClick={() => void signOut()} disabled={signingOut} className="mt-2 text-xs font-semibold text-[var(--accent)] underline underline-offset-4 disabled:opacity-60">{signingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}</button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <Link href="/dashboard" className="font-semibold lg:hidden">Haris Payroll</Link>
            <p className="hidden text-sm text-[var(--muted)] lg:block">พื้นที่ทำงานส่วนกลาง</p>
            <span className="max-w-40 truncate rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium">{username ?? "บัญชีผู้ใช้"}</span>
          </div>
          <details className="mt-3 lg:hidden">
            <summary className="cursor-pointer rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium">เปิดเมนูหลัก</summary>
            <nav className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2"><NavigationItems roleCodes={roleCodes} /></nav>
          </details>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
