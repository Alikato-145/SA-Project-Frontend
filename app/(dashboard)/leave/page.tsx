"use client";

import { useState } from "react";
import { EmployeePicker } from "@/components/employee-picker";
import { operationsApi } from "@/lib/operations/operations-api";

type Leave = { id: number; employeeId: number; originalLeaveTypeId: number;
  finalLeaveTypeId: number | null; startDate: string; endDate: string;
  requestedDays: string; status: string; reason: string | null };
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const primary = "rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50";
const api = operationsApi.request;
export default function LeavePage() {
  const [employeeId, setEmployeeId] = useState("");
  const [rows, setRows] = useState<Leave[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    if (!employeeId) { setError("เลือกพนักงานก่อนโหลดคำขอลา"); return; }
    setLoading(true); setError(""); setRows([]);
    try { setRows(await api<Leave[]>(`/leave-requests?employee_id=${encodeURIComponent(employeeId)}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดคำขอลาได้"); }
    finally { setLoading(false); }
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employeeId) { setError("เลือกพนักงานก่อนส่งคำขอลา"); return; }
    setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/leave-requests", { method: "POST", body: JSON.stringify({
        employee_id: Number(employeeId), leave_type_id: Number(form.get("leave_type_id")),
        start_date: form.get("start_date"), end_date: form.get("end_date"),
        reason: form.get("reason"), is_retroactive: form.get("is_retroactive") === "on",
      }) });
      setMessage("ส่งคำขอลาแล้ว"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถส่งคำขอลาได้"); }
    finally { setBusy(false); }
  };
  const decide = async (id: number, action: "approve" | "reject", form: FormData) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const finalType = String(form.get("final_leave_type_id") ?? "");
      await api(`/leave-requests/${id}/${action}`, { method: "POST", body: JSON.stringify(
        action === "approve" ? { ...(finalType ? { final_leave_type_id: Number(finalType) } : {}) }
          : { remark: String(form.get("remark") ?? "") }) });
      setMessage(action === "approve" ? "อนุมัติคำขอลาแล้ว" : "ไม่อนุมัติคำขอลาแล้ว"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถดำเนินการคำขอลาได้"); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 text-slate-900 sm:px-8">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">การอนุมัติ</p><h1 className="text-3xl font-bold">การลา</h1><p className="mt-2 text-slate-600">ส่งคำขอลาและตรวจสอบผลการพิจารณา</p></header>
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="rounded-2xl border border-slate-200 p-5"><form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex flex-wrap items-end gap-3"><label className="min-w-40 flex-1 text-sm">พนักงาน<EmployeePicker className={field} required value={employeeId} onChange={setEmployeeId} /></label><button className={primary} disabled={loading}>{loading ? "กำลังโหลด…" : "โหลดคำขอ"}</button></form>
        {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
        <div className="mt-6 space-y-4"><h2 className="text-xl font-semibold">คำขอลา</h2>{rows.length === 0 && !loading && <p className="text-slate-600">ไม่พบคำขอลาของพนักงานนี้</p>}
          {rows.map((row) => <article key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{row.startDate} – {row.endDate}</p><p className="text-sm text-slate-600">{row.requestedDays} วัน · ประเภท {row.finalLeaveTypeId ?? row.originalLeaveTypeId} · {row.reason ?? "ไม่ระบุเหตุผล"}</p></div><span className="h-fit rounded-full bg-white px-3 py-1 text-sm font-medium">{row.status}</span></div>
            {row.status === "pending" && <form onSubmit={(event) => { event.preventDefault(); const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-action") as "approve" | "reject"; if (action) void decide(row.id, action, new FormData(event.currentTarget)); }} className="mt-4 flex flex-wrap items-end gap-2"><label className="text-sm">รหัสประเภทลาสุดท้าย (ไม่บังคับ)<input className={field} name="final_leave_type_id" type="number" min="1" /></label><label className="text-sm">หมายเหตุการพิจารณา<input className={field} name="remark" /></label><button className={primary} type="submit" data-action="approve" disabled={busy}>อนุมัติ</button><button className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50" type="submit" data-action="reject" disabled={busy}>ไม่อนุมัติ</button></form>}
          </article>)}</div></section>
      <form onSubmit={(event) => void submit(event)} className="h-fit space-y-4 rounded-2xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">ส่งคำขอลาใหม่</h2><p className="text-sm text-slate-600">ใช้พนักงานที่เลือกด้านซ้าย</p><label className="block text-sm">รหัสประเภทการลา<input className={field} name="leave_type_id" type="number" min="1" required /></label><label className="block text-sm">วันลาเริ่มต้น<input className={field} name="start_date" type="date" required /></label><label className="block text-sm">วันลาสิ้นสุด<input className={field} name="end_date" type="date" required /></label><label className="block text-sm">เหตุผล<input className={field} name="reason" /></label><label className="flex items-center gap-2 text-sm"><input name="is_retroactive" type="checkbox" /> คำขอย้อนหลัง</label><button className={primary} disabled={busy || !employeeId}>ส่งคำขอ</button></form>
    </div>
  </main>;
}
