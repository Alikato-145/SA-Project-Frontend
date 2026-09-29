"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { authApi } from "@/lib/auth/auth-api";
import { payslipApi, type Payslip, type PayslipDelivery } from "@/lib/payslip/payslip-api";
import { Feedback, PageHeader, StatusBadge, formatThaiDate, formatThaiMoney } from "@/components/workspace-ui";
import { Skeleton } from "@/components/ui/skeleton";

const field = "mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-sm";
const button = "rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45";
const quietButton = "rounded-lg border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45";
const messageFor = (cause: unknown) => cause instanceof ApiClientError
  ? cause.message
  : cause instanceof Error ? cause.message : "ไม่สามารถทำรายการได้";

function PayslipSummary({ payslip }: { payslip: Payslip }) {
  return <dl className="grid gap-3 border-y border-[var(--line)] py-4 text-sm sm:grid-cols-4">
    <div><dt className="text-[var(--muted)]">รายการเงินเดือนอ้างอิง</dt><dd className="mt-1 font-semibold">#{payslip.payroll_record_id}</dd></div>
    <div><dt className="text-[var(--muted)]">รายได้</dt><dd className="mt-1 font-semibold tabular-nums">{formatThaiMoney(payslip.total_earnings)}</dd></div>
    <div><dt className="text-[var(--muted)]">รายการหัก</dt><dd className="mt-1 font-semibold tabular-nums">{formatThaiMoney(payslip.total_deductions)}</dd></div>
    <div><dt className="text-[var(--muted)]">สุทธิ</dt><dd className="mt-1 font-semibold tabular-nums">{formatThaiMoney(payslip.net_pay)}</dd></div>
  </dl>;
}

function EmployeePayslips({ rows }: { rows: Payslip[] }) {
  return rows.length === 0 ? <Feedback kind="empty" title="ยังไม่มีสลิปเงินเดือน" detail="สลิปจะแสดงที่นี่เมื่อรอบเงินเดือนถูกออกและเชื่อมกับบัญชีของคุณแล้ว" /> : <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">{rows.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><span><strong>สลิปเงินเดือน</strong><small className="ml-2 text-[var(--muted)]">ออกเมื่อ {formatThaiDate(row.generated_at)}</small></span><strong className="tabular-nums">สุทธิ {formatThaiMoney(row.net_pay)}</strong></li>)}</ul>;
}

export default function PayslipsPage() {
  const [role, setRole] = useState<"employee" | "admin" | null>(null);
  const [rows, setRows] = useState<Payslip[]>([]);
  const [selected, setSelected] = useState<Payslip | null>(null);
  const [deliveries, setDeliveries] = useState<PayslipDelivery[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void authApi.current().then(async (actor) => {
      const canManage = actor.grants.some((grant) => grant.role_code === "HR" || grant.role_code === "OWNER");
      setRole(canManage ? "admin" : "employee");
      if (!canManage) setRows((await payslipApi.mine()).data);
    }).catch((cause) => setError(messageFor(cause)));
  }, []);

  const run = async <T,>(work: () => Promise<T>, onDone?: (value: T) => void, success?: string) => {
    setBusy(true); setError(""); setNotice("");
    try { const value = await work(); onDone?.(value); if (success) setNotice(success); }
    catch (cause) { setError(messageFor(cause)); }
    finally { setBusy(false); }
  };

  const selectPayslip = (payslip: Payslip) => {
    setSelected(payslip);
    void run(() => payslipApi.deliveries(payslip.id).then((result) => result.data), setDeliveries);
  };
  const generate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const recordId = String(new FormData(event.currentTarget).get("record_id") ?? "");
    void run(() => payslipApi.generate(recordId).then((result) => result.data), selectPayslip, "ออกสลิปเงินเดือนแล้ว");
  };
  const openPayslip = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const payslipId = String(new FormData(event.currentTarget).get("payslip_id") ?? "");
    void run(() => payslipApi.get(payslipId).then((result) => result.data), selectPayslip);
  };
  const deliver = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected) return;
    const email = String(new FormData(event.currentTarget).get("recipient_email") ?? "");
    void run(() => payslipApi.deliver(selected.id, email).then((result) => result.data), (delivery) => setDeliveries((items) => [...items, delivery]), "บันทึกการส่งอีเมลแล้ว");
  };
  const voidPayslip = () => {
    if (!selected || !window.confirm("ยกเลิกสลิปนี้หรือไม่? รายการส่งเดิมจะยังเก็บเป็นประวัติ")) return;
    void run(() => payslipApi.void(selected.id).then((result) => result.data), () => setSelected((item) => item ? { ...item, status: "voided" } : item), "ยกเลิกสลิปแล้ว");
  };

  if (role === null) return error ? <Feedback kind="error" title="ไม่สามารถเปิดสลิปได้" detail={error} /> : <Skeleton className="h-32 w-full" />;
  if (role === "employee") return <div className="space-y-6"><PageHeader title="สลิปเงินเดือนของฉัน" description="แสดงเฉพาะสลิปที่เชื่อมกับบัญชีของคุณ" />{error ? <Feedback kind="error" title="ไม่สามารถเปิดสลิปได้" detail={error} /> : <EmployeePayslips rows={rows} />}</div>;

  return <div className="space-y-8">
    <PageHeader title="ออกและจัดส่งสลิปเงินเดือน" description="สร้างได้เฉพาะรายการเงินเดือนที่ล็อกแล้ว การส่งและยกเลิกจะเก็บประวัติไว้ตรวจสอบได้เสมอ" />
    {notice ? <Feedback kind="success" detail={notice} /> : null}
    {error ? <Feedback kind="error" title="ทำรายการไม่สำเร็จ" detail={error} /> : null}
    <section className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={generate} className="border-y border-[var(--line)] py-5"><h2 className="text-xl font-semibold">ออกสลิปใหม่</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">ระบุ payroll record ที่ล็อกแล้ว ระบบจะป้องกันการออกซ้ำ</p><div className="mt-5 flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm">Locked payroll record ID<input className={field} name="record_id" inputMode="numeric" required /></label><button className={button} disabled={busy}>ออกสลิป</button></div></form>
      <form onSubmit={openPayslip} className="border-y border-[var(--line)] py-5"><h2 className="text-xl font-semibold">เปิดสลิปที่ออกแล้ว</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">ใช้ payslip ID เพื่อดูประวัติการส่ง หรือจัดการสลิปเดิม</p><div className="mt-5 flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm">Payslip ID<input className={field} name="payslip_id" inputMode="numeric" required /></label><button className={quietButton} disabled={busy}>เปิดสลิป</button></div></form>
    </section>
    {selected && <section aria-labelledby="selected-payslip" className="border-t border-[var(--line)] pt-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="selected-payslip" className="text-xl font-semibold">สลิป #{selected.id}</h2><p className="mt-1 text-sm text-[var(--muted)]">ออกเมื่อ {formatThaiDate(selected.generated_at)}</p></div><div className="flex items-center gap-2"><StatusBadge value={selected.status} />{selected.status === "generated" && <button className={quietButton} onClick={voidPayslip} disabled={busy}>ยกเลิกสลิป</button>}</div></div><PayslipSummary payslip={selected} />
      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"><form onSubmit={deliver} className="border border-[var(--line)] bg-[var(--surface)] p-5"><h3 className="font-semibold">บันทึกการส่งอีเมล</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">ระบบจะบันทึกทุกครั้งเป็นประวัติแยกกัน</p><label className="mt-5 block text-sm">อีเมลผู้รับ<input className={field} name="recipient_email" type="email" required disabled={selected.status !== "generated"} /></label><button className={`mt-3 ${button}`} disabled={busy || selected.status !== "generated"}>บันทึกการส่ง</button></form>
        <div><h3 className="font-semibold">ประวัติการส่ง ({deliveries.length})</h3>{deliveries.length === 0 ? <div className="mt-3"><Feedback kind="empty" detail="ยังไม่มีประวัติการส่ง" /></div> : <ul className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">{deliveries.map((delivery) => <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span><strong>{delivery.recipient_email}</strong><span className="ml-2 text-[var(--muted)]">{formatThaiDate(delivery.attempted_at)}</span></span><StatusBadge value={delivery.status} /></li>)}</ul>}</div>
      </div>
    </section>}
  </div>;
}
