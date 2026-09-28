"use client";

import { useState } from "react";
import { EmployeePicker } from "@/components/employee-picker";
import { operationsApi } from "@/lib/operations/operations-api";

type WorkDay = {
  id: number; employeeId: number; branchId: number; workDate: string;
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
      const query = new URLSearchParams({ employeeId, startDate, endDate });
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
        status: form.get("status"), lateMinutes: number(form.get("lateMinutes")),
        isDeductible: form.get("isDeductible") === "on", note: String(form.get("note") ?? ""),
      } : {
        employeeId: Number(employeeId), branchId: number(form.get("branchId")),
        workDate: form.get("workDate"), status: form.get("status"),
        clockInAt: dateTime(form.get("clockInAt")), clockOutAt: dateTime(form.get("clockOutAt")),
        lateMinutes: number(form.get("lateMinutes")), isDeductible: form.get("isDeductible") === "on",
        note: String(form.get("note") ?? ""),
      };
      const path = correction ? `/work-day-records/${number(form.get("recordId"))}` : "/work-day-records";
      await api(path, { method: correction ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setMessage(correction ? "บันทึกการแก้ไขแล้ว" : "บันทึกวันทำงานแล้ว");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกข้อมูลการลงเวลาทำงานได้"); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 text-slate-900 sm:px-8">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">การปฏิบัติงาน</p><h1 className="text-3xl font-bold">การลงเวลาทำงาน</h1><p className="mt-2 text-slate-600">ตรวจสอบวันทำงานย้อนหลังและบันทึกรายการด้วยตนเอง</p></header>
    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-4">
      <label className="text-sm font-medium">พนักงาน<EmployeePicker className={input} required value={employeeId} onChange={setEmployeeId} /></label>
      <label className="text-sm font-medium">ตั้งแต่<input className={input} type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
      <label className="text-sm font-medium">ถึง<input className={input} type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
      <button className={`${button} self-end`} disabled={loading}>{loading ? "กำลังโหลด…" : "โหลดรายการ"}</button>
    </form>
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    <section className="rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">วันทำงาน</h2>
      {records.length === 0 && !loading ? <p className="mt-3 text-slate-600">ไม่พบรายการในช่วงที่เลือก</p> :
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">วันที่</th><th className="p-2">สาขา</th><th className="p-2">สถานะ</th><th className="p-2">เวลาเข้างาน / ออกงาน</th><th className="p-2">มาสาย</th><th className="p-2">หักเงิน</th><th className="p-2">แหล่งที่มา</th></tr></thead><tbody>{records.map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="p-2">{row.workDate}</td><td className="p-2">{row.branchId}</td><td className="p-2">{row.status}</td><td className="p-2">{row.clockInAt ?? "—"} / {row.clockOutAt ?? "—"}</td><td className="p-2">{row.lateMinutes} นาที</td><td className="p-2">{row.isDeductible ? "ใช่" : "ไม่ใช่"}</td><td className="p-2">{row.entrySource}</td></tr>)}</tbody></table></div>}
    </section>
    <div className="grid gap-6 lg:grid-cols-2"><form onSubmit={(event) => void save(event)} className="space-y-3 rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">บันทึกวันทำงาน</h2>
      <div className="grid gap-3 sm:grid-cols-2"><p className="text-sm text-slate-600 sm:col-span-2">ใช้พนักงานที่เลือกด้านบนสำหรับรายการนี้</p><label className="text-sm">รหัสสาขา<input className={input} name="branchId" type="number" min="1" required /></label><label className="text-sm">วันที่ทำงาน<input className={input} name="workDate" type="date" required /></label><label className="text-sm">สถานะ<select className={input} name="status">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-sm">เวลาเข้างาน<input className={input} name="clockInAt" type="datetime-local" /></label><label className="text-sm">เวลาออกงาน<input className={input} name="clockOutAt" type="datetime-local" /></label><label className="text-sm">นาทีที่มาสาย<input className={input} name="lateMinutes" type="number" min="0" defaultValue="0" required /></label><label className="flex items-center gap-2 self-end text-sm"><input name="isDeductible" type="checkbox" /> หักเงิน</label></div><label className="block text-sm">หมายเหตุ<input className={input} name="note" /></label><button className={button} disabled={busy || !employeeId}>บันทึกวันทำงาน</button>
    </form><form onSubmit={(event) => void save(event, true)} className="space-y-3 rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">แก้ไขรายการ</h2><p className="text-sm text-slate-600">ระบบตรวจสอบการล็อกรอบเงินเดือนก่อนแก้ไข</p><label className="block text-sm">รหัสรายการ<input className={input} name="recordId" type="number" min="1" required /></label><label className="block text-sm">สถานะ<select className={input} name="status">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="block text-sm">นาทีที่มาสาย<input className={input} name="lateMinutes" type="number" min="0" defaultValue="0" required /></label><label className="flex items-center gap-2 text-sm"><input name="isDeductible" type="checkbox" /> หักเงิน</label><label className="block text-sm">เหตุผล / หมายเหตุ<input className={input} name="note" required /></label><button className={button} disabled={busy}>บันทึกการแก้ไข</button></form></div>
  </main>;
}
