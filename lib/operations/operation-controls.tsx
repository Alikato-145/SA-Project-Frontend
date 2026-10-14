"use client";

import { useEffect, useState } from "react";
import { formatThaiDate, thaiLabel } from "@/components/workspace-ui";
import { onboardingApi, type Choice } from "@/features/identity-hr/onboarding/onboarding-api";
import { operationsRequest as api, operationError, type ApplicableSchedule, type BranchSchedule, type Holiday, type DecisionHistory } from "./operations-api";

const field = "workspace-control";
const button = "workspace-primary";
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
  return <div className="mt-3 text-sm"><button className="underline disabled:opacity-50" type="button" disabled={busy} onClick={() => void load()}>{busy ? "กำลังโหลดประวัติ…" : "ดูประวัติการพิจารณา"}</button>
    {error && <p role="alert">{error}</p>}
    {history && <ul className="mt-2 space-y-1">{history.length === 0 && <li>ยังไม่มีการพิจารณา</li>}{history.map((item) => <li key={item.id}>{formatThaiDate(item.acted_at)} {new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", timeStyle: "short" }).format(new Date(item.acted_at))} · {thaiLabel(item.action)} · บัญชี {item.actor_username ?? item.actor_user_account_id}{item.to_leave_type_id && ` · ประเภท ${item.from_leave_type_name ?? item.from_leave_type_id ?? "—"} → ${item.to_leave_type_name ?? item.to_leave_type_id}`}{item.remark && ` · ${item.remark}`}</li>)}</ul>}
  </div>;
}

export function ScheduleHolidayControls({ canHoliday }: { canHoliday: boolean }) {
  const [shops, setShops] = useState<Choice[]>([]);
  const [branches, setBranches] = useState<Choice[]>([]);
  const [branch, setBranch] = useState("");
  const [shop, setShop] = useState("");
  const [date, setDate] = useState("");
  const [schedules, setSchedules] = useState<BranchSchedule[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [applicable, setApplicable] = useState<ApplicableSchedule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void onboardingApi.shops(controller.signal).then(setShops).catch((cause) => {
      if (!controller.signal.aborted) setError(operationError(cause));
    });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!shop) return;
    const controller = new AbortController();
    void onboardingApi.branches(shop, controller.signal).then(setBranches).catch((cause) => {
      if (!controller.signal.aborted) setError(operationError(cause));
    });
    return () => controller.abort();
  }, [shop]);
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
    void run(async () => { await api(path, { method, body: JSON.stringify(payload) }); await load(); }, "บันทึกและโหลดข้อมูลล่าสุดแล้ว");
  };
  const input = (name: string, label: string, type = "text", required = true) => <label className="block text-sm">{label}<input className={field} name={name} type={type} required={required} /></label>;
  return <section className="workspace-section space-y-4"><h2 className="text-xl font-semibold">ตารางเวลาสาขาและวันหยุด</h2>
    <form onSubmit={(e) => { e.preventDefault(); void run(load, "โหลดตารางและวันหยุดแล้ว"); }} className="grid gap-3 sm:grid-cols-4"><label className="text-sm">ร้าน<select className={field} required value={shop} onChange={(e) => { setShop(e.target.value); setBranch(""); setBranches([]); setSchedules([]); setApplicable(null); setHolidays([]); }}><option value="">เลือกร้าน</option>{shops.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label><label className="text-sm">สาขา<select className={field} required value={branch} disabled={!shop || branches.length === 0} onChange={(e) => { setBranch(e.target.value); setSchedules([]); setApplicable(null); }}><option value="">เลือกสาขา</option>{branches.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label><label className="text-sm">วันที่ตรวจตาราง<input className={field} type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label><button className={button} disabled={busy}>โหลดตารางและวันหยุด</button></form>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red-800">{error}</p>}
    {applicable && <p>ตารางที่มีผล: {applicable.kind === "none" ? "ยังไม่มีตารางที่ครอบคลุมวันที่เลือก" : applicable.kind === "override" ? `ตารางเฉพาะวัน #${applicable.override.id}: ${applicable.override.is_closed ? "ปิดสาขา" : `${applicable.override.work_start_time} – ${applicable.override.close_time}`}` : `ตาราง #${applicable.schedule.id}: ${applicable.schedule.work_start_time} – ${applicable.schedule.standard_close_time}`}</p>}
    <ul>{schedules.map((row) => <li key={row.id}>#{row.id} · {row.effective_from} – {row.effective_to ?? "ไม่กำหนดวันสิ้นสุด"} · {row.work_start_time} – {row.standard_close_time} · อนุโลมมาสาย {row.late_grace_minutes} นาที</li>)}</ul>
    <div className="grid gap-5 lg:grid-cols-2"><form className="space-y-3" onSubmit={(e) => save(e, "schedule")}><h3 className="font-semibold">เพิ่มหรือเปลี่ยนตารางเวลา</h3><label className="block text-sm">ตารางเดิมที่ต้องการเปลี่ยน<select className={field} name="id"><option value="">เพิ่มตารางใหม่</option>{schedules.map((row) => <option key={row.id} value={row.id}>{row.effective_from} ถึง {row.effective_to ?? "ไม่กำหนด"} · {row.work_start_time}–{row.standard_close_time}</option>)}</select></label>{input("work_start_time", "เวลาเริ่มงาน", "time")}{input("standard_close_time", "เวลาเลิกงาน", "time")}{input("late_grace_minutes", "อนุโลมมาสาย (นาที)", "number")}{input("effective_from", "เริ่มใช้วันที่", "date")}{input("effective_to", "สิ้นสุดวันที่ (ถ้ามี)", "date", false)}<button className={button} disabled={busy || !branch || !date}>บันทึกตารางเวลา</button></form>
    <form className="space-y-3" onSubmit={(e) => save(e, "override")}><h3 className="font-semibold">ตารางเฉพาะวัน</h3>{input("schedule_date", "วันที่เปลี่ยนตาราง", "date")}<label className="block"><input name="is_closed" type="checkbox" /> ปิดสาขา</label>{input("work_start_time", "เวลาเริ่มงานเมื่อเปิดสาขา", "time", false)}{input("close_time", "เวลาเลิกงานเมื่อเปิดสาขา", "time", false)}{input("reason", "เหตุผล", "text")}<button className={button} disabled={busy || !branch || !date}>บันทึกตารางเฉพาะวัน</button></form></div>
    {canHoliday && <><h3 className="font-semibold">วันหยุดนักขัตฤกษ์ของร้าน</h3><ul>{holidays.map((row) => <li key={row.id}>#{row.id} · {row.holiday_date} · {row.name} · {row.is_active ? "ใช้งาน" : "ปิดใช้งาน"}</li>)}</ul><div className="grid gap-5 lg:grid-cols-2"><form className="space-y-3" onSubmit={(e) => save(e, "holiday")}>{input("holiday_date", "วันที่หยุด", "date")}{input("name", "ชื่อวันหยุด")}<button className={button} disabled={busy || !shop || !branch || !date}>เพิ่มวันหยุด</button></form><form className="space-y-3" onSubmit={(e) => save(e, "holiday-update")}><label className="block text-sm">วันหยุด<select className={field} name="id" required><option value="">เลือกวันหยุด</option>{holidays.map((row) => <option key={row.id} value={row.id}>{row.holiday_date} · {row.name}</option>)}</select></label>{input("name", "ชื่อวันหยุดใหม่")}<label className="block"><input name="is_active" type="checkbox" defaultChecked /> ใช้งาน</label><button className={button} disabled={busy || !shop || !branch || !date}>บันทึกวันหยุด</button></form></div></>}
  </section>;
}
