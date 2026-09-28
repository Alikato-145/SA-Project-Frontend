"use client";

import { DecisionHistoryView } from "@/lib/operations/operation-controls";
import { useState } from "react";
import { operationsRequest as api, operationError, operationPermissions } from "@/lib/operations/operations-api";
import { useAuthenticatedActor } from "@/components/dashboard-access-guard";

type Overtime = { id: string; employee_id: string; overtime_date: string;
  overtime_type: "hourly" | "rest_day" | "public_holiday"; hours: string | null;
  day_units: string | null; reason: string | null; status: string };
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const primary = "rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50";

export default function OvertimePage() {
  const actor = useAuthenticatedActor();
  const permissions = operationPermissions(actor);
  const [employee_id, setEmployeeId] = useState(permissions.selfOnly ? actor?.account.employee?.id ?? "" : "");
  const [rows, setRows] = useState<Overtime[]>([]);
  const [type, setType] = useState<Overtime["overtime_type"]>("hourly");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async (target = employee_id) => {
    if (!target) { setError("Enter an employee ID."); return; }
    setLoading(true); setError(""); setRows([]);
    try { setRows(await api<Overtime[]>(`/overtime-records?employee_id=${encodeURIComponent(target)}`)); }
    catch (cause) { setError(operationError(cause)); }
    finally { setLoading(false); }
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/overtime-records", { method: "POST", body: JSON.stringify({
        employee_id: String(form.get("employee_id")), overtime_date: form.get("overtime_date"),
        overtime_type: type, ...(type === "hourly" ? { hours: form.get("hours") } : { day_units: form.get("day_units") }),
        work_day_record_id: form.get("work_day_record_id") ? String(form.get("work_day_record_id")) : undefined,
        reason: form.get("reason"),
      }) });
      const target = String(form.get("employee_id")); setEmployeeId(target);
      setMessage("Overtime request submitted."); await load(target);
    } catch (cause) { setError(operationError(cause)); }
    finally { setBusy(false); }
  };
  const decide = async (id: string, action: "approve" | "reject", remark: string) => {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try { await api(`/overtime-records/${id}/${action}`, { method: "POST", body: JSON.stringify({ remark }) });
      setMessage(`Overtime ${action === "approve" ? "approved" : "rejected"}.`); await load(); }
    catch (cause) { setError(operationError(cause)); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 text-slate-900 sm:px-8"><header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Approvals</p><h1 className="text-3xl font-bold">Overtime</h1><p className="mt-2 text-slate-600">Only explicitly approved overtime is payable.</p></header>
    {permissions.selfOnly && !actor?.account.employee && <p role="alert">This account has no linked employee record. Contact HR to associate your account before using employee operations.</p>}
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]"><section className="rounded-2xl border border-slate-200 p-5"><form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex flex-wrap items-end gap-3"><label className="min-w-40 flex-1 text-sm">Employee ID<input className={field} type="text" inputMode="numeric" pattern="[1-9][0-9]*" required readOnly={permissions.selfOnly} value={employee_id} onChange={(e) => setEmployeeId(e.target.value)} /></label><button className={primary} disabled={loading}>{loading ? "Loading…" : "Load overtime"}</button></form>
      {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">{error}{error.startsWith("Your session") && <a className="ml-2 underline" href="/login">Sign in</a>}</p>}
      <div className="mt-6 space-y-4"><h2 className="text-xl font-semibold">Requests</h2>{rows.length === 0 && !loading && <p className="text-slate-600">No overtime requests loaded.</p>}{rows.map((row) => <article key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex justify-between gap-2"><div><p className="font-semibold">{row.overtime_date} · {row.overtime_type.replaceAll("_", " ")}</p><p className="text-sm text-slate-600">{row.hours ? `${row.hours} hours` : `${row.day_units ?? "0"} day units`} · {row.reason ?? "No reason"}</p></div><span className="h-fit rounded-full bg-white px-3 py-1 text-sm">{row.status}</span></div>{permissions.canApprove && row.status === "pending" && <form onSubmit={(event) => { event.preventDefault(); const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-action") as "approve" | "reject"; if (action) void decide(row.id, action, String(new FormData(event.currentTarget).get("remark") ?? "")); }} className="mt-4 flex flex-wrap items-end gap-2"><label className="text-sm">Decision note<input className={field} name="remark" /></label><button className={primary} data-action="approve" disabled={busy || (permissions.selfOnly && !actor?.account.employee)}>Approve</button><button className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50" data-action="reject" disabled={busy || (permissions.selfOnly && !actor?.account.employee)}>Reject</button></form>}<DecisionHistoryView key={`${row.id}-${row.status}`} path={`/overtime-records/${row.id}/history`} /></article>)}</div></section>
      <form onSubmit={(event) => void submit(event)} className="h-fit space-y-4 rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">New overtime request</h2><label className="block text-sm">Employee ID<input className={field} name="employee_id" type="text" inputMode="numeric" pattern="[1-9][0-9]*" defaultValue={permissions.selfOnly ? actor?.account.employee?.id : undefined} readOnly={permissions.selfOnly} required /></label><label className="block text-sm">Date<input className={field} name="overtime_date" type="date" required /></label><label className="block text-sm">Type<select className={field} value={type} onChange={(event) => setType(event.target.value as Overtime["overtime_type"])}><option value="hourly">Hourly</option><option value="rest_day">Rest day</option><option value="public_holiday">Public holiday</option></select></label>{type === "hourly" ? <label className="block text-sm">Hours<input className={field} name="hours" type="number" min="0.01" step="0.01" required /></label> : <label className="block text-sm">Day units<input className={field} name="day_units" type="number" min="0.01" step="0.01" required /></label>}<label className="block text-sm">Work-day record ID (if applicable)<input className={field} name="work_day_record_id" type="text" inputMode="numeric" pattern="[1-9][0-9]*" /></label><label className="block text-sm">Reason<input className={field} name="reason" /></label><button className={primary} disabled={busy || (permissions.selfOnly && !actor?.account.employee)}>Submit request</button></form>
    </div></main>;
}
