"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApplicationShell } from "@/components/application-shell";
import { authApi, type AuthenticatedActor } from "@/lib/auth/auth-api";
import { canAccessDashboardPath, routePolicyFor } from "@/lib/auth/route-access";

export function DashboardAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    void authApi.current().then(setActor).catch(() => router.replace("/login")).finally(() => setChecked(true));
  }, [router]);

  if (!checked) return <div className="min-h-[100dvh] bg-[var(--paper)] p-8"><div className="mx-auto h-32 max-w-6xl animate-pulse rounded-xl bg-[var(--line)]" /></div>;
  if (!actor) return null;
  const policy = routePolicyFor(pathname);
  const roleCodes = actor.grants.map((grant) => grant.role_code);
  if (!canAccessDashboardPath(pathname, roleCodes)) {
    const unavailable = policy.state === "unavailable";
    return <ApplicationShell roleCodes={roleCodes}><section aria-labelledby="access-denied-title" className="max-w-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h1 id="access-denied-title" className="text-2xl font-semibold">{unavailable ? "ส่วนงานนี้ยังไม่พร้อมใช้งาน" : "ไม่มีสิทธิ์เข้าถึงหน้านี้"}</h1><p className="mt-3 leading-7 text-[var(--muted)]">{unavailable ? "ส่วนงานนี้ยังรอ workflow ที่ตรวจ scope จาก backend ได้ครบถ้วน กรุณาเลือกส่วนงานอื่นจากเมนู" : "สิทธิ์ถูกตรวจจาก session และ role scope ปัจจุบันของบัญชีคุณ"}</p></section></ApplicationShell>;
  }
  return <ApplicationShell roleCodes={roleCodes}>{children}</ApplicationShell>;
}
