"use client";

import { useState } from "react";
import { operationsRequest as api, operationError, operationPermissions } from "@/lib/operations/operations-api";
import { useAuthenticatedActor } from "@/components/dashboard-access-guard";

type Advance = { id: string; employee_id: string; request_month: string; amount: string; status: string; decision_note: string | null };
type Loan = { id: string; principal_amount: string; reason: string; status: string; outstanding_amount: string;
  installments: { id: string; installment_no: number; due_period_start: string; amount: string; status: string }[] };
type Debt = { id: string; transaction_kind: string; transaction_date: string; description: string;
  amount: string; original_transaction_id: string | null; settled_in_payroll_record_id: string | null; settled_at?: string | null };
type Ledger = { entries: Debt[]; balance: string; outstanding_balance?: string };
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const primary = "rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50";
const secondary = "rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50";

export default function FinancePage() {
  const actor = useAuthenticatedActor();
  const permissions = operationPermissions(actor);
  const [employee_id, setEmployeeId] = useState(permissions.selfOnly ? actor?.account.employee?.id ?? "" : "");
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [ledger, setLedger] = useState<Ledger>({ entries: [], balance: "0.00" });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async (target = employee_id) => {
    if (!target) { setError("Enter an employee ID."); return; }
    setLoading(true); setError(""); setAdvances([]); setLoans([]); setLedger({ entries: [], balance: "0.00" });
    const query = `employee_id=${encodeURIComponent(target)}`;
    const results = await Promise.allSettled([
      api<Advance[]>(`/advance-requests?${query}`),
      api<Loan[]>(`/loans?${query}`),
      api<Ledger>(`/debt-transactions?${query}`),
    ]);
    if (results[0].status === "fulfilled") setAdvances(results[0].value);
    if (results[1].status === "fulfilled") setLoans(results[1].value);
    if (results[2].status === "fulfilled") setLedger(results[2].value);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") setError(operationError(failed.reason));
    setLoading(false);
  };
  const mutate = async (path: string, body: object, success: string) => {
    if (!employee_id) { setError("Enter an employee ID first."); return; }
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      setMessage(success);
      await load();
    } catch (cause) { setError(operationError(cause)); }
    finally { setBusy(false); }
  };
  const submit = (event: React.FormEvent<HTMLFormElement>, path: string,
    body: (form: FormData) => object, success: string) => {
    event.preventDefault(); void mutate(path, body(new FormData(event.currentTarget)), success);
  };
  return <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 text-slate-900 sm:px-8">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Employee finance</p><h1 className="text-3xl font-bold">Advances, loans and debt</h1><p className="mt-2 text-slate-600">Review obligations before payroll closes.</p></header>
    {permissions.selfOnly && !actor?.account.employee && <p role="alert">This account has no linked employee record. Contact HR to associate your account before using employee operations.</p>}
    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5"><label className="min-w-48 flex-1 text-sm">Employee ID<input className={field} type="text" inputMode="numeric" pattern="[1-9][0-9]*" required readOnly={permissions.selfOnly} value={employee_id} onChange={(event) => setEmployeeId(event.target.value)} /></label><button className={primary} disabled={loading}>{loading ? "Loading…" : "Load finance"}</button></form>
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}{error.startsWith("Your session") && <a className="ml-2 underline" href="/login">Sign in</a>}</p>}
    <section className="rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Advances</h2><p className="mt-1 text-sm text-slate-600">Approval checks the request date, worked days, salary cap and projected net pay.</p><div className="mt-4 grid gap-6 lg:grid-cols-[1fr_2fr]"><form onSubmit={(event) => submit(event, "/advance-requests", (form) => ({ employee_id: employee_id, amount: String(form.get("amount")) }), "Advance requested.")} className="space-y-3"><label className="block text-sm">Amount<input className={field} name="amount" type="number" min="0.01" step="0.01" required /></label><button className={primary} disabled={busy || (permissions.selfOnly && !actor?.account.employee)}>Request advance</button></form><div className="space-y-3">{advances.length === 0 && <p className="text-slate-600">No advance requests loaded.</p>}{advances.map((row) => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><div><p className="font-semibold">{row.request_month} · {row.amount}</p><p className="text-sm text-slate-600">{row.status}{row.decision_note ? ` · ${row.decision_note}` : ""}</p></div>{permissions.canFinance && row.status === "pending" && <div className="flex gap-2"><button className={secondary} disabled={busy || (permissions.selfOnly && !actor?.account.employee)} onClick={() => void mutate(`/advance-requests/${row.id}/approve`, {}, "Advance approved.")}>Approve</button><button className={secondary} disabled={busy || (permissions.selfOnly && !actor?.account.employee)} onClick={() => void mutate(`/advance-requests/${row.id}/reject`, {}, "Advance rejected.")}>Reject</button></div>}</article>)}</div></div></section>
    <section className="rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Loans</h2><div className="mt-4 grid gap-6 lg:grid-cols-[1fr_2fr]"><form hidden={!permissions.canFinance} onSubmit={(event) => submit(event, "/loans", (form) => ({ employee_id: employee_id, principal_amount: String(form.get("principal_amount")), installment_count: Number(form.get("installment_count")), first_due_month: `${String(form.get("first_due_month"))}-01`, reason: String(form.get("reason")) }), "Loan and schedule created.")} className="space-y-3"><label className="block text-sm">Principal amount<input className={field} name="principal_amount" type="number" min="0.01" step="0.01" required /></label><label className="block text-sm">Installments (1–5)<input className={field} name="installment_count" type="number" min="1" max="5" required /></label><label className="block text-sm">First due month<input className={field} name="first_due_month" type="month" required /></label><label className="block text-sm">Reason<input className={field} name="reason" required /></label><button className={primary} disabled={busy || (permissions.selfOnly && !actor?.account.employee)}>Create loan</button></form><div className="space-y-3">{loans.length === 0 && <p className="text-slate-600">No loans loaded.</p>}{loans.map((row) => <article key={row.id} className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">Loan #{row.id} · {row.principal_amount}</p><p className="text-sm text-slate-600">{row.reason} · {row.status} · Outstanding {row.outstanding_amount}</p><ul className="mt-2 space-y-1 text-sm">{row.installments.map((item) => <li key={item.id}>#{item.installment_no} · {item.due_period_start} · {item.amount} · {item.status}</li>)}</ul></article>)}</div></div></section>
    <section className="rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">Debt ledger</h2><p className="text-sm text-slate-600">Corrections add a reversal. Settled entries remain in the ledger total and no longer count as outstanding.</p></div><p className="rounded-lg bg-amber-50 px-4 py-2 font-semibold text-amber-900">Outstanding {ledger.outstanding_balance ?? "—"}<span className="mt-1 block text-sm font-normal">Ledger total {ledger.balance}</span></p></div><div className="mt-4 grid gap-6 lg:grid-cols-[1fr_2fr]"><form hidden={!permissions.canFinance} onSubmit={(event) => submit(event, "/debt-transactions", (form) => ({ employee_id: employee_id, debt_type_id: String(form.get("debt_type_id")), transaction_kind: form.get("transaction_kind"), amount: String(form.get("amount")), description: String(form.get("description")) }), "Debt entry recorded.")} className="space-y-3"><label className="block text-sm">Debt type ID<input className={field} name="debt_type_id" type="text" inputMode="numeric" pattern="[1-9][0-9]*" required /></label><label className="block text-sm">Entry type<select className={field} name="transaction_kind"><option value="charge">Charge</option><option value="adjustment">Adjustment</option></select></label><label className="block text-sm">Amount<input className={field} name="amount" type="number" min="0.01" step="0.01" required /></label><label className="block text-sm">Description<input className={field} name="description" required /></label><button className={primary} disabled={busy || (permissions.selfOnly && !actor?.account.employee)}>Record entry</button></form><div className="space-y-3">{ledger.entries.length === 0 && <p className="text-slate-600">No debt entries loaded.</p>}{ledger.entries.map((row) => <article key={row.id} className="rounded-xl bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{row.transaction_date} · {row.transaction_kind} · {row.amount}</p><p className="text-sm text-slate-600">{row.description}{row.original_transaction_id ? ` · Reverses #${row.original_transaction_id}` : ""}</p>{(row.settled_in_payroll_record_id || row.settled_at) && <p className="mt-1 text-sm text-emerald-800">Settled in payroll{row.settled_in_payroll_record_id ? ` #${row.settled_in_payroll_record_id}` : ""}{row.settled_at ? ` · ${row.settled_at}` : ""}</p>}</div>{permissions.canFinance && row.transaction_kind !== "reversal" && !row.settled_in_payroll_record_id && !ledger.entries.some((other) => other.original_transaction_id === row.id) && <form onSubmit={(event) => submit(event, `/debt-transactions/${row.id}/reverse`, (form) => ({ description: String(form.get("description")) }), "Debt entry reversed.")} className="flex gap-2"><label className="sr-only" htmlFor={`reversal-${row.id}`}>Reversal reason</label><input className={field} id={`reversal-${row.id}`} name="description" placeholder="Correction reason" required /><button className={secondary} disabled={busy || (permissions.selfOnly && !actor?.account.employee)}>Reverse</button></form>}</div></article>)}</div></div></section>
  </main>;
}
