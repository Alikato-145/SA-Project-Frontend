"use client";

import { useState } from "react";
import { operationsRequest as api, operationError, type ApplicableSchedule, type BranchSchedule, type Holiday, type DecisionHistory } from "./operations-api";

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const button = "rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50";
const text = (form: FormData, name: string) => String(form.get(name) ?? "");

export function DecisionHistoryView({ path }: { path: string }) {
  const [history, setHistory] = useState<DecisionHistory[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try { setHistory(await api<DecisionHistory[]>(path)); }
    catch (cause) { setError(operationError(cause)); }
    finally { setBusy(false); }
  };
  return <div className="mt-3 text-sm"><button className="underline disabled:opacity-50" type="button" disabled={busy} onClick={() => void load()}>{busy ? "Loading history…" : "Review decision history"}</button>
    {error && <p role="alert">{error}</p>}
    {history && <ul className="mt-2 space-y-1">{history.length === 0 && <li>No decisions recorded.</li>}{history.map((item) => <li key={item.id}>{item.acted_at} · {item.action} · Account {item.actor_user_account_id}{item.to_leave_type_id && ` · Type ${item.from_leave_type_id ?? "—"} → ${item.to_leave_type_id}`}{item.remark && ` · ${item.remark}`}</li>)}</ul>}
  </div>;
}

export function ScheduleHolidayControls({ canHoliday }: { canHoliday: boolean }) {
  const [branch, setBranch] = useState("");
  const [shop, setShop] = useState("");
  const [date, setDate] = useState("");
  const [schedules, setSchedules] = useState<BranchSchedule[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [applicable, setApplicable] = useState<ApplicableSchedule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    const results = await Promise.allSettled([
      api<BranchSchedule[]>(`/branch-schedules?branch_id=${encodeURIComponent(branch)}`),
      api<ApplicableSchedule>(`/branch-schedules/applicable?branch_id=${encodeURIComponent(branch)}&work_date=${date}`),
      ...(canHoliday && shop ? [api<Holiday[]>(`/holiday-calendars?shop_id=${encodeURIComponent(shop)}`)] : []),
    ]);
    if (results[0].status === "fulfilled") setSchedules(results[0].value as BranchSchedule[]);
    if (results[1].status === "fulfilled") setApplicable(results[1].value as ApplicableSchedule);
    if (results[2]?.status === "fulfilled") setHolidays(results[2].value as Holiday[]);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  };
  const run = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); setMessage(success); }
    catch (cause) { setError(operationError(cause)); }
    finally { setBusy(false); }
  };
  const save = (event: React.FormEvent<HTMLFormElement>, kind: "schedule" | "override" | "holiday" | "holiday-update") => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let path = "/branch-schedules"; let method = "POST"; let payload: object;
    if (kind === "schedule") {
      const id = text(form, "id"); if (id) { path += `/${encodeURIComponent(id)}`; method = "PATCH"; }
      payload = { ...(id ? {} : { branch_id: branch }), work_start_time: text(form, "work_start_time"), standard_close_time: text(form, "standard_close_time"), late_grace_minutes: Number(text(form, "late_grace_minutes")), effective_from: text(form, "effective_from"), effective_to: text(form, "effective_to") || null };
    } else if (kind === "override") {
      path = `/branch-schedules/${encodeURIComponent(branch)}/overrides/${text(form, "schedule_date")}`; method = "PUT";
      const closed = form.get("is_closed") === "on";
      payload = { is_closed: closed, work_start_time: closed ? null : text(form, "work_start_time") || null, close_time: closed ? null : text(form, "close_time") || null, reason: text(form, "reason") || null };
    } else if (kind === "holiday") {
      path = "/holiday-calendars"; payload = { shop_id: shop, holiday_date: text(form, "holiday_date"), name: text(form, "name") };
    } else {
      path = `/holiday-calendars/${encodeURIComponent(text(form, "id"))}`; method = "PATCH";
      payload = { name: text(form, "name"), is_active: form.get("is_active") === "on" };
    }
    void run(async () => { await api(path, { method, body: JSON.stringify(payload) }); await load(); }, "Change saved and reloaded.");
  };
  const input = (name: string, label: string, type = "text", required = true) => <label className="block text-sm">{label}<input className={field} name={name} type={type} required={required} /></label>;
  return <section className="space-y-4 rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Schedules and holidays</h2>
    <form onSubmit={(e) => { e.preventDefault(); void run(load, "Working arrangements loaded."); }} className="grid gap-3 sm:grid-cols-4"><label className="text-sm">Branch ID<input className={field} pattern="[1-9][0-9]*" required value={branch} onChange={(e) => setBranch(e.target.value)} /></label>{canHoliday && <label className="text-sm">Shop ID<input className={field} pattern="[1-9][0-9]*" required value={shop} onChange={(e) => setShop(e.target.value)} /></label>}<label className="text-sm">Applicable work date<input className={field} type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label><button className={button} disabled={busy}>Load arrangements</button></form>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red-800">{error}</p>}
    {applicable && <p>Applicable: {applicable.kind === "none" ? "No schedule" : applicable.kind === "override" ? `Override #${applicable.override.id}: ${applicable.override.is_closed ? "Closed" : `${applicable.override.work_start_time} – ${applicable.override.close_time}`}` : `Schedule #${applicable.schedule.id}: ${applicable.schedule.work_start_time} – ${applicable.schedule.standard_close_time}`}</p>}
    <ul>{schedules.map((row) => <li key={row.id}>#{row.id} · {row.effective_from} – {row.effective_to ?? "ongoing"} · {row.work_start_time} – {row.standard_close_time} · Grace {row.late_grace_minutes} min</li>)}</ul>
    <div className="grid gap-5 lg:grid-cols-2"><form className="space-y-3" onSubmit={(e) => save(e, "schedule")}><h3 className="font-semibold">New schedule or successor</h3>{input("id", "Prior schedule ID (optional)", "text", false)}{input("work_start_time", "Start time", "time")}{input("standard_close_time", "Close time", "time")}{input("late_grace_minutes", "Grace minutes", "number")}{input("effective_from", "Effective from", "date")}{input("effective_to", "Effective through (optional)", "date", false)}<button className={button} disabled={busy || !branch || !date}>Save schedule</button></form>
    <form className="space-y-3" onSubmit={(e) => save(e, "override")}><h3 className="font-semibold">Date override</h3>{input("schedule_date", "Override date", "date")}<label className="block"><input name="is_closed" type="checkbox" /> Closed</label>{input("work_start_time", "Start time (open day)", "time", false)}{input("close_time", "Close time (open day)", "time", false)}{input("reason", "Reason", "text")}<button className={button} disabled={busy || !branch || !date}>Save override</button></form></div>
    {canHoliday && <><h3 className="font-semibold">Shop holidays</h3><ul>{holidays.map((row) => <li key={row.id}>#{row.id} · {row.holiday_date} · {row.name} · {row.is_active ? "Active" : "Inactive"}</li>)}</ul><div className="grid gap-5 lg:grid-cols-2"><form className="space-y-3" onSubmit={(e) => save(e, "holiday")}>{input("holiday_date", "Holiday date", "date")}{input("name", "Holiday name")}<button className={button} disabled={busy || !shop || !branch || !date}>Add holiday</button></form><form className="space-y-3" onSubmit={(e) => save(e, "holiday-update")}>{input("id", "Holiday ID")}{input("name", "Updated name")}<label className="block"><input name="is_active" type="checkbox" defaultChecked /> Active</label><button className={button} disabled={busy || !shop || !branch || !date}>Update holiday</button></form></div></>}
  </section>;
}
