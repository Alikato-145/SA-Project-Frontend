"use client";

import { DecisionHistoryView } from "@/lib/operations/operation-controls";
import { useState } from "react";
import { operationsRequest as api, operationError, operationPermissions, type LeaveType, type LeaveQuota } from "@/lib/operations/operations-api";
import { useAuthenticatedActor } from "@/components/dashboard-access-guard";

type Leave = { id: string; employee_id: string; original_leave_type_id: string;
  final_leave_type_id: string | null; start_date: string; end_date: string;
  requested_days: string; status: string; reason: string | null };
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const primary = "rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50";

export default function LeavePage() {
  const actor = useAuthenticatedActor();
  const permissions = operationPermissions(actor);
  const [employee_id, setEmployeeId] = useState(permissions.selfOnly ? actor?.account.employee?.id ?? "" : "");
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [quotas, setQuotas] = useState<LeaveQuota[]>([]);
  const [rows, setRows] = useState<Leave[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async (target = employee_id) => {
    if (!target) { setError("Enter an employee ID."); return; }
    setLoading(true); setError(""); setRows([]);
    try {
      const query = encodeURIComponent(target);
      const [requests, leaveTypes, leaveQuotas] = await Promise.all([
        api<Leave[]>(`/leave-requests?employee_id=${query}`), api<LeaveType[]>("/leave-types"),
        api<LeaveQuota[]>(`/leave-quotas?employee_id=${query}&quota_year=${new Date().getFullYear()}`),
      ]);
      setRows(requests); setTypes(leaveTypes); setQuotas(leaveQuotas);
    }
    catch (cause) { setError(operationError(cause)); }
    finally { setLoading(false); }
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/leave-requests", { method: "POST", body: JSON.stringify({
        employee_id: String(form.get("employee_id")), leave_type_id: String(form.get("leave_type_id")),
        start_date: form.get("start_date"), end_date: form.get("end_date"),
        reason: form.get("reason"), is_retroactive: form.get("is_retroactive") === "on",
      }) });
      const target = String(form.get("employee_id")); setEmployeeId(target);
      setMessage("Leave request submitted."); await load(target);
    } catch (cause) { setError(operationError(cause)); }
    finally { setBusy(false); }
  };
  const decide = async (id: string, action: "approve" | "reject", form: FormData) => {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try {
      const finalType = String(form.get("final_leave_type_id") ?? "");
      await api(`/leave-requests/${id}/${action}`, { method: "POST", body: JSON.stringify(
        action === "approve" ? { ...(finalType ? { final_leave_type_id: finalType } : {}) }
          : { remark: String(form.get("remark") ?? "") }) });
      setMessage(`Leave request ${action === "approve" ? "approved" : "rejected"}.`); await load();
    } catch (cause) { setError(operationError(cause)); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 text-slate-900 sm:px-8">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Approvals</p><h1 className="text-3xl font-bold">Leave</h1><p className="mt-2 text-slate-600">Request leave and review each decision.</p></header>
    {permissions.selfOnly && !actor?.account.employee && <p role="alert">This account has no linked employee record. Contact HR to associate your account before using employee operations.</p>}
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="rounded-2xl border border-slate-200 p-5"><form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex flex-wrap items-end gap-3"><label className="min-w-40 flex-1 text-sm">Employee ID<input className={field} type="text" inputMode="numeric" pattern="[1-9][0-9]*" required readOnly={permissions.selfOnly} value={employee_id} onChange={(e) => setEmployeeId(e.target.value)} /></label><button className={primary} disabled={loading}>{loading ? "Loading…" : "Load requests"}</button></form>
        {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">{error}{error.startsWith("Your session") && <a className="ml-2 underline" href="/login">Sign in</a>}</p>}
        <section className="mt-4"><h2 className="font-semibold">Leave types and quota</h2><p className="text-sm text-slate-600">Approved leave is not deducted from payroll. Load requests to review the current year quota; other years remain enforced when approving.</p><ul className="text-sm">{types.map((type) => <li key={type.id}>#{type.id} {type.name} · Approved leave: no deduction · {quotas.filter((quota) => quota.leave_type_id === type.id).map((quota) => `${quota.quota_year}: ${quota.used_days} used / ${quota.entitled_days} entitled`).join(", ") || "No quota assigned"}</li>)}</ul></section><div className="mt-6 space-y-4"><h2 className="text-xl font-semibold">Requests</h2>{rows.length === 0 && !loading && <p className="text-slate-600">No leave requests loaded.</p>}
          {rows.map((row) => <article key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{row.start_date} – {row.end_date}</p><p className="text-sm text-slate-600">{row.requested_days} days · Type {row.final_leave_type_id ?? row.original_leave_type_id} · {row.reason ?? "No reason"}</p></div><span className="h-fit rounded-full bg-white px-3 py-1 text-sm font-medium">{row.status}</span></div>
            {permissions.canApprove && row.status === "pending" && <form onSubmit={(event) => { event.preventDefault(); const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-action") as "approve" | "reject"; if (action) void decide(row.id, action, new FormData(event.currentTarget)); }} className="mt-4 flex flex-wrap items-end gap-2"><label className="text-sm">Final type ID (optional)<input className={field} name="final_leave_type_id" type="text" inputMode="numeric" pattern="[1-9][0-9]*" /></label><label className="text-sm">Rejection note<input className={field} name="remark" /></label><button className={primary} type="submit" data-action="approve" disabled={busy || (permissions.selfOnly && !actor?.account.employee)}>Approve</button><button className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50" type="submit" data-action="reject" disabled={busy || (permissions.selfOnly && !actor?.account.employee)}>Reject</button></form>}<DecisionHistoryView key={`${row.id}-${row.status}`} path={`/leave-requests/${row.id}/history`} />
          </article>)}</div></section>
      <form onSubmit={(event) => void submit(event)} className="h-fit space-y-4 rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">New leave request</h2><label className="block text-sm">Employee ID<input className={field} name="employee_id" type="text" inputMode="numeric" pattern="[1-9][0-9]*" defaultValue={permissions.selfOnly ? actor?.account.employee?.id : undefined} readOnly={permissions.selfOnly} required /></label><label className="block text-sm">Leave type ID<input className={field} name="leave_type_id" type="text" inputMode="numeric" pattern="[1-9][0-9]*" required /></label><label className="block text-sm">First day<input className={field} name="start_date" type="date" required /></label><label className="block text-sm">Last day<input className={field} name="end_date" type="date" required /></label><label className="block text-sm">Reason<input className={field} name="reason" /></label><label className="flex items-center gap-2 text-sm"><input name="is_retroactive" type="checkbox" /> Retroactive request</label><button className={primary} disabled={busy || (permissions.selfOnly && !actor?.account.employee)}>Submit request</button></form>
    </div>
  </main>;
}
