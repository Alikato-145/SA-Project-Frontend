"use client";

import { useState } from "react";
import { EmployeePicker } from "@/components/employee-picker";
import { operationsApi } from "@/lib/operations/operations-api";

type Advance = { id: number; employeeId: number; requestMonth: string; amount: string; status: string; decisionNote: string | null };
type Loan = { id: number; principalAmount: string; reason: string; status: string; outstandingAmount: string;
  installments: { id: number; installmentNo: number; duePeriodStart: string; amount: string; status: string }[] };
type Debt = { id: number; transactionKind: string; transactionDate: string; description: string;
  amount: string; originalTransactionId: number | null; settledInPayrollRecordId: number | null };
type Ledger = { entries: Debt[]; balance: string };
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const primary = "rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50";
const secondary = "rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50";
const api = operationsApi.request;
export default function FinancePage() {
  const [employeeId, setEmployeeId] = useState("");
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [ledger, setLedger] = useState<Ledger>({ entries: [], balance: "0.00" });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    if (!employeeId) { setError("เลือกพนักงานก่อนโหลดข้อมูลการเงิน"); return; }
    setLoading(true); setError(""); setAdvances([]); setLoans([]); setLedger({ entries: [], balance: "0.00" });
    const query = `employee_id=${encodeURIComponent(employeeId)}`;
    const results = await Promise.allSettled([
      api<Advance[]>(`/advance-requests?${query}`),
      api<Loan[]>(`/loans?${query}`),
      api<Ledger>(`/debt-transactions?${query}`),
    ]);
    if (results[0].status === "fulfilled") setAdvances(results[0].value);
    if (results[1].status === "fulfilled") setLoans(results[1].value);
    if (results[2].status === "fulfilled") setLedger(results[2].value);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") setError(failed.reason instanceof Error ? failed.reason.message : "ไม่สามารถโหลดข้อมูลการเงินบางส่วนได้");
    setLoading(false);
  };
  const mutate = async (path: string, body: object, success: string) => {
    if (!employeeId) { setError("เลือกพนักงานก่อนทำรายการ"); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      setMessage(success);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกรายการทางการเงินได้"); }
    finally { setBusy(false); }
  };
  const submit = (event: React.FormEvent<HTMLFormElement>, path: string,
    body: (form: FormData) => object, success: string) => {
    event.preventDefault(); void mutate(path, body(new FormData(event.currentTarget)), success);
  };
  return <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 text-slate-900 sm:px-8">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">การเงินพนักงาน</p><h1 className="text-3xl font-bold">เงินทดรองจ่าย เงินกู้ และหนี้</h1><p className="mt-2 text-slate-600">ตรวจสอบภาระผูกพันก่อนปิดรอบเงินเดือน</p></header>
    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5"><label className="min-w-48 flex-1 text-sm">พนักงาน<EmployeePicker className={field} required value={employeeId} onChange={setEmployeeId} /></label><button className={primary} disabled={loading}>{loading ? "กำลังโหลด…" : "โหลดข้อมูลการเงิน"}</button></form>
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    <section className="rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">เงินทดรองจ่าย</h2><p className="mt-1 text-sm text-slate-600">การอนุมัติตรวจสอบวันที่ขอ จำนวนวันทำงาน เพดานเงินเดือน และเงินสุทธิที่คาดการณ์</p><div className="mt-4 grid gap-6 lg:grid-cols-[1fr_2fr]"><form onSubmit={(event) => submit(event, "/advance-requests", (form) => ({ employee_id: Number(employeeId), amount: String(form.get("amount")) }), "ส่งคำขอเงินทดรองจ่ายแล้ว")} className="space-y-3"><label className="block text-sm">จำนวนเงิน<input className={field} name="amount" type="number" min="0.01" step="0.01" required /></label><button className={primary} disabled={busy}>ส่งคำขอเงินทดรองจ่าย</button></form><div className="space-y-3">{advances.length === 0 && <p className="text-slate-600">ไม่พบคำขอเงินทดรองจ่าย</p>}{advances.map((row) => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><div><p className="font-semibold">{row.requestMonth} · {row.amount}</p><p className="text-sm text-slate-600">{row.status}{row.decisionNote ? ` · ${row.decisionNote}` : ""}</p></div>{row.status === "pending" && <div className="flex gap-2"><button className={secondary} disabled={busy} onClick={() => void mutate(`/advance-requests/${row.id}/approve`, {}, "อนุมัติเงินทดรองจ่ายแล้ว")}>อนุมัติ</button><button className={secondary} disabled={busy} onClick={() => void mutate(`/advance-requests/${row.id}/reject`, {}, "ไม่อนุมัติเงินทดรองจ่ายแล้ว")}>ไม่อนุมัติ</button></div>}</article>)}</div></div></section>
    <section className="rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">เงินกู้</h2><div className="mt-4 grid gap-6 lg:grid-cols-[1fr_2fr]"><form onSubmit={(event) => submit(event, "/loans", (form) => ({ employee_id: Number(employeeId), principal_amount: String(form.get("principal_amount")), installment_count: Number(form.get("installment_count")), first_due_month: `${String(form.get("first_due_month"))}-01`, reason: String(form.get("reason")) }), "สร้างเงินกู้และตารางผ่อนแล้ว")} className="space-y-3"><label className="block text-sm">ยอดเงินกู้<input className={field} name="principal_amount" type="number" min="0.01" step="0.01" required /></label><label className="block text-sm">จำนวนงวด (1–5)<input className={field} name="installment_count" type="number" min="1" max="5" required /></label><label className="block text-sm">เดือนที่เริ่มชำระ<input className={field} name="first_due_month" type="month" required /></label><label className="block text-sm">เหตุผล<input className={field} name="reason" required /></label><button className={primary} disabled={busy}>สร้างเงินกู้</button></form><div className="space-y-3">{loans.length === 0 && <p className="text-slate-600">ไม่พบรายการเงินกู้</p>}{loans.map((row) => <article key={row.id} className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">เงินกู้ #{row.id} · {row.principalAmount}</p><p className="text-sm text-slate-600">{row.reason} · {row.status} · คงเหลือ {row.outstandingAmount}</p><ul className="mt-2 space-y-1 text-sm">{row.installments.map((item) => <li key={item.id}>#{item.installmentNo} · {item.duePeriodStart} · {item.amount} · {item.status}</li>)}</ul></article>)}</div></div></section>
    <section className="rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">บัญชีหนี้</h2><p className="text-sm text-slate-600">การแก้ไขจะสร้างรายการกลับรายการ และรายการเดิมยังแสดงอยู่</p></div><p className="rounded-lg bg-amber-50 px-4 py-2 font-semibold text-amber-900">ยอดคงเหลือ {ledger.balance}</p></div><div className="mt-4 grid gap-6 lg:grid-cols-[1fr_2fr]"><form onSubmit={(event) => submit(event, "/debt-transactions", (form) => ({ employee_id: Number(employeeId), debt_type_id: Number(form.get("debt_type_id")), transaction_kind: form.get("transaction_kind"), amount: String(form.get("amount")), description: String(form.get("description")) }), "บันทึกรายการหนี้แล้ว")} className="space-y-3"><label className="block text-sm">รหัสประเภทหนี้<input className={field} name="debt_type_id" type="number" min="1" required /></label><label className="block text-sm">ประเภทรายการ<select className={field} name="transaction_kind"><option value="charge">เรียกเก็บ</option><option value="adjustment">ปรับปรุง</option></select></label><label className="block text-sm">จำนวนเงิน<input className={field} name="amount" type="number" min="0.01" step="0.01" required /></label><label className="block text-sm">รายละเอียด<input className={field} name="description" required /></label><button className={primary} disabled={busy}>บันทึกรายการ</button></form><div className="space-y-3">{ledger.entries.length === 0 && <p className="text-slate-600">ไม่พบรายการหนี้</p>}{ledger.entries.map((row) => <article key={row.id} className="rounded-xl bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{row.transactionDate} · {row.transactionKind} · {row.amount}</p><p className="text-sm text-slate-600">{row.description}{row.originalTransactionId ? ` · กลับรายการ #${row.originalTransactionId}` : ""}</p></div>{row.transactionKind !== "reversal" && !row.settledInPayrollRecordId && !ledger.entries.some((other) => other.originalTransactionId === row.id) && <form onSubmit={(event) => submit(event, `/debt-transactions/${row.id}/reverse`, (form) => ({ description: String(form.get("description")) }), "กลับรายการหนี้แล้ว")} className="flex gap-2"><label className="sr-only" htmlFor={`reversal-${row.id}`}>เหตุผลการกลับรายการ</label><input className={field} id={`reversal-${row.id}`} name="description" placeholder="เหตุผลที่แก้ไข" required /><button className={secondary} disabled={busy}>กลับรายการ</button></form>}</div></article>)}</div></div></section>
  </main>;
}
