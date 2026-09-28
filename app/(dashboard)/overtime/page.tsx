"use client";

import { useState } from "react";
import { EmployeePicker } from "@/components/employee-picker";
import { operationsApi } from "@/lib/operations/operations-api";

type Overtime = { id: number; employeeId: number; overtimeDate: string;
  overtimeType: "hourly" | "rest_day" | "public_holiday"; hours: string | null;
  dayUnits: string | null; reason: string | null; status: string };
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const primary = "rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50";
const api = operationsApi.request;
export default function OvertimePage() {
  const [employeeId, setEmployeeId] = useState("");
  const [rows, setRows] = useState<Overtime[]>([]);
  const [type, setType] = useState<Overtime["overtimeType"]>("hourly");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    if (!employeeId) { setError("เลือกพนักงานก่อนโหลดข้อมูล OT"); return; }
    setLoading(true); setError(""); setRows([]);
    try { setRows(await api<Overtime[]>(`/overtime-records?employee_id=${encodeURIComponent(employeeId)}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดคำขอ OT ได้"); }
    finally { setLoading(false); }
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employeeId) { setError("เลือกพนักงานก่อนส่งคำขอ OT"); return; }
    setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/overtime-records", { method: "POST", body: JSON.stringify({
        employee_id: Number(employeeId), overtime_date: form.get("overtime_date"),
        overtime_type: type, ...(type === "hourly" ? { hours: form.get("hours") } : { day_units: form.get("day_units") }),
        work_day_record_id: form.get("work_day_record_id") ? Number(form.get("work_day_record_id")) : undefined,
        reason: form.get("reason"),
      }) });
      setMessage("ส่งคำขอ OT แล้ว"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถส่งคำขอ OT ได้"); }
    finally { setBusy(false); }
  };
  const decide = async (id: number, action: "approve" | "reject", remark: string) => {
    setBusy(true); setError(""); setMessage("");
    try { await api(`/overtime-records/${id}/${action}`, { method: "POST", body: JSON.stringify({ remark }) });
      setMessage(action === "approve" ? "อนุมัติ OT แล้ว" : "ไม่อนุมัติ OT แล้ว"); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถดำเนินการคำขอ OT ได้"); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 text-slate-900 sm:px-8"><header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">การอนุมัติ</p><h1 className="text-3xl font-bold">การทำงานล่วงเวลา</h1><p className="mt-2 text-slate-600">OT จะนำไปจ่ายได้เมื่อได้รับการอนุมัติอย่างชัดเจนเท่านั้น</p></header>
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]"><section className="rounded-2xl border border-slate-200 p-5"><form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex flex-wrap items-end gap-3"><label className="min-w-40 flex-1 text-sm">พนักงาน<EmployeePicker className={field} required value={employeeId} onChange={setEmployeeId} /></label><button className={primary} disabled={loading}>{loading ? "กำลังโหลด…" : "โหลดคำขอ OT"}</button></form>
      {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      <div className="mt-6 space-y-4"><h2 className="text-xl font-semibold">คำขอ OT</h2>{rows.length === 0 && !loading && <p className="text-slate-600">ไม่พบคำขอ OT ของพนักงานนี้</p>}{rows.map((row) => <article key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex justify-between gap-2"><div><p className="font-semibold">{row.overtimeDate} · {row.overtimeType.replaceAll("_", " ")}</p><p className="text-sm text-slate-600">{row.hours ? `${row.hours} ชั่วโมง` : `${row.dayUnits ?? "0"} วัน`} · {row.reason ?? "ไม่ระบุเหตุผล"}</p></div><span className="h-fit rounded-full bg-white px-3 py-1 text-sm">{row.status}</span></div>{row.status === "pending" && <form onSubmit={(event) => { event.preventDefault(); const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-action") as "approve" | "reject"; if (action) void decide(row.id, action, String(new FormData(event.currentTarget).get("remark") ?? "")); }} className="mt-4 flex flex-wrap items-end gap-2"><label className="text-sm">หมายเหตุการพิจารณา<input className={field} name="remark" /></label><button className={primary} data-action="approve" disabled={busy}>อนุมัติ</button><button className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50" data-action="reject" disabled={busy}>ไม่อนุมัติ</button></form>}</article>)}</div></section>
      <form onSubmit={(event) => void submit(event)} className="h-fit space-y-4 rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">ส่งคำขอ OT ใหม่</h2><p className="text-sm text-slate-600">ใช้พนักงานที่เลือกด้านซ้าย</p><label className="block text-sm">วันที่<input className={field} name="overtime_date" type="date" required /></label><label className="block text-sm">ประเภท<select className={field} value={type} onChange={(event) => setType(event.target.value as Overtime["overtimeType"])}><option value="hourly">รายชั่วโมง</option><option value="rest_day">วันหยุดประจำสัปดาห์</option><option value="public_holiday">วันหยุดนักขัตฤกษ์</option></select></label>{type === "hourly" ? <label className="block text-sm">จำนวนชั่วโมง<input className={field} name="hours" type="number" min="0.01" step="0.01" required /></label> : <label className="block text-sm">จำนวนวัน<input className={field} name="day_units" type="number" min="0.01" step="0.01" required /></label>}<label className="block text-sm">รหัสรายการวันทำงาน (ถ้ามี)<input className={field} name="work_day_record_id" type="number" min="1" /></label><label className="block text-sm">เหตุผล<input className={field} name="reason" /></label><button className={primary} disabled={busy || !employeeId}>ส่งคำขอ</button></form>
    </div></main>;
}
