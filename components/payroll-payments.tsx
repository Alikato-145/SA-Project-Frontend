"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { payrollPaymentApi, type PayrollPaymentRow } from "@/lib/payroll/payroll-payment-api";
import { Feedback, formatThaiMoney } from "./workspace-ui";
const groups = { social_security: "สมาชิกประกันสังคม", cash: "เงินสด · ไม่เป็นสมาชิกประกันสังคม", transfer: "โอน PromptPay · ไม่เป็นสมาชิกประกันสังคม" };
const status = { zero: "ยอดสุทธิเป็นศูนย์ · ไม่มีภาระจ่าย", unprepared: "ยังไม่เตรียมจ่าย", prepared: "เตรียมแล้ว · ยังไม่จ่าย", paid: "จ่ายแล้ว" };
export function PayrollPayments({ periodId, branches }: {
  periodId: string;
  branches: {
    id: string;
    name: string;
  }[];
}) {
  const [branchId, setBranchId] = useState("");
  const [rows, setRows] = useState<PayrollPaymentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [qr, setQr] = useState<PayrollPaymentRow | null>(null);
  useEffect(() => { const abort = new AbortController(); void payrollPaymentApi.list(periodId, branchId, { signal: abort.signal }).then(result => { if (!abort.signal.aborted)
    setRows(result.data); }).catch(cause => { if (!abort.signal.aborted)
    setError(cause.message); }); return () => abort.abort(); }, [periodId, branchId]);
  const prepare = async () => { setBusy(true); setError(""); setNotice(""); try {
    setRows((await payrollPaymentApi.prepare(periodId, branchId)).data);
    setNotice("เตรียมจ่ายแล้ว เก็บปลายทางและยอดเงินตามข้อมูลขณะเตรียม ยังไม่ถือว่าจ่ายเงินแล้ว");
  }
  catch (cause) {
    setError(cause instanceof Error ? cause.message : "เตรียมจ่ายไม่สำเร็จ");
  }
  finally {
    setBusy(false);
  } };
  return <section className="workspace-section" aria-label="เตรียมจ่ายเงินเดือน"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">เตรียมจ่ายเงินเดือนตามสาขา</h2><p className="mt-2 max-w-prose text-sm text-[var(--muted)]">ใช้ยอดสุทธิเต็มจำนวนจากงวดที่ล็อกแล้ว การสร้างหรือสแกน QR ไม่ใช่หลักฐานว่าจ่ายสำเร็จ</p></div><button className="workspace-primary" disabled={busy || !rows.some(r => r.status === "unprepared") || rows.some(r => r.missing_destination)} onClick={() => void prepare()}>{busy ? "กำลังเตรียม…" : "เตรียมจ่ายสาขาที่เลือก"}</button></div>
<label className="mt-4 block max-w-sm text-sm">สาขาสำหรับเตรียมจ่าย<select className="workspace-control" value={branchId} disabled={busy} onChange={e => { setBranchId(e.target.value); setRows([]); setQr(null); setError(""); setNotice(""); }}><option value="">ทุกสาขาในงวด</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
{error && <Feedback kind="error" detail={error}/>} {notice && <Feedback kind="success" detail={notice}/>}
<div className="mt-6 space-y-6">{(Object.keys(groups) as (keyof typeof groups)[]).map(group => <section key={group} aria-label={groups[group]}><h3 className="font-semibold">{groups[group]}</h3>{!rows.some(r => r.group === group) ? <p className="mt-2 text-sm text-[var(--muted)]">ไม่มีรายการ</p> : <ul className="mt-2 divide-y divide-[var(--line)] border-y border-[var(--line)]">{rows.filter(r => r.group === group).map(r => <li key={r.payroll_record_id} className="flex flex-wrap items-center justify-between gap-3 py-4" data-payment-record={r.payroll_record_id}><div className="min-w-0"><Link href={`/employees/${r.employee_id}`} className="font-semibold underline underline-offset-4">{r.employee_code} · {r.employee_name}</Link><p className="mt-1 text-sm text-[var(--muted)]">{r.branch_name} · {r.payment_method === "cash" ? "เงินสด" : "โอน"} · {status[r.status]}</p>{r.payment?.promptpay_phone && <p className="mt-1 text-sm">เบอร์รับเงินที่บันทึก: {r.payment.promptpay_phone}</p>}{r.payment?.account_number_last4 && <p className="mt-1 text-sm">บัญชีลงท้าย {r.payment.account_number_last4}</p>}{r.missing_destination && <p className="mt-1 text-sm text-[var(--danger)]">{r.missing_destination} · <Link href={`/employees/${r.employee_id}`} className="underline">แก้ปลายทางรับเงิน</Link></p>}</div><div className="flex max-w-full flex-wrap items-center gap-3"><strong className="tabular-nums">{formatThaiMoney(r.amount)}</strong>{r.qr_available && <button className="workspace-secondary" onClick={() => setQr(r)}>แสดง QR {r.employee_code}</button>}</div></li>)}</ul>}</section>)}</div>
{qr?.payment && <div className="mt-6 border border-[var(--line)] p-5" role="region" aria-label="QR รับเงินเดือน"><h3 className="font-semibold">QR รับเงิน · {qr.employee_code}</h3><p className="mt-2">ผู้รับ {qr.payment.promptpay_phone} · ยอด {formatThaiMoney(qr.amount)} บาท</p><p className="mt-1 text-sm text-[var(--muted)]">ตรวจสอบชื่อผู้รับในแอปธนาคารก่อนจ่าย · รายการยังไม่ถือว่าจ่ายแล้ว</p>
    {/* eslint-disable-next-line @next/next/no-img-element -- Private authenticated SVG must stay same-origin. */}
    <img src={`/api/v1/payroll/payments/${qr.payment.id}/qr`} alt={`PromptPay ${qr.payment.promptpay_phone} ${qr.amount} บาท`} width={280} height={280} className="mt-3 max-w-full bg-white"/><button className="workspace-secondary mt-3" onClick={() => setQr(null)}>ปิด QR</button></div>}
</section>;
}
