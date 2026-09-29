"use client";

import { useState } from "react";
import { EmployeePicker } from "@/components/employee-picker";
import { Feedback, PageHeader, StatusBadge, formatThaiDate, thaiLabel } from "@/components/workspace-ui";
import { operationsApi } from "@/lib/operations/operations-api";

type WorkDay = {
  id: string; employeeId: string; branchId: string; workDate: string;
  status: string; clockInAt: string | null; clockOutAt: string | null;
  lateMinutes: number; isDeductible: boolean; entrySource: string;
};
const statuses = ["present", "late", "absent", "weekly_holiday", "public_holiday"];
const api = operationsApi.request;
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
    if (!employeeId || !startDate || !endDate) { setError("เลือกพนักงานและช่วงวันที่ก่อนโหลดข้อมูล"); return; }
    setLoading(true); setError(""); setRecords([]);
    try {
      const query = new URLSearchParams({ employee_id: employeeId, start_date: startDate, end_date: endDate });
      setRecords(await api<WorkDay[]>(`/work-day-records?${query}`));
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
        is_deductible: form.get("isDeductible") === "on", note: String(form.get("note") ?? ""),
      } : {
        employee_id: employeeId, branch_id: String(form.get("branchId")),
        work_date: form.get("workDate"), status: form.get("status"),
        clock_in_at: dateTime(form.get("clockInAt")), clock_out_at: dateTime(form.get("clockOutAt")),
        late_minutes: number(form.get("lateMinutes")), is_deductible: form.get("isDeductible") === "on",
        note: String(form.get("note") ?? ""),
      };
      const path = correction ? `/work-day-records/${String(form.get("recordId"))}` : "/work-day-records";
      await api(path, { method: correction ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setMessage(correction ? "บันทึกการแก้ไขแล้ว" : "บันทึกวันทำงานแล้ว");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกข้อมูลการลงเวลาทำงานได้"); }
    finally { setBusy(false); }
  };
  return <div className="space-y-8">
    <PageHeader title="การลงเวลาทำงาน" description="ค้นหา ตรวจสอบ และบันทึกวันทำงานของพนักงานในขอบเขตที่คุณดูแล" />
    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-4">
      <label className="text-sm font-medium">พนักงาน<EmployeePicker className={input} required value={employeeId} onChange={setEmployeeId} /></label>
      <label className="text-sm font-medium">ตั้งแต่<input className={input} type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
      <label className="text-sm font-medium">ถึง<input className={input} type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
      <button className={`${button} self-end`} disabled={loading}>{loading ? "กำลังโหลด…" : "โหลดรายการ"}</button>
    </form>
    <div className="space-y-3">{message ? <Feedback kind="success" detail={message} /> : null}{error ? <Feedback kind="error" title="ทำรายการไม่สำเร็จ" detail={error} /> : null}</div>
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">วันทำงาน</h2>
      {records.length === 0 && !loading ? <div className="mt-3"><Feedback kind="empty" detail="ไม่พบรายการในช่วงวันที่ที่เลือก ลองเปลี่ยนช่วงวันหรือพนักงานแล้วโหลดใหม่" /></div> :
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b text-[var(--muted)]"><th className="p-2">วันที่</th><th className="p-2">สาขา</th><th className="p-2">สถานะ</th><th className="p-2">เวลาเข้างาน / ออกงาน</th><th className="p-2">มาสาย</th><th className="p-2">หักเงิน</th><th className="p-2">แหล่งที่มา</th></tr></thead><tbody>{records.map((row) => <tr key={row.id} className="border-b border-[var(--line)]"><td className="p-2">{formatThaiDate(row.workDate)}</td><td className="p-2">สาขา #{row.branchId}</td><td className="p-2"><StatusBadge value={row.status} /></td><td className="p-2">{row.clockInAt ?? "—"} / {row.clockOutAt ?? "—"}</td><td className="p-2">{row.lateMinutes} นาที</td><td className="p-2">{row.isDeductible ? "หักเงิน" : "ไม่หักเงิน"}</td><td className="p-2">{thaiLabel(row.entrySource)}</td></tr>)}</tbody></table></div>}
    </section>
    <div className="grid gap-6 lg:grid-cols-2"><form onSubmit={(event) => void save(event)} className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">บันทึกวันทำงาน</h2>
      <div className="grid gap-3 sm:grid-cols-2"><p className="text-sm text-slate-600 sm:col-span-2">ใช้พนักงานที่เลือกด้านบนสำหรับรายการนี้</p><label className="text-sm">รหัสสาขา<input className={input} name="branchId" type="number" min="1" required /></label><label className="text-sm">วันที่ทำงาน<input className={input} name="workDate" type="date" required /></label><label className="text-sm">สถานะ<select className={input} name="status">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-sm">เวลาเข้างาน<input className={input} name="clockInAt" type="datetime-local" /></label><label className="text-sm">เวลาออกงาน<input className={input} name="clockOutAt" type="datetime-local" /></label><label className="text-sm">นาทีที่มาสาย<input className={input} name="lateMinutes" type="number" min="0" defaultValue="0" required /></label><label className="flex items-center gap-2 self-end text-sm"><input name="isDeductible" type="checkbox" /> หักเงิน</label></div><label className="block text-sm">หมายเหตุ<input className={input} name="note" /></label><button className={button} disabled={busy || !employeeId}>บันทึกวันทำงาน</button>
    </form><form onSubmit={(event) => void save(event, true)} className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">แก้ไขรายการ</h2><p className="text-sm leading-6 text-[var(--muted)]">เลือกรายการจากผลค้นหาด้านบน ระบบจะตรวจสอบการล็อกรอบเงินเดือนก่อนแก้ไข</p><label className="block text-sm">รายการวันทำงาน<select className={input} name="recordId" required disabled={records.length === 0}><option value="">{records.length ? "เลือกรายการที่ต้องการแก้ไข" : "โหลดรายการก่อน"}</option>{records.map((row) => <option key={row.id} value={row.id}>{formatThaiDate(row.workDate)} · {thaiLabel(row.status)} · สาขา #{row.branchId}</option>)}</select></label><label className="block text-sm">สถานะ<select className={input} name="status">{statuses.map((status) => <option key={status} value={status}>{thaiLabel(status)}</option>)}</select></label><label className="block text-sm">นาทีที่มาสาย<input className={input} name="lateMinutes" type="number" min="0" defaultValue="0" required /></label><label className="flex items-center gap-2 text-sm"><input name="isDeductible" type="checkbox" /> หักเงิน</label><label className="block text-sm">เหตุผล / หมายเหตุ<input className={input} name="note" required /></label><button className={button} disabled={busy || records.length === 0}>บันทึกการแก้ไข</button></form></div>
  </div>;
}
