"use client";

import { useState } from "react";

type Overtime = { id: number; employeeId: number; overtimeDate: string;
  overtimeType: "hourly" | "rest_day" | "public_holiday"; hours: string | null;
  dayUnits: string | null; reason: string | null; status: string };
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const primary = "rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50";
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: "same-origin", ...init,
    headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message ?? data?.code ?? `Request failed (${response.status})`);
  return data as T;
}
export default function OvertimePage() {
  const [employeeId, setEmployeeId] = useState("");
  const [rows, setRows] = useState<Overtime[]>([]);
  const [type, setType] = useState<Overtime["overtimeType"]>("hourly");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    if (!employeeId) { setError("Enter an employee ID."); return; }
    setLoading(true); setError(""); setRows([]);
    try { setRows(await api<Overtime[]>(`/overtime-records?employee_id=${encodeURIComponent(employeeId)}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load overtime."); }
    finally { setLoading(false); }
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/overtime-records", { method: "POST", body: JSON.stringify({
        employee_id: Number(form.get("employee_id")), overtime_date: form.get("overtime_date"),
        overtime_type: type, ...(type === "hourly" ? { hours: form.get("hours") } : { day_units: form.get("day_units") }),
        work_day_record_id: form.get("work_day_record_id") ? Number(form.get("work_day_record_id")) : undefined,
        reason: form.get("reason"),
      }) });
      setMessage("Overtime request submitted."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit overtime."); }
    finally { setBusy(false); }
  };
  const decide = async (id: number, action: "approve" | "reject", remark: string) => {
    setBusy(true); setError(""); setMessage("");
    try { await api(`/overtime-records/${id}/${action}`, { method: "POST", body: JSON.stringify({ remark }) });
      setMessage(`Overtime ${action === "approve" ? "approved" : "rejected"}.`); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not decide overtime."); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 text-slate-900 sm:px-8"><header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Approvals</p><h1 className="text-3xl font-bold">Overtime</h1><p className="mt-2 text-slate-600">Only explicitly approved overtime is payable.</p></header>
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]"><section className="rounded-2xl border border-slate-200 p-5"><form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex flex-wrap items-end gap-3"><label className="min-w-40 flex-1 text-sm">Employee ID<input className={field} type="number" min="1" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} /></label><button className={primary} disabled={loading}>{loading ? "Loading…" : "Load overtime"}</button></form>
      {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      <div className="mt-6 space-y-4"><h2 className="text-xl font-semibold">Requests</h2>{rows.length === 0 && !loading && <p className="text-slate-600">No overtime requests loaded.</p>}{rows.map((row) => <article key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex justify-between gap-2"><div><p className="font-semibold">{row.overtimeDate} · {row.overtimeType.replaceAll("_", " ")}</p><p className="text-sm text-slate-600">{row.hours ? `${row.hours} hours` : `${row.dayUnits ?? "0"} day units`} · {row.reason ?? "No reason"}</p></div><span className="h-fit rounded-full bg-white px-3 py-1 text-sm">{row.status}</span></div>{row.status === "pending" && <form onSubmit={(event) => { event.preventDefault(); const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-action") as "approve" | "reject"; if (action) void decide(row.id, action, String(new FormData(event.currentTarget).get("remark") ?? "")); }} className="mt-4 flex flex-wrap items-end gap-2"><label className="text-sm">Decision note<input className={field} name="remark" /></label><button className={primary} data-action="approve" disabled={busy}>Approve</button><button className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50" data-action="reject" disabled={busy}>Reject</button></form>}</article>)}</div></section>
      <form onSubmit={(event) => void submit(event)} className="h-fit space-y-4 rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">New overtime request</h2><label className="block text-sm">Employee ID<input className={field} name="employee_id" type="number" min="1" required /></label><label className="block text-sm">Date<input className={field} name="overtime_date" type="date" required /></label><label className="block text-sm">Type<select className={field} value={type} onChange={(event) => setType(event.target.value as Overtime["overtimeType"])}><option value="hourly">Hourly</option><option value="rest_day">Rest day</option><option value="public_holiday">Public holiday</option></select></label>{type === "hourly" ? <label className="block text-sm">Hours<input className={field} name="hours" type="number" min="0.01" step="0.01" required /></label> : <label className="block text-sm">Day units<input className={field} name="day_units" type="number" min="0.01" step="0.01" required /></label>}<label className="block text-sm">Work-day record ID (if applicable)<input className={field} name="work_day_record_id" type="number" min="1" /></label><label className="block text-sm">Reason<input className={field} name="reason" /></label><button className={primary} disabled={busy}>Submit request</button></form>
    </div></main>;
}
