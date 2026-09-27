"use client";

import { useState } from "react";

type WorkDay = {
  id: number; employeeId: number; branchId: number; workDate: string;
  status: string; clockInAt: string | null; clockOutAt: string | null;
  lateMinutes: number; isDeductible: boolean; entrySource: string;
};
const statuses = ["present", "late", "absent", "weekly_holiday", "public_holiday"];
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: "same-origin", ...init,
    headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message ?? data?.code ?? `Request failed (${response.status})`);
  return data as T;
}
const number = (value: FormDataEntryValue | null) => Number(value ?? 0);
const dateTime = (value: FormDataEntryValue | null) => value ? new Date(String(value)).toISOString() : null;
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900";
const button = "rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50";

export default function AttendancePage() {
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [records, setRecords] = useState<WorkDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = async () => {
    if (!employeeId || !startDate || !endDate) { setError("Choose an employee and date range."); return; }
    setLoading(true); setError(""); setRecords([]);
    try {
      const query = new URLSearchParams({ employeeId, startDate, endDate });
      setRecords(await api<WorkDay[]>(`/work-day-records?${query}`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load attendance."); }
    finally { setLoading(false); }
  };
  const save = async (event: React.FormEvent<HTMLFormElement>, correction = false) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const payload = correction ? {
        status: form.get("status"), lateMinutes: number(form.get("lateMinutes")),
        isDeductible: form.get("isDeductible") === "on", note: String(form.get("note") ?? ""),
      } : {
        employeeId: number(form.get("employeeId")), branchId: number(form.get("branchId")),
        workDate: form.get("workDate"), status: form.get("status"),
        clockInAt: dateTime(form.get("clockInAt")), clockOutAt: dateTime(form.get("clockOutAt")),
        lateMinutes: number(form.get("lateMinutes")), isDeductible: form.get("isDeductible") === "on",
        note: String(form.get("note") ?? ""),
      };
      const path = correction ? `/work-day-records/${number(form.get("recordId"))}` : "/work-day-records";
      await api(path, { method: correction ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setMessage(correction ? "Correction saved." : "Manual work day saved.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save attendance."); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 text-slate-900 sm:px-8">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Operations</p><h1 className="text-3xl font-bold">Attendance</h1><p className="mt-2 text-slate-600">Review historical work days and enter manual records.</p></header>
    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-4">
      <label className="text-sm font-medium">Employee ID<input className={input} type="number" min="1" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} /></label>
      <label className="text-sm font-medium">From<input className={input} type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
      <label className="text-sm font-medium">Through<input className={input} type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
      <button className={`${button} self-end`} disabled={loading}>{loading ? "Loading…" : "Load records"}</button>
    </form>
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    <section className="rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Work days</h2>
      {records.length === 0 && !loading ? <p className="mt-3 text-slate-600">No records loaded for this selection.</p> :
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Date</th><th className="p-2">Branch</th><th className="p-2">Status</th><th className="p-2">Clock in / out</th><th className="p-2">Late</th><th className="p-2">Deduction</th><th className="p-2">Source</th></tr></thead><tbody>{records.map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="p-2">{row.workDate}</td><td className="p-2">{row.branchId}</td><td className="p-2">{row.status}</td><td className="p-2">{row.clockInAt ?? "—"} / {row.clockOutAt ?? "—"}</td><td className="p-2">{row.lateMinutes} min</td><td className="p-2">{row.isDeductible ? "Yes" : "No"}</td><td className="p-2">{row.entrySource}</td></tr>)}</tbody></table></div>}
    </section>
    <div className="grid gap-6 lg:grid-cols-2"><form onSubmit={(event) => void save(event)} className="space-y-3 rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Manual work day</h2>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Employee ID<input className={input} name="employeeId" type="number" min="1" defaultValue={employeeId} required /></label><label className="text-sm">Branch ID<input className={input} name="branchId" type="number" min="1" required /></label><label className="text-sm">Work date<input className={input} name="workDate" type="date" required /></label><label className="text-sm">Status<select className={input} name="status">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-sm">Clock in<input className={input} name="clockInAt" type="datetime-local" /></label><label className="text-sm">Clock out<input className={input} name="clockOutAt" type="datetime-local" /></label><label className="text-sm">Late minutes<input className={input} name="lateMinutes" type="number" min="0" defaultValue="0" required /></label><label className="flex items-center gap-2 self-end text-sm"><input name="isDeductible" type="checkbox" /> Deductible</label></div><label className="block text-sm">Note<input className={input} name="note" /></label><button className={button} disabled={busy}>Save work day</button>
    </form><form onSubmit={(event) => void save(event, true)} className="space-y-3 rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Correct a record</h2><p className="text-sm text-slate-600">Corrections are checked against the payroll lock on the server.</p><label className="block text-sm">Record ID<input className={input} name="recordId" type="number" min="1" required /></label><label className="block text-sm">Status<select className={input} name="status">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="block text-sm">Late minutes<input className={input} name="lateMinutes" type="number" min="0" defaultValue="0" required /></label><label className="flex items-center gap-2 text-sm"><input name="isDeductible" type="checkbox" /> Deductible</label><label className="block text-sm">Reason / note<input className={input} name="note" required /></label><button className={button} disabled={busy}>Save correction</button></form></div>
  </main>;
}
