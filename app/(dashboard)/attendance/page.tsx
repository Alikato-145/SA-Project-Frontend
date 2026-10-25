"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clockLateMinutes } from "@/lib/operations/clock-lateness";
import { authApi, employeeContextFor, type EmployeeContext } from "@/lib/auth/auth-api";
import { EmployeeContextPicker } from "@/components/employee-picker";
import { Feedback, PageHeader, StatusBadge, formatThaiDate, thaiLabel } from "@/components/workspace-ui";
import { operationsApi } from "@/lib/operations/operations-api";

type Context = { branchId: string; branchName: string; applicable: { kind: string; schedule?: { workStartTime: string; standardCloseTime: string; lateGraceMinutes: number }; override?: { workStartTime: string | null; closeTime: string | null; isClosed: boolean } }; weeklyHoliday: boolean; publicHoliday: boolean };
type CalendarDay = { date: string; status: string; branchId: string | null; branchName: string | null; recordId: string | null };
type WorkDay = {
  id: string; employeeId: string; branchId: string; workDate: string;
  status: string; clockInAt: string | null; clockOutAt: string | null;
  lateMinutes: number; isDeductible: boolean; entrySource: string;
};
const statuses = ["present", "late", "absent", "weekly_holiday", "public_holiday"];
const api = operationsApi.request;
const number = (value: FormDataEntryValue | null) => Number(value ?? 0);
const dateTime = (value: FormDataEntryValue | null) => value ? new Date(`${String(value)}+07:00`).toISOString() : null;
const input = "workspace-control";
const button = "workspace-primary";

export default function AttendancePage() {
  const [employeeId, setEmployeeId] = useState("");
  const [employeeContext, setEmployeeContext] = useState<EmployeeContext | null | undefined>(undefined);
  const selfOnly = employeeContext?.mode === "self";
  const availableStatuses = selfOnly ? statuses.filter(status => ["present", "late", "absent"].includes(status)) : statuses;
  const [entryStatus, setEntryStatus] = useState("present");
  const [correctionStatus, setCorrectionStatus] = useState("present");
  const entryForm = useRef<HTMLFormElement>(null);
  const [correctionId, setCorrectionId] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [context, setContext] = useState<Context | null>(null);
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [records, setRecords] = useState<WorkDay[]>([]);
  const correction = records.find((row) => row.id === correctionId);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    void authApi.current(abort.signal).then(actor => {
      if (abort.signal.aborted) return;
      const value = employeeContextFor(actor);
      setEmployeeContext(value);
      if (value.mode === "self") setEmployeeId(value.employee.id);
    }).catch(cause => { if (!abort.signal.aborted) { setEmployeeContext(null); setError(cause.message); } });
    return () => abort.abort();
  }, []);
  const applyClock = useCallback((form: HTMLFormElement | null, value: Context, setStatus: (status: string) => void) => {
    if (!form?.isConnected) return;
    const clock = form.elements.namedItem("clockInAt") as HTMLInputElement;
    const minutes = form.elements.namedItem("lateMinutes") as HTMLInputElement;
    const status = form.elements.namedItem("status") as HTMLSelectElement;
    if (!["present", "late"].includes(status.value)) { minutes.value = "0"; minutes.readOnly = true; return; }
    const start = value.applicable.kind === "schedule" ? value.applicable.schedule?.workStartTime : value.applicable.override?.workStartTime;
    const grace = value.applicable.kind === "schedule" ? value.applicable.schedule?.lateGraceMinutes ?? 0 : 0;
    const late = clockLateMinutes(clock.value, start, grace);
    minutes.readOnly = selfOnly || late !== null;
    if (late !== null) { minutes.value = String(late); setStatus(late > 0 ? "late" : "present"); }
  }, [selfOnly]);
  const correctClock = (form: HTMLFormElement, clock: string) => {
    if (!correction) return;
    void api<Context>(`/work-day-records/context?employee_id=${encodeURIComponent(correction.employeeId)}&work_date=${correction.workDate}`).then(value => {
      if (form.isConnected && (form.elements.namedItem("clockInAt") as HTMLInputElement).value === clock) applyClock(form, value, setCorrectionStatus);
    }).catch(cause => setError(cause.message));
  };
  useEffect(() => {
    if (!employeeId || !workDate) return;
    const abort = new AbortController();
    void api<Context>(`/work-day-records/context?employee_id=${encodeURIComponent(employeeId)}&work_date=${workDate}`, { signal: abort.signal }).then((value) => { if (abort.signal.aborted) return; setContext(value); if (entryForm.current?.dataset.employeeId === employeeId) applyClock(entryForm.current, value, setEntryStatus); }).catch((cause) => { if (!abort.signal.aborted) { setContext(null); setError(cause.message); } });
    return () => abort.abort();
  }, [employeeId, workDate, applyClock]);
  const load = async () => {
    if (!employeeId || !startDate || !endDate) { setError("เลือกพนักงานและช่วงวันที่ก่อนโหลดข้อมูล"); return; }
    setLoading(true); setError(""); setRecords([]); setCalendar([]);
    try {
      const query = new URLSearchParams({ employee_id: employeeId, start_date: startDate, end_date: endDate });
      const [loaded, days] = await Promise.all([api<WorkDay[]>(`/work-day-records?${query}`), api<CalendarDay[]>(`/work-day-records/calendar?${query}`)]);
      setRecords(loaded); setCalendar(days);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดข้อมูลการลงเวลาทำงานได้"); }
    finally { setLoading(false); }
  };
  const save = async (event: React.FormEvent<HTMLFormElement>, correction = false) => {
    event.preventDefault();
    if (!correction && !employeeId) { setError("เลือกพนักงานก่อนบันทึกรายการ"); return; }
    setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const payload = correction ? {
        status: form.get("status"), late_minutes: number(form.get("lateMinutes")),
        clock_in_at: dateTime(form.get("clockInAt")), clock_out_at: dateTime(form.get("clockOutAt")),
        is_deductible: ["late", "absent"].includes(String(form.get("status"))), note: String(form.get("note") ?? ""),
      } : {
        employee_id: employeeId, branch_id: context?.branchId,
        work_date: form.get("workDate"), status: form.get("status"),
        clock_in_at: dateTime(form.get("clockInAt")), clock_out_at: dateTime(form.get("clockOutAt")),
        late_minutes: number(form.get("lateMinutes")), is_deductible: ["late", "absent"].includes(String(form.get("status"))),
        note: String(form.get("note") ?? ""),
      };
      const path = correction ? `/work-day-records/${String(form.get("recordId"))}` : "/work-day-records";
      await api(path, { method: correction ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setMessage(correction ? "บันทึกการแก้ไขแล้ว" : "บันทึกวันทำงานแล้ว");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกข้อมูลการลงเวลาทำงานได้"); }
    finally { setBusy(false); }
  };
  return <div className="space-y-7">
    <PageHeader title="การลงเวลาทำงาน" description={selfOnly ? "บันทึกและแก้ไขเวลาทำงานของคุณตามตารางและสาขาที่มีผลในวันนั้น" : "ค้นหา ตรวจสอบ และบันทึกวันทำงานของพนักงานในขอบเขตที่คุณดูแล"} />
    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="workspace-filter grid gap-4 sm:grid-cols-4">
      <EmployeeContextPicker context={employeeContext} selfLabel="ข้อมูลเวลาทำงานของคุณ" className={input} value={employeeId} onChange={(id) => { setEntryStatus("present"); setEmployeeId(id); setContext(null); setRecords([]); setCalendar([]); }} />
      <label className="text-sm font-medium">ตั้งแต่<input className={input} type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
      <label className="text-sm font-medium">ถึง<input className={input} type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
      <button className={`${button} self-end`} disabled={loading}>{loading ? "กำลังโหลด…" : "โหลดรายการ"}</button>
    </form>
    <div className="space-y-3">{message ? <Feedback kind="success" detail={message} /> : null}{error ? <Feedback kind="error" title="ทำรายการไม่สำเร็จ" detail={error} /> : null}</div>
    {calendar.length > 0 && <section className="workspace-section"><h2 className="text-xl font-semibold">ความครบถ้วนรายวัน</h2><p className="mt-2 text-sm text-[var(--muted)]">ช่องที่ยังไม่มีข้อมูลไม่ถือเป็นการขาดงาน ระบบจะไม่เติมสถานะให้เอง</p><ul className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">{calendar.map((day) => <li key={day.date}><button className={`w-full border p-3 text-left text-sm ${["missing", "schedule_missing"].includes(day.status) ? "border-amber-400 bg-amber-50" : "border-[var(--line)]"}`} type="button" onClick={() => { setEntryStatus("present"); setWorkDate(day.date); setContext(null); requestAnimationFrame(() => entryForm.current?.querySelector<HTMLInputElement>("input[name=workDate]")?.focus()); }}><strong>{formatThaiDate(day.date)}</strong><span className="block">{day.status === "missing" ? "ยังไม่มีข้อมูล" : day.status === "schedule_missing" ? "ยังไม่มีตารางสาขา" : day.status === "not_employed" ? "นอกช่วงการจ้าง" : thaiLabel(day.status)}</span><span className="block text-xs text-[var(--muted)]">{day.branchName}</span></button></li>)}</ul></section>}
    <section className="workspace-section"><h2 className="text-xl font-semibold">วันทำงาน</h2>
      {records.length === 0 && !loading ? <div className="mt-3"><Feedback kind="empty" detail="ไม่พบรายการในช่วงวันที่ที่เลือก ลองเปลี่ยนช่วงวันหรือพนักงานแล้วโหลดใหม่" /></div> :
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b text-[var(--muted)]"><th className="p-2">วันที่</th><th className="p-2">สาขา</th><th className="p-2">สถานะ</th><th className="p-2">เวลาเข้างาน / ออกงาน</th><th className="p-2">มาสาย</th><th className="p-2">หักเงิน</th><th className="p-2">แหล่งที่มา</th></tr></thead><tbody>{records.map((row) => <tr key={row.id} className="border-b border-[var(--line)] last:border-0"><td className="p-2">{formatThaiDate(row.workDate)}</td><td className="p-2">{calendar.find((day) => day.date === row.workDate)?.branchName ?? "สาขาตามประวัติ"}</td><td className="p-2"><StatusBadge value={row.status} /></td><td className="p-2">{row.clockInAt ?? "ไม่ระบุ"} / {row.clockOutAt ?? "ไม่ระบุ"}</td><td className="p-2">{row.lateMinutes} นาที</td><td className="p-2">{row.isDeductible ? "หักเงิน" : "ไม่หักเงิน"}</td><td className="p-2">{thaiLabel(row.entrySource)}</td></tr>)}</tbody></table></div>}
    </section>
    <div className="grid gap-6 lg:grid-cols-2"><form key={`${employeeId}-${workDate}`} ref={entryForm} data-employee-id={employeeId} onSubmit={(event) => void save(event)} className="workspace-section space-y-4"><h2 className="text-xl font-semibold">บันทึกวันทำงาน</h2><p className="text-sm text-[var(--muted)]">{selfOnly ? "บันทึกวันทำงานปกติพร้อมเวลาเข้าจริง ระบบคำนวณนาทีมาสายตามตาราง หากขาดงานให้เว้นเวลาเข้าและออก วันลาและข้อยกเว้นวันหยุดให้ติดต่อผู้ดูแล" : "วันหยุดที่ไม่ได้ทำงานให้เลือกสถานะวันหยุด หากทำงานจริงให้เลือกมาทำงานหรือมาสาย และส่งคำขอ OT เพื่อพิจารณาแยกกัน"}</p>
      <div className="grid gap-4 sm:grid-cols-2"><p className="text-sm text-[var(--muted)] sm:col-span-2">{selfOnly ? "ใช้ข้อมูลพนักงานที่เชื่อมกับบัญชีของคุณ" : "ใช้พนักงานที่เลือกด้านบนสำหรับรายการนี้"}</p><label className="text-sm">วันที่ทำงาน<input className={input} name="workDate" type="date" value={workDate} onChange={(event) => { setEntryStatus("present"); setWorkDate(event.target.value); setContext(null); }} required /></label><label className="text-sm">สาขาตามประวัติการจ้าง<input className={input} value={context?.branchName ?? "เลือกพนักงานและวันที่ก่อน"} readOnly /></label>{context && <p className="text-sm text-[var(--muted)] sm:col-span-2">{context.applicable.kind === "none" ? "ยังไม่มีตารางสาขาที่มีผล ให้ตั้งตารางก่อนลงเวลา" : context.weeklyHoliday ? "วันหยุดประจำสัปดาห์" : context.publicHoliday ? "วันหยุดนักขัตฤกษ์" : `ตารางที่มีผล: ${context.applicable.schedule?.workStartTime ?? context.applicable.override?.workStartTime} ถึง ${context.applicable.schedule?.standardCloseTime ?? context.applicable.override?.closeTime} · ผ่อนผัน ${context.applicable.schedule?.lateGraceMinutes ?? 0} นาที`} · เวลาใช้เขต Asia/Bangkok</p>}<label className="text-sm">สถานะ<select className={input} name="status" value={entryStatus} onChange={event => { setEntryStatus(event.target.value); const minutes = event.currentTarget.form?.elements.namedItem("lateMinutes") as HTMLInputElement; if (minutes) { minutes.value = "0"; minutes.readOnly = selfOnly; } }}>{availableStatuses.map((status) => <option key={status} value={status}>{thaiLabel(status)}</option>)}</select></label><label className="text-sm">เวลาเข้างาน<input className={input} name="clockInAt" type="datetime-local" required={selfOnly && ["present", "late"].includes(entryStatus)} onChange={event => { if (context) applyClock(event.currentTarget.form, context, setEntryStatus); }} /></label><label className="text-sm">เวลาออกงาน<input className={input} name="clockOutAt" type="datetime-local" /></label><label className="text-sm">นาทีที่มาสาย<input className={input} name="lateMinutes" readOnly={selfOnly} type="number" min="0" max="1440" defaultValue="0" required /></label><label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" checked={["late", "absent"].includes(entryStatus)} disabled /> หักเงิน</label></div><label className="block text-sm">หมายเหตุ<input className={input} name="note" /></label><button className={button} disabled={busy || !employeeId || !context || context.applicable.kind === "none" || (selfOnly && (context.weeklyHoliday || context.publicHoliday || (context.applicable.kind === "override" && Boolean(context.applicable.override?.isClosed))))}>บันทึกวันทำงาน</button>
    </form><form key={correctionId} onSubmit={(event) => void save(event, true)} className="workspace-section space-y-4"><h2 className="text-xl font-semibold">แก้ไขรายการ</h2><p className="text-sm leading-6 text-[var(--muted)]">เลือกรายการจากผลค้นหาด้านบน ระบบจะตรวจสอบการล็อกรอบเงินเดือนก่อนแก้ไข</p><label className="block text-sm">รายการวันทำงาน<select className={input} name="recordId" value={correctionId} onChange={(event) => { setCorrectionId(event.target.value); setCorrectionStatus(records.find(row => row.id === event.target.value)?.status ?? "present"); }} required disabled={records.length === 0}><option value="">{records.length ? "เลือกรายการที่ต้องการแก้ไข" : "โหลดรายการก่อน"}</option>{records.map((row) => <option key={row.id} value={row.id} disabled={selfOnly && (row.entrySource !== "manual" || !["present", "late", "absent"].includes(row.status))}>{formatThaiDate(row.workDate)} · {thaiLabel(row.status)} · {calendar.find((day) => day.date === row.workDate)?.branchName ?? "สาขาตามประวัติ"}</option>)}</select></label><label className="block text-sm">สถานะ<select className={input} name="status" value={correctionStatus} disabled={correction?.status === "leave"} onChange={event => { setCorrectionStatus(event.target.value); const minutes = event.currentTarget.form?.elements.namedItem("lateMinutes") as HTMLInputElement; if (minutes) { minutes.value = "0"; minutes.readOnly = selfOnly; } }}>{(correction?.status === "leave" ? ["leave", ...availableStatuses] : availableStatuses).map((status) => <option key={status} value={status}>{thaiLabel(status)}</option>)}</select></label><label className="block text-sm">นาทีที่มาสาย<input className={input} name="lateMinutes" readOnly={selfOnly} type="number" min="0" max="1440" defaultValue={correction?.lateMinutes ?? 0} required /></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={["late", "absent"].includes(correctionStatus)} disabled /> หักเงิน</label><label className="block text-sm">เวลาเข้างาน (Asia/Bangkok)<input className={input} name="clockInAt" type="datetime-local" onChange={event => { if (event.currentTarget.form) correctClock(event.currentTarget.form, event.currentTarget.value); }} defaultValue={correction?.clockInAt ? new Date(new Date(correction.clockInAt).valueOf() + 7 * 3600000).toISOString().slice(0, 16) : ""} /></label><label className="block text-sm">เวลาออกงาน (Asia/Bangkok)<input className={input} name="clockOutAt" type="datetime-local" defaultValue={correction?.clockOutAt ? new Date(new Date(correction.clockOutAt).valueOf() + 7 * 3600000).toISOString().slice(0, 16) : ""} /></label><label className="block text-sm">เหตุผล / หมายเหตุ<input className={input} name="note" minLength={selfOnly ? 5 : undefined} maxLength={1000} required /></label><button className={button} disabled={busy || !correction || correction.status === "leave" || (selfOnly && (correction.entrySource !== "manual" || !["present", "late", "absent"].includes(correction.status)))}>บันทึกการแก้ไข</button></form></div>
  </div>;
}
