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
  const [schedules, setSchedules] = useState<BranchSchedule[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [applicable, setApplicable] = useState<ApplicableSchedule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedShop = params.get("shop_id");
    const requestedBranch = params.get("branch_id");
    if (requestedShop && requestedBranch) { setShop(requestedShop); setBranch(requestedBranch); }
  }, []);
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
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
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
  return <div className="space-y-6">
    <section className="workspace-section space-y-4" aria-labelledby="schedule-selection-title">
      <div>
        <h2 id="schedule-selection-title" className="text-xl font-semibold">เลือกสาขาที่ต้องการจัดการ</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">เลือกร้านและสาขา แล้วโหลดข้อมูลเพื่อตรวจตารางที่มีผลวันนี้และรายการที่บันทึกไว้</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void run(load, "โหลดตารางและวันหยุดแล้ว"); }} className="grid items-end gap-3 sm:grid-cols-3">
        <label className="text-sm">ร้าน<select className={field} required value={shop} onChange={(e) => { setShop(e.target.value); setBranch(""); setBranches([]); setSchedules([]); setApplicable(null); setHolidays([]); }}><option value="">เลือกร้าน</option>{shops.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
        <label className="text-sm">สาขา<select className={field} required value={branch} disabled={!shop || branches.length === 0} onChange={(e) => { setBranch(e.target.value); setSchedules([]); setApplicable(null); }}><option value="">เลือกสาขา</option>{branches.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
        <button className={button} disabled={busy}>โหลดตารางและวันหยุด</button>
      </form>
      {message && <p role="status" className="text-sm text-[var(--accent)]">{message}</p>}{error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    </section>

    <section className="workspace-section space-y-5" aria-labelledby="branch-schedule-title">
      <div>
        <h2 id="branch-schedule-title" className="text-xl font-semibold">ตารางเวลาทำงานของสาขา</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">กำหนดเวลาเข้างานและเลิกงานปกติของสาขา รวมถึงวันเริ่มใช้ตาราง</p>
      </div>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4">
        <h3 className="text-sm font-semibold">ตารางปัจจุบันและประวัติ</h3>
        {applicable ? <p className="mt-2 text-sm">ตารางที่มีผลวันนี้: {applicable.kind === "none" ? "ยังไม่มีตารางที่ครอบคลุมวันที่เลือก" : applicable.kind === "override" ? `ตารางเฉพาะวัน #${applicable.override.id}: ${applicable.override.is_closed ? "ปิดสาขา" : `${applicable.override.work_start_time} – ${applicable.override.close_time}`}` : `ตาราง #${applicable.schedule.id}: ${applicable.schedule.work_start_time} – ${applicable.schedule.standard_close_time}`}</p> : <p className="mt-2 text-sm text-[var(--muted)]">เลือกร้านและสาขา แล้วกดโหลดเพื่อดูตาราง</p>}
        {schedules.length > 0 && <ul className="mt-3 space-y-2 border-t border-[var(--line)] pt-3 text-sm">{schedules.map((row) => <li key={row.id}>#{row.id} · {row.effective_from} – {row.effective_to ?? "ไม่กำหนดวันสิ้นสุด"} · {row.work_start_time} – {row.standard_close_time} · อนุโลมมาสาย {row.late_grace_minutes} นาที</li>)}</ul>}
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <form className="space-y-4 rounded-lg border border-[var(--line)] p-5" onSubmit={(e) => save(e, "schedule")}>
          <div><h3 className="font-semibold">เพิ่มหรือเปลี่ยนตารางเวลา</h3><p className="mt-1 text-sm leading-6 text-[var(--muted)]">ใช้กำหนดเวลาทำงานปกติที่มีผลต่อเนื่องตามช่วงวันที่</p></div>
          <label className="block text-sm">ตารางเดิมที่ต้องการเปลี่ยน<select className={field} name="id"><option value="">เพิ่มตารางใหม่</option>{schedules.map((row) => <option key={row.id} value={row.id}>{row.effective_from} ถึง {row.effective_to ?? "ไม่กำหนด"} · {row.work_start_time}–{row.standard_close_time}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2">{input("work_start_time", "เวลาเริ่มงาน", "time")}{input("standard_close_time", "เวลาเลิกงาน", "time")}</div>
          {input("late_grace_minutes", "อนุโลมมาสาย (นาที)", "number")}
          <div className="grid gap-3 sm:grid-cols-2">{input("effective_from", "เริ่มใช้วันที่", "date")}{input("effective_to", "สิ้นสุดวันที่ (ถ้ามี)", "date", false)}</div>
          <button className={button} disabled={busy || !branch}>บันทึกตารางเวลา</button>
        </form>
        <form className="space-y-4 rounded-lg border border-[var(--line)] p-5" onSubmit={(e) => save(e, "override")}>
          <div><h3 className="font-semibold">ตารางเฉพาะวัน</h3><p className="mt-1 text-sm leading-6 text-[var(--muted)]">ใช้เมื่อสาขาปิดหรือเปลี่ยนเวลาทำงานเป็นพิเศษในวันที่ระบุ</p></div>
          {input("schedule_date", "วันที่เปลี่ยนตาราง", "date")}
          <label className="flex items-center gap-2 text-sm"><input name="is_closed" type="checkbox" /> ปิดสาขา</label>
          <div className="grid gap-3 sm:grid-cols-2">{input("work_start_time", "เวลาเริ่มงานเมื่อเปิดสาขา", "time", false)}{input("close_time", "เวลาเลิกงานเมื่อเปิดสาขา", "time", false)}</div>
          {input("reason", "เหตุผล", "text")}
          <button className={button} disabled={busy || !branch}>บันทึกตารางเฉพาะวัน</button>
        </form>
      </div>
    </section>

    {canHoliday && <section className="workspace-section space-y-5" aria-labelledby="public-holidays-title">
      <div><h2 id="public-holidays-title" className="text-xl font-semibold">วันหยุดนักขัตฤกษ์ของร้าน</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">จัดการวันหยุดตามวันที่ของร้าน วันหยุดนี้ใช้ร่วมกับสาขาในร้านที่เลือก</p></div>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4">
        <h3 className="text-sm font-semibold">รายการวันหยุดที่บันทึกไว้</h3>
        {holidays.length ? <ul className="mt-3 space-y-2 text-sm">{holidays.map((row) => <li key={row.id}>#{row.id} · {row.holiday_date} · {row.name} · {row.is_active ? "ใช้งาน" : "ปิดใช้งาน"}</li>)}</ul> : <p className="mt-2 text-sm text-[var(--muted)]">{applicable ? "ยังไม่มีวันหยุดนักขัตฤกษ์ที่บันทึกไว้" : "เลือกร้านและสาขา แล้วกดโหลดเพื่อดูรายการวันหยุด"}</p>}
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <form className="space-y-4 rounded-lg border border-[var(--line)] p-5" onSubmit={(e) => save(e, "holiday")}>
          <div><h3 className="font-semibold">เพิ่มวันหยุดนักขัตฤกษ์</h3><p className="mt-1 text-sm leading-6 text-[var(--muted)]">ระบุวันที่และชื่อวันหยุดที่ต้องการเพิ่ม</p></div>
          {input("holiday_date", "วันที่หยุด", "date")}{input("name", "ชื่อวันหยุด")}
          <button className={button} disabled={busy || !shop || !branch}>เพิ่มวันหยุด</button>
        </form>
        <form className="space-y-4 rounded-lg border border-[var(--line)] p-5" onSubmit={(e) => save(e, "holiday-update")}>
          <div><h3 className="font-semibold">แก้ไขวันหยุดที่มีอยู่</h3><p className="mt-1 text-sm leading-6 text-[var(--muted)]">เลือกวันหยุดเพื่อเปลี่ยนชื่อหรือสถานะการใช้งาน</p></div>
          <label className="block text-sm">วันหยุด<select className={field} name="id" required><option value="">เลือกวันหยุด</option>{holidays.map((row) => <option key={row.id} value={row.id}>{row.holiday_date} · {row.name}</option>)}</select></label>
          {input("name", "ชื่อวันหยุดใหม่")}<label className="flex items-center gap-2 text-sm"><input name="is_active" type="checkbox" defaultChecked /> ใช้งาน</label>
          <button className={button} disabled={busy || !shop || !branch}>บันทึกวันหยุด</button>
        </form>
      </div>
    </section>}
  </div>;
}
