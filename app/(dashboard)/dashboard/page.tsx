"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/workspace-ui";
import { authApi } from "@/lib/auth/auth-api";
import { canAccessDashboardPath } from "@/lib/auth/route-access";

const workspaces = [
  { href: "/leave", title: "การลา", detail: "ส่งคำขอ ติดตามผล และแก้ไขได้เมื่อคำขอยังรอพิจารณา" },
  { href: "/overtime", title: "การทำงานล่วงเวลา", detail: "ส่งคำขอ OT และตรวจสอบว่าอนุมัติแล้วหรือไม่" },
  { href: "/payslips", title: "สลิปเงินเดือน", detail: "ตรวจสอบสลิปที่เชื่อมกับบัญชีของคุณ" },
] as const;

export default function DashboardPage() {
  const [roles, setRoles] = useState<string[] | null>(null);
  useEffect(() => { void authApi.current().then((actor) => setRoles(actor.grants.map((grant) => grant.role_code))).catch(() => setRoles([])); }, []);
  const availableWorkspaces = roles === null ? [] : workspaces.filter((workspace) => canAccessDashboardPath(workspace.href, roles));
  return <div className="space-y-8">
    <PageHeader title="พื้นที่ทำงาน" description="เลือกงานจากเมนูด้านซ้าย ระบบจะแสดงเฉพาะงานที่บัญชีของคุณมีสิทธิ์ใช้งาน" />
    <section aria-labelledby="start-heading">
      <h2 id="start-heading" className="text-xl font-semibold">เริ่มงานประจำวัน</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">หากไม่พบเมนูที่ต้องใช้ ให้ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์ ไม่ต้องลองกดลิงก์หรือกรอกรหัสเอง</p>
      <div className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {roles === null ? <p className="py-5 text-sm text-[var(--muted)]">กำลังตรวจสอบงานที่คุณใช้งานได้…</p> : availableWorkspaces.map((workspace) => <Link key={workspace.href} href={workspace.href} className="group grid gap-2 py-5 sm:grid-cols-[13rem_1fr]"><h3 className="font-semibold text-[var(--ink)] group-hover:text-[var(--accent)]">{workspace.title}</h3><p className="text-sm leading-6 text-[var(--muted)]">{workspace.detail}</p></Link>)}
      </div>
    </section>
    <section className="border-t border-[var(--line)] pt-6">
      <h2 className="font-semibold">เมื่อทำรายการไม่สำเร็จ</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">ตรวจข้อความที่ระบบแจ้งก่อน หากข้อมูลอยู่ในสถานะอนุมัติแล้วหรือรอบเงินเดือนถูกล็อก ให้ใช้ขั้นตอนแก้ไขที่ระบบระบุแทนการทำรายการซ้ำ</p>
    </section>
  </div>;
}
