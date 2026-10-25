"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { payrollPaymentApi, type PayrollPaymentRow, type PaymentSummary } from "@/lib/payroll/payroll-payment-api";
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
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [decision, setDecision] = useState<{row: PayrollPaymentRow; action: "confirm" | "cancel"} | null>(null);
  const [detail, setDetail] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [qr, setQr] = useState<PayrollPaymentRow | null>(null);
  useEffect(() => { const abort = new AbortController(); void Promise.all([payrollPaymentApi.list(periodId, branchId, { signal: abort.signal }), payrollPaymentApi.summary(periodId, branchId, { signal: abort.signal })]).then(([result, totals]) => { if (!abort.signal.aborted) {
    setRows(result.data); setSummary(totals.data); } }).catch(cause => { if (!abort.signal.aborted)
    setError(cause.message); }); return () => abort.abort(); }, [periodId, branchId]);
  const prepare = async () => { setBusy(true); setError(""); setNotice(""); try {
    setRows((await payrollPaymentApi.prepare(periodId, branchId)).data);
    setSummary((await payrollPaymentApi.summary(periodId, branchId)).data);
    setNotice("เตรียมจ่ายแล้ว เก็บปลายทางและยอดเงินตามข้อมูลขณะเตรียม ยังไม่ถือว่าจ่ายเงินแล้ว");
  }
  catch (cause) {
    setError(cause instanceof Error ? cause.message : "เตรียมจ่ายไม่สำเร็จ");
  }
  finally {
    setBusy(false);
  } };
  const choose = (row: PayrollPaymentRow, action: "confirm" | "cancel") => { setDecision({row, action}); setDetail(""); setVerified(false); setQr(null); setError(""); setNotice(""); };
  const saveDecision = async () => {
    if (!decision?.row.payment || busy) return;
    setBusy(true); setError("");
    try {
      if (decision.action === "confirm") await payrollPaymentApi.confirm(decision.row.payment.id, detail);
      else await payrollPaymentApi.cancel(decision.row.payment.id, detail);
      const [result, totals] = await Promise.all([payrollPaymentApi.list(periodId, branchId), payrollPaymentApi.summary(periodId, branchId)]);
      setRows(result.data); setSummary(totals.data); setDecision(null);
      setNotice(decision.action === "confirm" ? "บันทึกว่าจ่ายแล้ว" : "ยกเลิกการเตรียมจ่ายแล้ว");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ โปรดลองใหม่"); }
    finally { setBusy(false); }
  };
  return <section className="workspace-section" aria-label="เตรียมจ่ายเงินเดือน"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">เตรียมจ่ายเงินเดือนตามสาขา</h2><p className="mt-2 max-w-prose text-sm text-[var(--muted)]">ใช้ยอดสุทธิเต็มจำนวนจากงวดที่ล็อกแล้ว การสร้างหรือสแกน QR ไม่ใช่หลักฐานว่าจ่ายสำเร็จ</p></div><button className="workspace-primary" disabled={busy || !rows.some(r => r.status === "unprepared") || rows.some(r => r.missing_destination)} onClick={() => void prepare()}>{busy ? "กำลังเตรียม…" : "เตรียมจ่ายสาขาที่เลือก"}</button></div>
<label className="mt-4 block max-w-sm text-sm">สาขาสำหรับเตรียมจ่าย<select className="workspace-control" value={branchId} disabled={busy} onChange={e => { setBranchId(e.target.value); setRows([]); setSummary(null); setDecision(null); setQr(null); setError(""); setNotice(""); }}><option value="">ทุกสาขาในงวด</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
{summary && <div className="mt-5 border-y border-[var(--line)] py-4" aria-label="สรุปการจ่ายเงิน"><p className="flex flex-wrap gap-x-6 gap-y-2 tabular-nums"><span>ยอดต้องจ่าย {formatThaiMoney(summary.totals.total_payable)} บาท</span><span>จ่ายแล้ว {formatThaiMoney(summary.totals.total_paid)} บาท</span><strong>ค้างจ่าย {formatThaiMoney(summary.totals.total_outstanding)} บาท</strong></p><ul className="mt-3 space-y-2 text-sm">{summary.branches.map(b => <li key={b.branch_id}>{b.branch_name} · จ่าย {b.paid_count}/{b.payable_count} คน · จ่ายแล้ว {formatThaiMoney(b.total_paid)} บาท · คงเหลือ {formatThaiMoney(b.total_outstanding)} บาท · {b.complete ? "จ่ายครบแล้ว" : "ยังจ่ายไม่ครบ"}</li>)}</ul></div>}
{decision?.row.payment && <form className="mt-5 border border-[var(--line)] p-5" role="region" aria-label="ตรวจสอบการจ่ายเงิน" onSubmit={e => { e.preventDefault(); void saveDecision(); }}><h3 className="font-semibold">{decision.action === "confirm" ? "ตรวจสอบก่อนบันทึกว่าจ่ายแล้ว" : "ยกเลิกการเตรียมจ่าย"}</h3><p className="mt-2">{decision.row.employee_code} · {decision.row.employee_name}</p><p className="mt-1">ยอดเต็มจำนวน {formatThaiMoney(decision.row.amount)} บาท</p>{decision.row.payment_method === "cash" ? <p className="mt-1">ปลายทาง: เงินสด</p> : <>
{decision.row.payment.account_number_last4 && <p className="mt-1 break-words">บัญชีธนาคารที่ตรึงไว้: {decision.row.payment.bank_code} · {decision.row.payment.account_holder_name} · บัญชีลงท้าย {decision.row.payment.account_number_last4}</p>}
{decision.row.payment.promptpay_phone && <p className="mt-1">เบอร์ PromptPay ที่ตรึงไว้: {decision.row.payment.promptpay_phone}</p>}
{decision.row.group === "social_security" && <p className="mt-2 text-sm text-[var(--muted)]">กลุ่มสมาชิกประกันสังคมใช้บัญชีธนาคารที่ตรึงไว้ ไม่มี QR สำหรับกลุ่มนี้</p>}
</>}
{decision.action === "confirm" ? <><label className="mt-4 block text-sm">เลขอ้างอิง (ถ้ามี)<input className="workspace-control" value={detail} maxLength={200} disabled={busy} onChange={e => setDetail(e.target.value)}/></label><label className="mt-4 flex items-start gap-2"><input type="checkbox" checked={verified} disabled={busy} onChange={e => setVerified(e.target.checked)}/>ตรวจสอบแล้วว่าจ่ายเงินให้พนักงานสำเร็จจริง</label><p className="mt-2 text-sm text-[var(--muted)]">การสร้างหรือสแกน QR ไม่ยืนยันว่าโอนสำเร็จ ตรวจสอบผลการจ่ายก่อนบันทึก</p></> : <><p className="mt-3 text-sm text-[var(--muted)]">การยกเลิกการเตรียมจ่ายไม่สามารถย้อนรายการโอนธนาคารหรือทำให้ QR ที่ดาวน์โหลดแล้วใช้งานไม่ได้</p><label className="mt-4 block text-sm">เหตุผลการยกเลิก<textarea className="workspace-control" value={detail} required maxLength={1000} disabled={busy} onChange={e => setDetail(e.target.value)}/></label></>}
<div className="mt-4 flex flex-wrap gap-3"><button type="submit" className="workspace-primary" disabled={busy || (decision.action === "confirm" ? !verified : !detail.trim())}>{busy ? "กำลังบันทึก…" : decision.action === "confirm" ? "บันทึกว่าจ่ายแล้ว" : "บันทึกการยกเลิก"}</button><button type="button" className="workspace-secondary" disabled={busy} onClick={() => setDecision(null)}>ปิด</button></div></form>}
{error && <Feedback kind="error" detail={error}/>} {notice && <Feedback kind="success" detail={notice}/>}
<div className="mt-6 space-y-6">{(Object.keys(groups) as (keyof typeof groups)[]).map(group => <section key={group} aria-label={groups[group]}><h3 className="font-semibold">{groups[group]}</h3>{!rows.some(r => r.group === group) ? <p className="mt-2 text-sm text-[var(--muted)]">ไม่มีรายการ</p> : <ul className="mt-2 divide-y divide-[var(--line)] border-y border-[var(--line)]">{rows.filter(r => r.group === group).map(r => <li key={r.payroll_record_id} className="flex flex-wrap items-center justify-between gap-3 py-4" data-payment-record={r.payroll_record_id}><div className="min-w-0"><Link href={`/employees/${r.employee_id}`} className="font-semibold underline underline-offset-4">{r.employee_code} · {r.employee_name}</Link><p className="mt-1 text-sm text-[var(--muted)]">{r.branch_name} · {r.payment_method === "cash" ? "เงินสด" : "โอน"} · {status[r.status]}</p>{r.payment?.promptpay_phone && <p className="mt-1 text-sm">เบอร์รับเงินที่บันทึก: {r.payment.promptpay_phone}</p>}{r.payment?.account_number_last4 && <p className="mt-1 text-sm">บัญชีลงท้าย {r.payment.account_number_last4}</p>}{r.payment?.paid_at && <p className="mt-1 text-sm">จ่ายเมื่อ {new Date(r.payment.paid_at).toLocaleString("th-TH")} · ผู้บันทึก #{r.payment.paid_by_user_account_id}{r.payment.reference_no && ` · อ้างอิง ${r.payment.reference_no}`}</p>}{r.payment_history?.map(p => <p key={p.id} className="mt-2 max-w-prose break-words text-sm text-[var(--muted)]">ยกเลิกการเตรียมจ่าย #{p.id} · {p.cancellation_reason} · ผู้บันทึก #{p.cancelled_by_user_account_id} · {p.cancelled_at && new Date(p.cancelled_at).toLocaleString("th-TH")}</p>)}{r.missing_destination && <p className="mt-1 text-sm text-[var(--danger)]">{r.missing_destination} · <Link href={`/employees/${r.employee_id}`} className="underline">แก้ปลายทางรับเงิน</Link></p>}</div><div className="flex max-w-full flex-wrap items-center gap-3"><strong className="tabular-nums">{formatThaiMoney(r.amount)}</strong>{r.status === "prepared" && <><button className="workspace-primary" disabled={busy} onClick={() => choose(r, "confirm")}>ยืนยันจ่ายเงิน</button><button className="workspace-secondary" disabled={busy} onClick={() => choose(r, "cancel")}>ยกเลิกการเตรียมจ่าย</button></>}{r.qr_available && <button className="workspace-secondary" onClick={() => setQr(r)}>แสดง QR {r.employee_code}</button>}</div></li>)}</ul>}</section>)}</div>
{qr?.payment && <div className="mt-6 border border-[var(--line)] p-5" role="region" aria-label="QR รับเงินเดือน"><h3 className="font-semibold">QR รับเงิน · {qr.employee_code}</h3><p className="mt-2">ผู้รับ {qr.payment.promptpay_phone} · ยอด {formatThaiMoney(qr.amount)} บาท</p><p className="mt-1 text-sm text-[var(--muted)]">ตรวจสอบชื่อผู้รับในแอปธนาคารก่อนจ่าย · รายการยังไม่ถือว่าจ่ายแล้ว</p>
    {/* eslint-disable-next-line @next/next/no-img-element -- Private authenticated SVG must stay same-origin. */}
    <img src={`/api/v1/payroll/payments/${qr.payment.id}/qr`} alt={`PromptPay ${qr.payment.promptpay_phone} ${qr.amount} บาท`} width={280} height={280} className="mt-3 max-w-full bg-white"/><button className="workspace-secondary mt-3" onClick={() => setQr(null)}>ปิด QR</button></div>}
</section>;
}
