"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Feedback, PageHeader, formatThaiDate, formatThaiMoney } from "@/components/workspace-ui";
import { employeeReadApi, type PaymentDestination } from "@/features/identity-hr/employees/employee-read-api";
import type { EmployeeSummary } from "@/features/identity-hr/contracts/types";
import { authApi, type AuthenticatedActor } from "@/lib/auth/auth-api";
import { canAccessDashboardPath } from "@/lib/auth/route-access";
import { latestOwnPayslip } from "@/lib/dashboard/overview";
import { payslipApi, type Payslip } from "@/lib/payslip/payslip-api";

const workspaces = [
  { href: "/attendance", title: "ลงเวลาทำงาน", detail: "บันทึกและตรวจสอบวันทำงาน" },
  { href: "/leave", title: "การลา", detail: "ส่งคำขอและติดตามผลการลา" },
  { href: "/overtime", title: "การทำงานล่วงเวลา", detail: "ดูรายการและผลการพิจารณา OT" },
  { href: "/payslips", title: "สลิปเงินเดือน", detail: "ดูและดาวน์โหลดสลิปเงินเดือน" },
] as const;
const roleNames: Record<string, string> = { EMPLOYEE: "พนักงาน", SUPERVISOR: "หัวหน้าแผนก", BRANCH_MANAGER: "ผู้จัดการสาขา", HR: "ฝ่ายทรัพยากรบุคคล / บัญชี", OWNER: "เจ้าของร้าน" };
const paymentNames: Record<string, string> = { cash: "เงินสด", transfer: "เงินโอน", social_security: "ประกันสังคม (โอนเข้าบัญชี)" };
type Result<T> = { state: "loading" } | { state: "ready"; value: T } | { state: "error" };

export default function DashboardPage() {
  const [actor, setActor] = useState<AuthenticatedActor | null | undefined>(undefined);
  const [profile, setProfile] = useState<Result<EmployeeSummary>>({ state: "loading" });
  const [payslip, setPayslip] = useState<Result<Payslip | null>>({ state: "loading" });
  const [destination, setDestination] = useState<Result<PaymentDestination>>({ state: "loading" });

  useEffect(() => {
    const abort = new AbortController();
    void authApi.current(abort.signal).then((current) => {
      if (abort.signal.aborted) return;
      setActor(current);
      const employee = current.account.employee;
      if (!employee) return;
      void employeeReadApi.get(employee.id, abort.signal).then((value) => {
        if (!abort.signal.aborted) setProfile({ state: "ready", value });
      }).catch(() => { if (!abort.signal.aborted) setProfile({ state: "error" }); });
      void payslipApi.mine({ signal: abort.signal }).then(({ data }) => {
        if (!abort.signal.aborted) setPayslip({ state: "ready", value: latestOwnPayslip(data, employee.id) });
      }).catch(() => { if (!abort.signal.aborted) setPayslip({ state: "error" }); });
      void employeeReadApi.paymentDestination(employee.id, abort.signal).then((value) => {
        if (!abort.signal.aborted) setDestination({ state: "ready", value });
      }).catch(() => { if (!abort.signal.aborted) setDestination({ state: "error" }); });
    }).catch(() => { if (!abort.signal.aborted) setActor(null); });
    return () => abort.abort();
  }, []);

  const employee = actor?.account.employee;
  const roles = actor?.grants.map((grant) => grant.role_code) ?? [];
  const availableWorkspaces = workspaces.filter((workspace) => canAccessDashboardPath(workspace.href, roles));
  const payment = destination.state === "ready" ? destination.value.payment_category ?? destination.value.payment_method : null;

  return <div className="space-y-7">
    <PageHeader title="ภาพรวม" description="ข้อมูลบัญชี ข้อมูลส่วนตัว และเงินเดือนของคุณในที่เดียว" />
    {actor === undefined ? <Feedback kind="loading" detail="กำลังโหลดข้อมูลบัญชีของคุณ…" /> : actor === null ? <Feedback kind="error" title="โหลดข้อมูลบัญชีไม่สำเร็จ" detail="กรุณารีเฟรชหน้า หรือลงชื่อเข้าใช้อีกครั้ง" /> : <>
      <section aria-labelledby="account-heading" className="workspace-section">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 id="account-heading" className="text-xl font-semibold">{employee?.display_name ?? actor.account.username}</h2><p className="mt-1 text-sm text-[var(--muted)]">{employee ? `รหัสพนักงาน ${employee.employee_code}` : "บัญชีผู้ใช้งาน"}</p></div>
          <Link href="/settings" className="workspace-secondary">ตั้งค่าบัญชี</Link>
        </div>
        <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-[var(--line)] pt-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-[var(--muted)]">ชื่อผู้ใช้</dt><dd className="mt-1 font-medium">{actor.account.username}</dd></div>
          <div><dt className="text-[var(--muted)]">บทบาท</dt><dd className="mt-1 font-medium">{roles.length ? [...new Set(roles.map((role) => roleNames[role] ?? role))].join(", ") : "ยังไม่ได้กำหนดบทบาท"}</dd></div>
          {employee && profile.state === "ready" && <>
            <div><dt className="text-[var(--muted)]">สาขา</dt><dd className="mt-1 font-medium">{profile.value.branch_name ?? "ไม่ระบุ"}</dd></div>
            <div><dt className="text-[var(--muted)]">แผนก</dt><dd className="mt-1 font-medium">{profile.value.department_name ?? "ไม่ระบุ"}</dd></div>
            <div><dt className="text-[var(--muted)]">ตำแหน่ง</dt><dd className="mt-1 font-medium">{profile.value.position_name ?? "ไม่ระบุ"}</dd></div>
            <div><dt className="text-[var(--muted)]">วันที่เริ่มงาน</dt><dd className="mt-1 font-medium">{profile.value.hire_date ? formatThaiDate(profile.value.hire_date) : "ไม่ระบุ"}</dd></div>
            <div><dt className="text-[var(--muted)]">เบอร์โทรศัพท์</dt><dd className="mt-1 font-medium">{profile.value.phone || "ไม่ระบุ"}</dd></div>
            <div><dt className="text-[var(--muted)]">อีเมล</dt><dd className="mt-1 break-all font-medium">{profile.value.personal_email || "ไม่ระบุ"}</dd></div>
          </>}
        </dl>
        {employee && profile.state === "loading" && <p className="mt-4 text-sm text-[var(--muted)]">กำลังโหลดข้อมูลพนักงาน…</p>}
        {employee && profile.state === "error" && <div className="mt-4"><Feedback kind="warning" detail="โหลดรายละเอียดพนักงานไม่สำเร็จ กรุณารีเฟรชหน้า" /></div>}
        {!employee && <p className="mt-5 text-sm leading-6 text-[var(--muted)]">บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลพนักงาน จึงยังไม่มีข้อมูลส่วนตัวและสลิปเงินเดือนของตนเอง หากต้องการเชื่อมบัญชี กรุณาติดต่อ HR หรือเจ้าของร้าน</p>}
      </section>
      {employee && <section aria-labelledby="salary-heading" className="workspace-section">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="salary-heading" className="text-xl font-semibold">เงินเดือนของฉัน</h2><p className="mt-1 text-sm text-[var(--muted)]">ข้อมูลจากสลิปเงินเดือนล่าสุดที่ออกแล้ว</p></div><Link href="/payslips" className="workspace-secondary">ดูสลิปทั้งหมด</Link></div>
        {payslip.state === "loading" ? <p className="mt-5 text-sm text-[var(--muted)]">กำลังโหลดข้อมูลเงินเดือน…</p> : payslip.state === "error" ? <div className="mt-5"><Feedback kind="error" detail="โหลดข้อมูลสลิปไม่สำเร็จ กรุณารีเฟรชหน้า" /></div> : payslip.value === null ? <div className="mt-5"><Feedback kind="empty" title="ยังไม่มีสลิปเงินเดือน" detail="เมื่อผู้รับผิดชอบออกสลิปแล้ว ยอดเงินเดือนจะแสดงที่นี่" /></div> : <>
          <p className="mt-5 text-sm text-[var(--muted)]">ออกสลิปเมื่อ {formatThaiDate(payslip.value.generated_at)}</p>
          <dl className="mt-4 grid gap-x-6 gap-y-4 border-y border-[var(--line)] py-5 text-sm sm:grid-cols-3">
            <div><dt className="text-[var(--muted)]">รายได้รวม</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{formatThaiMoney(payslip.value.total_earnings)}</dd></div>
            <div><dt className="text-[var(--muted)]">รายการหักรวม</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{formatThaiMoney(payslip.value.total_deductions)}</dd></div>
            <div><dt className="text-[var(--muted)]">เงินเดือนสุทธิ</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-[var(--accent)]">{formatThaiMoney(payslip.value.net_pay)}</dd></div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">ยอดตามสลิป ไม่ได้ยืนยันสถานะการโอนหรือรับเงิน</p>
        </>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm"><p><span className="text-[var(--muted)]">ประเภทการรับเงินปัจจุบัน: </span>{destination.state === "loading" ? "กำลังโหลด…" : destination.state === "error" ? "โหลดข้อมูลไม่สำเร็จ" : payment ? paymentNames[payment] ?? payment : "ยังไม่ได้กำหนด"}</p><Link href="/settings" className="font-medium text-[var(--accent)] underline underline-offset-4">ตั้งค่าการรับเงิน</Link></div>
      </section>}
      <section aria-labelledby="start-heading"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 id="start-heading" className="text-xl font-semibold">งานที่ใช้งานบ่อย</h2><p className="mt-1 text-sm text-[var(--muted)]">เลือกงานที่ต้องการดำเนินการ</p></div></div>
        <div className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">{availableWorkspaces.length ? availableWorkspaces.map((workspace) => <Link key={workspace.href} href={workspace.href} className="group grid gap-1 py-4 sm:grid-cols-[13rem_1fr]"><h3 className="font-semibold text-[var(--ink)] group-hover:text-[var(--accent)]">{workspace.title}</h3><p className="text-sm leading-6 text-[var(--muted)]">{workspace.detail}</p></Link>) : <p className="py-4 text-sm text-[var(--muted)]">ยังไม่มีเมนูในส่วนนี้สำหรับบัญชีของคุณ</p>}</div>
      </section>
    </>}
  </div>;
}
