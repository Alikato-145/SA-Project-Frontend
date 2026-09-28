"use client";

import { ScheduleHolidayControls } from "@/lib/operations/operation-controls";
import { useState } from "react";
import { operationsRequest as api, operationError, operationPermissions } from "@/lib/operations/operations-api";
import { useAuthenticatedActor } from "@/components/dashboard-access-guard";

type WorkDay = {
  id: string; employee_id: string; branch_id: string; work_date: string;
  status: string; clock_in_at: string | null; clock_out_at: string | null;
  late_minutes: number; is_deductible: boolean; entry_source: string;
};
const statuses = ["present", "late", "absent", "weekly_holiday", "public_holiday"];

const number = (value: FormDataEntryValue | null) => Number(value ?? 0);
const dateTime = (value: FormDataEntryValue | null) => value ? new Date(String(value)).toISOString() : null;
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900";
const button = "rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50";

export default function AttendancePage() {
  const actor = useAuthenticatedActor();
  const permissions = operationPermissions(actor);
  const [employee_id, setEmployeeId] = useState(permissions.selfOnly ? actor?.account.employee?.id ?? "" : "");
  const [start_date, setStartDate] = useState("");
  const [end_date, setEndDate] = useState("");
  const [records, setRecords] = useState<WorkDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = async (target = employee_id) => {
    if (!target || !start_date || !end_date) { setError("Choose an employee and date range."); return; }
    setLoading(true); setError(""); setRecords([]);
    try {
      const query = new URLSearchParams({ employee_id: target, start_date, end_date });
      setRecords(await api<WorkDay[]>(`/work-day-records?${query}`));
    } catch (cause) { setError(operationError(cause)); }
    finally { setLoading(false); }
  };
  const save = async (event: React.FormEvent<HTMLFormElement>, correction = false) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const payload = correction ? {
        status: form.get("status"), late_minutes: number(form.get("late_minutes")),
        is_deductible: form.get("is_deductible") === "on", note: String(form.get("note") ?? ""),
      } : {
        employee_id: String(form.get("employee_id")), branch_id: String(form.get("branch_id")),
        work_date: form.get("work_date"), status: form.get("status"),
        clock_in_at: dateTime(form.get("clock_in_at")), clock_out_at: dateTime(form.get("clock_out_at")),
        late_minutes: number(form.get("late_minutes")), is_deductible: form.get("is_deductible") === "on",
        note: String(form.get("note") ?? ""),
      };
      const path = correction ? `/work-day-records/${String(form.get("recordId"))}` : "/work-day-records";
      await api(path, { method: correction ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setMessage(correction ? "Correction saved." : "Manual work day saved.");
      if (correction) await load();
      else { const target = String(form.get("employee_id")); setEmployeeId(target); if (start_date && end_date) await load(target); }
    } catch (cause) { setError(operationError(cause)); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 text-slate-900 sm:px-8">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Operations</p><h1 className="text-3xl font-bold">Attendance</h1><p className="mt-2 text-slate-600">Review historical work days and enter manual records.</p></header>
    {permissions.selfOnly && !actor?.account.employee && <p role="alert">This account has no linked employee record. Contact HR to associate your account before using employee operations.</p>}
    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-4">
      <label className="text-sm font-medium">Employee ID<input className={input} type="text" inputMode="numeric" pattern="[1-9][0-9]*" required readOnly={permissions.selfOnly} value={employee_id} onChange={(e) => setEmployeeId(e.target.value)} /></label>
      <label className="text-sm font-medium">From<input className={input} type="date" required value={start_date} onChange={(e) => setStartDate(e.target.value)} /></label>
      <label className="text-sm font-medium">Through<input className={input} type="date" required value={end_date} onChange={(e) => setEndDate(e.target.value)} /></label>
      <button className={`${button} self-end`} disabled={loading}>{loading ? "Loading…" : "Load records"}</button>
    </form>
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}{error.startsWith("Your session") && <a className="ml-2 underline" href="/login">Sign in</a>}</p>}
    <section className="rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Work days</h2><p className="mt-1 text-sm text-slate-600">Approved leave is not deducted from payroll.</p>
      {records.length === 0 && !loading ? <p className="mt-3 text-slate-600">No records loaded for this selection.</p> :
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Date</th><th className="p-2">Branch</th><th className="p-2">Status</th><th className="p-2">Clock in / out</th><th className="p-2">Late</th><th className="p-2">Payroll deduction</th><th className="p-2">Source</th></tr></thead><tbody>{records.map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="p-2">{row.work_date}</td><td className="p-2">{row.branch_id}</td><td className="p-2">{row.status}</td><td className="p-2">{row.clock_in_at ?? "—"} / {row.clock_out_at ?? "—"}</td><td className="p-2">{row.late_minutes} min</td><td className="p-2">{row.status === "leave" ? "No (approved leave)" : row.is_deductible ? "Yes" : "No"}</td><td className="p-2">{row.entry_source}</td></tr>)}</tbody></table></div>}
    </section>
    {permissions.canManage && <div className="grid gap-6 lg:grid-cols-2"><form onSubmit={(event) => void save(event)} className="space-y-3 rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Manual work day</h2>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Employee ID<input className={input} name="employee_id" type="text" inputMode="numeric" pattern="[1-9][0-9]*" defaultValue={employee_id} required /></label><label className="text-sm">Branch ID<input className={input} name="branch_id" type="text" inputMode="numeric" pattern="[1-9][0-9]*" required /></label><label className="text-sm">Work date<input className={input} name="work_date" type="date" required /></label><label className="text-sm">Status<select className={input} name="status">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-sm">Clock in<input className={input} name="clock_in_at" type="datetime-local" /></label><label className="text-sm">Clock out<input className={input} name="clock_out_at" type="datetime-local" /></label><label className="text-sm">Late minutes<input className={input} name="late_minutes" type="number" min="0" defaultValue="0" required /></label><label className="flex items-center gap-2 self-end text-sm"><input name="is_deductible" type="checkbox" /> Deductible</label></div><label className="block text-sm">Note<input className={input} name="note" /></label><button className={button} disabled={busy || (permissions.selfOnly && !actor?.account.employee)}>Save work day</button>
    </form><form onSubmit={(event) => void save(event, true)} className="space-y-3 rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Correct a record</h2><p className="text-sm text-slate-600">Corrections are checked against the payroll lock on the server.</p><label className="block text-sm">Record ID<input className={input} name="recordId" type="text" inputMode="numeric" pattern="[1-9][0-9]*" required /></label><label className="block text-sm">Status<select className={input} name="status">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="block text-sm">Late minutes<input className={input} name="late_minutes" type="number" min="0" defaultValue="0" required /></label><label className="flex items-center gap-2 text-sm"><input name="is_deductible" type="checkbox" /> Deductible</label><label className="block text-sm">Reason / note<input className={input} name="note" required /></label><button className={button} disabled={busy || (permissions.selfOnly && !actor?.account.employee)}>Save correction</button></form></div>}
    {permissions.canManage && <ScheduleHolidayControls canHoliday={permissions.canFinance} />}
  </main>;
}
