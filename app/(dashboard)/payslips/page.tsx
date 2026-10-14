"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { PayrollPeriodPicker } from "@/components/payroll-period-picker";
import { payrollApi, type PayrollPeriod, type PayrollRecord, type PayrollRosterEntry } from "@/lib/payroll/payroll-api";
import { downloadApiFile } from "@/lib/api/download";
import { authApi } from "@/lib/auth/auth-api";
import { payslipApi, type Payslip, type PayslipDelivery } from "@/lib/payslip/payslip-api";
import { Feedback, PageHeader, StatusBadge, formatThaiDate, formatThaiMoney } from "@/components/workspace-ui";
import { Skeleton } from "@/components/ui/skeleton";

const field = "workspace-control";
const button = "workspace-primary";
const quietButton = "workspace-secondary";
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

function EmployeePayslips({ rows, download }: { rows: Payslip[]; download(row: Payslip): void }) {
  return rows.length === 0 ? <Feedback kind="empty" title="ยังไม่มีสลิปเงินเดือน" detail="สลิปจะแสดงที่นี่เมื่อรอบเงินเดือนถูกออกและเชื่อมกับบัญชีของคุณแล้ว" /> : <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">{rows.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><span><strong>สลิปเงินเดือน</strong><small className="ml-2 text-[var(--muted)]">ออกเมื่อ {formatThaiDate(row.generated_at)}</small></span><strong className="tabular-nums">สุทธิ {formatThaiMoney(row.net_pay)}</strong><button className={quietButton} type="button" onClick={() => download(row)}>ดาวน์โหลด PDF</button><PayslipSummary payslip={row} /></li>)}</ul>;
}

function PendingDeliveryResolution({ delivery, busy, onResolve }: { delivery: PayslipDelivery; busy: boolean; onResolve(body: {outcome:"sent"|"failed";reason:string;provider_reference?:string}): void }) {
  return <form className="w-full space-y-3" onSubmit={(event) => {
    event.preventDefault();const form=new FormData(event.currentTarget);
    onResolve({outcome:String(form.get("outcome")) as "sent"|"failed",reason:String(form.get("reason")),provider_reference:String(form.get("provider_reference"))});
  }}><p className="text-sm text-amber-900">ตรวจ message ID payslip-attempt-{delivery.id}@haris-payroll.local กับผู้ให้บริการก่อน หากค้างเกิน 10 นาทีจึงบันทึกผลได้ การบันทึกนี้ไม่ส่งอีเมลซ้ำ</p>
    <label className="block text-sm">ผลจากผู้ให้บริการ<select className={field} name="outcome"><option value="failed">ยืนยันว่ายังไม่ส่ง / ส่งไม่สำเร็จ</option><option value="sent">ยืนยันว่ารับข้อความแล้ว</option></select></label>
    <label className="block text-sm">Reference จากผู้ให้บริการ (ต้องระบุเมื่อรับข้อความแล้ว)<input className={field} name="provider_reference" maxLength={255} /></label>
    <label className="block text-sm">เหตุผลและหลักฐานที่ตรวจสอบ<input className={field} name="reason" required minLength={10} maxLength={1000} /></label>
    <button className={quietButton} disabled={busy}>บันทึกผลตรวจสอบ</button>
  </form>;
}

export default function PayslipsPage() {
  const [role, setRole] = useState<"employee" | "admin" | null>(null);
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [roster, setRoster] = useState<PayrollRosterEntry[]>([]);
  const [recordId, setRecordId] = useState("");
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
    event.preventDefault(); if (!recordId) return;
    void run(() => payslipApi.generate(recordId).then((result) => result.data), selectPayslip, "ออกสลิปเงินเดือนแล้ว");
  };
  const deliver = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected) return;
    const email = String(new FormData(event.currentTarget).get("recipient_email") ?? "");
    void run(() => payslipApi.deliver(selected.id, email).then((result) => result.data), (delivery) => {
      setDeliveries((items) => [...items, delivery]);
      if (delivery.status === "failed") setError("ส่งอีเมลไม่สำเร็จ ตรวจสอบ SMTP และประวัติการส่งก่อนลองใหม่");
      else setNotice("SMTP รับข้อความแล้ว ตรวจสอบประวัติการส่งได้ด้านล่าง");
    });
  };
  const voidPayslip = () => {
    if (!selected || !window.confirm("ยกเลิกสลิปนี้หรือไม่? รายการส่งเดิมจะยังเก็บเป็นประวัติ")) return;
    void run(() => payslipApi.void(selected.id).then((result) => result.data), () => setSelected((item) => item ? { ...item, status: "voided" } : item), "ยกเลิกสลิปแล้ว");
  };

  if (role === null) return error ? <Feedback kind="error" title="ไม่สามารถเปิดสลิปได้" detail={error} /> : <Skeleton className="h-32 w-full" />;
  if (role === "employee") return <div className="space-y-6"><PageHeader title="สลิปเงินเดือนของฉัน" description="แสดงเฉพาะสลิปที่เชื่อมกับบัญชีของคุณ" />{error ? <Feedback kind="error" title="ไม่สามารถเปิดสลิปได้" detail={error} /> : <EmployeePayslips rows={rows} download={(row) => { void run(() => downloadApiFile(`/v1/payslips/${row.id}/download`, `payslip-${row.payroll_record_id}.pdf`)); }} />}</div>;

  return <div className="space-y-7">
    <PageHeader title="ออกและจัดส่งสลิปเงินเดือน" description="สร้างได้เฉพาะรายการเงินเดือนที่ล็อกแล้ว การส่งและยกเลิกจะเก็บประวัติไว้ตรวจสอบได้เสมอ" />
    {notice ? <Feedback kind="success" detail={notice} /> : null}
    {error ? <Feedback kind="error" title="ทำรายการไม่สำเร็จ" detail={error} /> : null}
    <form onSubmit={generate} className="workspace-section space-y-4"><h2 className="text-xl font-semibold">เลือกรายการเงินเดือนที่ล็อกแล้ว</h2><PayrollPeriodPicker value={period?.id ?? ""} lockedOnly onChange={(value) => {
      setPeriod(value); setRecords([]); setRoster([]); setRecordId(""); setSelected(null); setDeliveries([]);
      if (value) void run(() => payrollApi.getPeriod(value.id), (result) => { setRecords(result.data.records); setRoster(result.data.roster ?? []); });
    }} /><label className="block text-sm">พนักงาน<select className={field} required value={recordId} onChange={(event) => { setRecordId(event.target.value); setSelected(null); setDeliveries([]); }} disabled={busy || !records.length}><option value="">เลือกพนักงาน</option>{records.map((record) => { const employee = roster.find((row) => row.employeeId === record.employee_id); return <option key={record.id} value={record.id}>{employee ? `${employee.employeeCode} · ${employee.employeeName}` : `พนักงาน ${record.employee_id}`} · สุทธิ {formatThaiMoney(record.net_pay)}</option>; })}</select></label><p className="text-sm text-[var(--muted)]">ถ้าเคยออกสลิปแล้ว ระบบจะเปิดฉบับเดิมและประวัติการส่งให้ตรวจสอบ</p><button className={button} disabled={busy || !recordId}>ออกหรือเปิดสลิป</button></form>
    {selected && <section aria-labelledby="selected-payslip" className="border-t border-[var(--line)] pt-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="selected-payslip" className="text-xl font-semibold">สลิป #{selected.id}</h2><p className="mt-1 text-sm text-[var(--muted)]">ออกเมื่อ {formatThaiDate(selected.generated_at)}</p></div><div className="flex items-center gap-2"><StatusBadge value={selected.status} />{selected.status === "generated" && <button className={quietButton} onClick={voidPayslip} disabled={busy}>ยกเลิกสลิป</button>}</div></div><PayslipSummary payslip={selected} /><button className={quietButton} disabled={busy || selected.status !== "generated"} onClick={() => { void run(() => downloadApiFile(`/v1/payslips/${selected.id}/download`, `payslip-${selected.payroll_record_id}.pdf`)); }}>ดาวน์โหลด PDF</button>
      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"><form onSubmit={deliver} className="workspace-section"><h3 className="font-semibold">ส่งสลิปทางอีเมล</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">ระบบจะบันทึกทุกครั้งเป็นประวัติแยกกัน</p><label className="mt-5 block text-sm">อีเมลผู้รับ<input className={field} name="recipient_email" type="email" required disabled={selected.status !== "generated"} /></label><button className={`mt-3 ${button}`} disabled={busy || selected.status !== "generated"}>ส่งสลิป</button></form>
        <div><h3 className="font-semibold">ประวัติการส่ง ({deliveries.length})</h3>{deliveries.length === 0 ? <div className="mt-3"><Feedback kind="empty" detail="ยังไม่มีประวัติการส่ง" /></div> : <ul className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">{deliveries.map((delivery) => <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span><strong>{delivery.recipient_email}</strong><span className="ml-2 text-[var(--muted)]">{formatThaiDate(delivery.attempted_at)}</span></span><StatusBadge value={delivery.status} />{delivery.status === "pending" && <PendingDeliveryResolution delivery={delivery} busy={busy} onResolve={(body) => { void run(() => payslipApi.resolveDelivery(selected.id, delivery.id, body).then((result) => result.data), (resolved) => setDeliveries((items) => items.map((item) => item.id === resolved.id ? { ...item, ...resolved } : item))); }} />}</li>)}</ul>}</div>
      </div>
    </section>}
  </div>;
}
