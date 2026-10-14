"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { canAccessDashboardPath } from "@/lib/auth/route-access";
import { authApi } from "@/lib/auth/auth-api";
import { identityHrRoutes } from "@/features/identity-hr/route-metadata";

const navigation = [
  { label: "งานประจำวัน", items: [
    { label: "ภาพรวม", href: "/dashboard" },
    { label: "ลงเวลา", href: "/attendance" },
    { label: "ตารางเวลาและวันหยุด", href: "/schedules" },
    { label: "การลา", href: "/leave" },
    { label: "ทำงานล่วงเวลา", href: "/overtime" },
  ] },
  { label: "บุคลากร", items: [
    { label: "พนักงาน", href: "/employees" },
    ...identityHrRoutes.filter((item) => item.href !== "/employees"),
  ] },
  { label: "การเงิน", items: [
    { label: "เงินทดรองและหนี้", href: "/finance" },
    { label: "เงินเดือน", href: "/payroll" },
    { label: "สลิปเงินเดือน", href: "/payslips" },
    { label: "รายงาน", href: "/reports" },
  ] },
  { label: "ระบบ", items: [
    { label: "การตั้งค่า", href: "/settings" },
    { label: "ประวัติการเปลี่ยนแปลง", href: "/audit" },
  ] },
] as const;

function NavigationItems({ roleCodes }: { roleCodes: readonly string[] }) {
  const pathname = usePathname();
  return (
    <div className="space-y-5" aria-label="เมนูหลัก">
      {navigation.map((group) => {
        const items = group.items.filter((item) => canAccessDashboardPath(item.href, roleCodes));
        if (items.length === 0) return null;
        return <section key={group.label} aria-label={group.label}>
          <h2 className="mb-1.5 px-3 text-xs font-semibold text-[var(--muted)]">{group.label}</h2>
          <ul className="grid gap-0.5">
            {items.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
              return <li key={item.label}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`block border-l-2 px-3 py-2 text-sm font-medium transition-colors ${active ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"}`}
                >
                  {item.label}
                </Link>
              </li>;
            })}
          </ul>
        </section>;
      })}
    </div>
  );
}

export function ApplicationShell({ children, roleCodes = [], username }: { children: ReactNode; roleCodes?: readonly string[]; username?: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const signOut = async () => {
    setSigningOut(true); setLogoutError("");
    try { await authApi.logout(); router.replace("/login"); }
    catch { setLogoutError("ออกจากระบบไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองใหม่"); }
    finally { setSigningOut(false); }
  };
  return (
    <div className="min-h-[100dvh] bg-[var(--paper)] lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a>
      <aside className="hidden max-h-[100dvh] border-r border-[var(--line)] bg-[var(--surface)] px-4 py-6 lg:sticky lg:top-0 lg:flex lg:flex-col">
        <Link
          href="/dashboard"
          className="mb-7 flex items-center gap-3 rounded-md px-2"
        >
          <span className="grid size-10 place-items-center rounded-lg bg-[var(--ink)] text-sm font-bold text-white">
            HP
          </span>
          <span>
            <span className="block font-semibold">Haris Payroll</span>
            <span className="block text-xs text-[var(--muted)]">
              ระบบจัดการส่วนกลาง
            </span>
          </span>
        </Link>
        <nav className="min-h-0 flex-1 overflow-y-auto pr-1">
          <NavigationItems roleCodes={roleCodes} />
        </nav>
        <div className="mt-4 border-t border-[var(--line)] px-2 pt-4">
          <p className="truncate text-sm font-medium">{username ?? "บัญชีผู้ใช้"}</p>
          <button type="button" onClick={() => void signOut()} disabled={signingOut} className="mt-1.5 min-h-8 text-sm font-medium text-[var(--accent)] underline underline-offset-4 disabled:opacity-60">{signingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}</button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-4 py-3 backdrop-blur-sm sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <Link href="/dashboard" className="font-semibold lg:hidden">Haris Payroll</Link>
            <p className="hidden text-sm text-[var(--muted)] lg:block">พื้นที่ทำงานส่วนกลาง</p>
            <span className="max-w-48 truncate text-sm font-medium">{username ?? "บัญชีผู้ใช้"}</span>
          </div>
          <details className="mt-3 lg:hidden">
            <summary className="cursor-pointer rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium">เมนูหลัก</summary>
            <nav className="mt-2 max-h-[70dvh] overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3"><NavigationItems roleCodes={roleCodes} /><button type="button" onClick={() => void signOut()} disabled={signingOut} className="mt-4 min-h-11 w-full border-t border-[var(--line)] text-left text-sm font-medium text-[var(--accent)] disabled:opacity-60">{signingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}</button></nav>
          </details>
          {logoutError && <p role="alert" className="mt-3 text-sm text-red-800">{logoutError}</p>}
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
