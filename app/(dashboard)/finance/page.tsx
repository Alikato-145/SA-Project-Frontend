"use client";

import { DebtTypeAdministration } from "@/components/debt-type-administration";
import { useEffect, useState } from "react";
import { authApi } from "@/lib/auth/auth-api";
import { EmployeePicker } from "@/components/employee-picker";
import { Feedback, PageHeader, StatusBadge, formatThaiDate, formatThaiMoney, thaiLabel } from "@/components/workspace-ui";
import { operationsApi } from "@/lib/operations/operations-api";

type Advance = { id: string; employeeId: string; requestMonth: string; amount: string; status: string; decisionNote: string | null };
type Loan = { id: string; principalAmount: string; reason: string; status: string; outstandingAmount: string;
  installments: { id: string; installmentNo: number; duePeriodStart: string; amount: string; status: string }[] };
type Debt = { id: string; transactionKind: string; transactionDate: string; description: string;
  amount: string; originalTransactionId: string | null; settledInPayrollRecordId: string | null };
type Ledger = { entries: Debt[]; balance: string; outstandingBalance: string };
const field = "workspace-control";
const primary = "workspace-primary";
const secondary = "workspace-secondary";
const api = operationsApi.request;
export default function FinancePage() {
  const [canFinance, setCanFinance] = useState<boolean | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [debtTypes, setDebtTypes] = useState<{id: string; nameTh: string}[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [ledger, setLedger] = useState<Ledger>({ entries: [], balance: "0.00", outstandingBalance: "0.00" });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    void authApi.current().then((actor) => {
      const admin = actor.grants.some((grant) => ["HR", "OWNER"].includes(grant.role_code));
      setCanFinance(admin);
      if (!admin) { setEmployeeId(actor.account.employee?.id ?? ""); setEmployeeName(actor.account.employee?.display_name ?? "ยังไม่เชื่อมข้อมูลพนักงาน"); }
      else void api<{id: string; nameTh: string}[]>("/debt-types").then(setDebtTypes).catch((cause) => setError(cause.message));
    }).catch(() => setError("ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่"));
  }, []);
  const load = async () => {
    if (!employeeId) { setError("เลือกพนักงานก่อนโหลดข้อมูลการเงิน"); return; }
    setLoading(true); setError(""); setAdvances([]); setLoans([]); setLedger({ entries: [], balance: "0.00", outstandingBalance: "0.00" });
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
  if (canFinance === null) return <Feedback kind={error ? "error" : "empty"} detail={error || "กำลังตรวจสอบสิทธิ์…"} />;
  return <div className="space-y-7">
    <PageHeader title={canFinance ? "เงินทดรองจ่าย เงินกู้ และหนี้" : "เงินทดรองจ่ายและภาระหนี้ของฉัน"} description="ตรวจสอบภาระผูกพันของพนักงานก่อนปิดรอบเงินเดือน รายการหนี้ที่บันทึกแล้วจะเก็บเป็นประวัติ" />
    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="workspace-filter flex flex-wrap items-end gap-3"><label className="min-w-56 flex-1 text-sm font-medium">พนักงาน{canFinance ? <EmployeePicker className={field} required value={employeeId} onChange={setEmployeeId} /> : <span className="block mt-2">{employeeName}</span>}</label><button className={primary} disabled={loading}>{loading ? "กำลังโหลด…" : "โหลดข้อมูลการเงิน"}</button></form>
    <div className="space-y-3">{message ? <Feedback kind="success" detail={message} /> : null}{error ? <Feedback kind="error" title="ทำรายการไม่สำเร็จ" detail={error} /> : null}</div>
    <section className="workspace-section"><h2 className="text-xl font-semibold">เงินทดรองจ่าย</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">การอนุมัติตรวจสอบวันที่ขอ จำนวนวันทำงาน เพดานเงินเดือน และเงินสุทธิที่คาดการณ์</p><div className="mt-5 grid gap-6 lg:grid-cols-[1fr_2fr]"><form onSubmit={(event) => submit(event, "/advance-requests", (form) => ({ employee_id: employeeId, amount: String(form.get("amount")) }), "ส่งคำขอเงินทดรองจ่ายแล้ว")} className="space-y-4"><label className="block text-sm">จำนวนเงิน<input className={field} name="amount" type="number" min="0.01" step="0.01" required /></label><button className={primary} disabled={busy}>ส่งคำขอเงินทดรองจ่าย</button></form><div className="workspace-records">{advances.length === 0 && <div className="py-3"><Feedback kind="empty" detail="ไม่พบคำขอเงินทดรองจ่ายของพนักงานที่เลือก" /></div>}{advances.map((row) => <article key={row.id} className="workspace-record flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{row.requestMonth} · {formatThaiMoney(row.amount)}</p><p className="mt-1 text-sm text-[var(--muted)]">{row.decisionNote ?? "ยังไม่มีหมายเหตุการพิจารณา"}</p></div><div className="flex flex-wrap items-center gap-2"><StatusBadge value={row.status} />{canFinance && row.status === "pending" && <div className="flex gap-2"><button className={secondary} disabled={busy} onClick={() => void mutate(`/advance-requests/${row.id}/approve`, {}, "อนุมัติเงินทดรองจ่ายแล้ว")}>อนุมัติ</button><button className={secondary} disabled={busy} onClick={() => void mutate(`/advance-requests/${row.id}/reject`, {}, "ไม่อนุมัติเงินทดรองจ่ายแล้ว")}>ไม่อนุมัติ</button></div>}</div></article>)}</div></div></section>
    <section className="workspace-section"><h2 className="text-xl font-semibold">เงินกู้</h2><div className="mt-5 grid gap-6 lg:grid-cols-[1fr_2fr]">{canFinance ? <form onSubmit={(event) => submit(event, "/loans", (form) => ({ employee_id: employeeId, principal_amount: String(form.get("principal_amount")), installment_count: Number(form.get("installment_count")), first_due_month: `${String(form.get("first_due_month"))}-01`, reason: String(form.get("reason")) }), "สร้างเงินกู้และตารางผ่อนแล้ว")} className="space-y-4"><label className="block text-sm">ยอดเงินกู้<input className={field} name="principal_amount" type="number" min="0.01" step="0.01" required /></label><label className="block text-sm">จำนวนงวด (1-5)<input className={field} name="installment_count" type="number" min="1" max="5" required /></label><label className="block text-sm">เดือนที่เริ่มชำระ<input className={field} name="first_due_month" type="month" required /></label><label className="block text-sm">เหตุผล<input className={field} name="reason" required /></label><button className={primary} disabled={busy}>สร้างเงินกู้</button></form> : null}<div className="workspace-records">{loans.length === 0 && <p className="py-4 text-sm text-[var(--muted)]">ไม่พบรายการเงินกู้</p>}{loans.map((row) => <article key={row.id} className="workspace-record"><p className="font-semibold">เงินกู้ #{row.id} · {formatThaiMoney(row.principalAmount)}</p><p className="mt-1 text-sm text-[var(--muted)]">{row.reason} · {thaiLabel(row.status)}<span className="block">คงเหลือ {formatThaiMoney(row.outstandingAmount)}</span></p><ul className="mt-3 grid gap-1 text-sm text-[var(--muted)]">{row.installments.map((item) => <li key={item.id}>งวด {item.installmentNo}: {item.duePeriodStart} · {formatThaiMoney(item.amount)} · {thaiLabel(item.status)}</li>)}</ul></article>)}</div></div></section>
    {canFinance && <DebtTypeAdministration onChanged={() => { void api<{ id: string; nameTh: string }[]>("/debt-types").then(setDebtTypes).catch((cause) => setError(cause.message)); }} />}
    <section className="workspace-section"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">บัญชีหนี้</h2><p className="mt-1 text-sm text-[var(--muted)]">ยอดรอหักไม่นับรายการที่หักในงวดล็อกแล้ว ประวัติเดิมและรายการกลับรายการยังแสดงอยู่</p></div><p className="border-l-2 border-amber-500 bg-amber-50 px-4 py-2 font-semibold text-amber-900">ยอดรอหัก {formatThaiMoney(ledger.outstandingBalance)}</p></div><div className="mt-5 grid gap-6 lg:grid-cols-[1fr_2fr]">{canFinance ? <form onSubmit={(event) => submit(event, "/debt-transactions", (form) => ({ employee_id: employeeId, debt_type_id: String(form.get("debt_type_id")), transaction_kind: form.get("transaction_kind"), amount: String(form.get("amount")), description: String(form.get("description")) }), "บันทึกรายการหนี้แล้ว")} className="space-y-4"><label className="block text-sm">ประเภทหนี้<select className={field} name="debt_type_id" required><option value="">เลือกประเภทหนี้</option>{debtTypes.map((row) => <option key={row.id} value={row.id}>{row.nameTh}</option>)}</select></label><label className="block text-sm">ประเภทรายการ<select className={field} name="transaction_kind"><option value="charge">เรียกเก็บ</option><option value="adjustment">ปรับปรุง</option></select></label><label className="block text-sm">จำนวนเงิน<input className={field} name="amount" type="number" min="0.01" step="0.01" required /></label><label className="block text-sm">รายละเอียด<input className={field} name="description" required /></label><button className={primary} disabled={busy}>บันทึกรายการ</button></form> : null}<div className="workspace-records">{ledger.entries.length === 0 && <div className="py-3"><Feedback kind="empty" detail="ไม่พบรายการหนี้ของพนักงานที่เลือก" /></div>}{ledger.entries.map((row) => <article key={row.id} className="workspace-record"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{formatThaiDate(row.transactionDate)} · {thaiLabel(row.transactionKind)} · {formatThaiMoney(row.amount)}</p><p className="mt-1 text-sm text-[var(--muted)]">{row.description}{row.originalTransactionId ? ` · กลับรายการ #${row.originalTransactionId}` : ""}</p></div>{canFinance && row.transactionKind !== "reversal" && !row.settledInPayrollRecordId && !ledger.entries.some((other) => other.originalTransactionId === row.id) && <form onSubmit={(event) => submit(event, `/debt-transactions/${row.id}/reverse`, (form) => ({ description: String(form.get("description")) }), "กลับรายการหนี้แล้ว")} className="flex flex-wrap items-end gap-2"><label className="sr-only" htmlFor={`reversal-${row.id}`}>เหตุผลการกลับรายการ</label><input className={field} id={`reversal-${row.id}`} name="description" placeholder="เหตุผลที่แก้ไข" required /><button className={secondary} disabled={busy}>กลับรายการ</button></form>}</div></article>)}</div></div></section>
  </div>;
}
