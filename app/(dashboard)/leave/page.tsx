"use client";

import { useEffect, useState } from "react";
import { EmployeePicker } from "@/components/employee-picker";
import { Feedback, PageHeader, StatusBadge, formatThaiDate } from "@/components/workspace-ui";
import { authApi } from "@/lib/auth/auth-api";
import { operationsApi } from "@/lib/operations/operations-api";

type Leave = { id: number; employeeId: number; originalLeaveTypeId: number; finalLeaveTypeId: number | null; startDate: string; endDate: string; requestedDays: string; status: string; reason: string | null; isRetroactive: boolean };
type LeaveType = { id: number; nameTh: string; requiresDocument: boolean };
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const primary = "rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50";
const api = operationsApi.request;
const canApproveLeave = (roles: string[]) => roles.some((role) => ["SUPERVISOR", "BRANCH_MANAGER", "HR", "OWNER"].includes(role));

export default function LeavePage() {
  const [employeeId, setEmployeeId] = useState("");
  const [rows, setRows] = useState<Leave[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canSelectEmployee, setCanSelectEmployee] = useState(false);
  const [ownEmployeeName, setOwnEmployeeName] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void api<LeaveType[]>("/leave-types").then(setLeaveTypes).catch((cause) => setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดประเภทการลาได้"));
    void authApi.current().then((actor) => {
      const roles = actor.grants.map((grant) => grant.role_code);
      const canManageEmployees = canApproveLeave(roles);
      setCanApprove(canManageEmployees);
      setCanEdit(Boolean(actor.account.employee) || canManageEmployees);
      setCanSelectEmployee(canManageEmployees);
      if (actor.account.employee && !canManageEmployees) {
        setEmployeeId(actor.account.employee.id);
        setOwnEmployeeName(actor.account.employee.display_name);
      }
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "ไม่สามารถตรวจสอบสิทธิ์ได้"))
      .finally(() => setAuthReady(true));
  }, []);

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
      await api("/leave-requests", { method: "POST", body: JSON.stringify({ employee_id: Number(employeeId), leave_type_id: Number(form.get("leave_type_id")), start_date: form.get("start_date"), end_date: form.get("end_date"), reason: form.get("reason"), is_retroactive: form.get("is_retroactive") === "on" }) });
      setMessage("ส่งคำขอลาแล้ว"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถส่งคำขอลาได้"); }
    finally { setBusy(false); }
  };
  const decide = async (id: number, action: "approve" | "reject", form: FormData) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const finalType = String(form.get("final_leave_type_id") ?? "");
      await api(`/leave-requests/${id}/${action}`, { method: "POST", body: JSON.stringify(action === "approve" ? { ...(finalType ? { final_leave_type_id: Number(finalType) } : {}) } : { remark: String(form.get("remark") ?? "") }) });
      setMessage(action === "approve" ? "อนุมัติคำขอลาแล้ว" : "ไม่อนุมัติคำขอลาแล้ว"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถดำเนินการคำขอลาได้"); }
    finally { setBusy(false); }
  };
  const update = async (id: number, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api(`/leave-requests/${id}`, { method: "PATCH", body: JSON.stringify({ leave_type_id: Number(form.get("leave_type_id")), start_date: form.get("start_date"), end_date: form.get("end_date"), reason: form.get("reason"), is_retroactive: form.get("is_retroactive") === "on" }) });
      setEditingId(null); setMessage("แก้ไขคำขอลาแล้ว"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถแก้ไขคำขอลาได้"); }
    finally { setBusy(false); }
  };
  const leaveTypeName = (id: number) => leaveTypes.find((type) => type.id === id)?.nameTh ?? "ไม่ระบุประเภท";

  return <div className="space-y-8">
    <PageHeader title="การลา" description="ส่งคำขอลา ตรวจสอบผล และแก้ไขได้เฉพาะคำขอที่ยังรอพิจารณา" />
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="rounded-2xl border border-slate-200 p-5">
        <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex flex-wrap items-end gap-3">{canSelectEmployee ? <label className="min-w-40 flex-1 text-sm">พนักงาน<EmployeePicker className={field} required value={employeeId} onChange={setEmployeeId} /></label> : <p className="min-w-40 flex-1 text-sm">คำขอลาของคุณ<span className="mt-1 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">{ownEmployeeName || "กำลังตรวจสอบสิทธิ์…"}</span></p>}<button className={primary} disabled={loading || !authReady || !employeeId}>{loading ? "กำลังโหลด…" : "โหลดคำขอ"}</button></form>
        <div className="mt-4 space-y-3">{message ? <Feedback kind="success" detail={message} /> : null}{error ? <Feedback kind="error" title="ทำรายการไม่สำเร็จ" detail={error} /> : null}</div>
        <div className="mt-6 space-y-4"><h2 className="text-xl font-semibold">คำขอลา</h2>{rows.length === 0 && !loading && <Feedback kind="empty" title="ยังไม่มีคำขอในรายการนี้" detail="เลือกพนักงานแล้วกดโหลดคำขอ หรือส่งคำขอใหม่จากแบบฟอร์มด้านขวา" />}
          {rows.map((row) => <article key={row.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{formatThaiDate(row.startDate)} – {formatThaiDate(row.endDate)}</p><p className="text-sm leading-6 text-[var(--muted)]">{row.requestedDays} วัน · {leaveTypeName(row.finalLeaveTypeId ?? row.originalLeaveTypeId)} · {row.reason ?? "ไม่ระบุเหตุผล"}</p></div><StatusBadge value={row.status} /></div>
            {canEdit && row.status === "pending" && (editingId === row.id ? <form onSubmit={(event) => void update(row.id, event)} className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2"><label className="text-sm">ประเภทการลา<select className={field} name="leave_type_id" defaultValue={row.originalLeaveTypeId} required>{leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.nameTh}</option>)}</select></label><label className="text-sm">เหตุผล<input className={field} name="reason" defaultValue={row.reason ?? ""} /></label><label className="text-sm">วันลาเริ่มต้น<input className={field} name="start_date" type="date" defaultValue={row.startDate} required /></label><label className="text-sm">วันลาสิ้นสุด<input className={field} name="end_date" type="date" defaultValue={row.endDate} required /></label><label className="flex items-center gap-2 text-sm"><input name="is_retroactive" type="checkbox" defaultChecked={row.isRetroactive} /> คำขอย้อนหลัง</label><div className="flex gap-2"><button className={primary} type="submit" disabled={busy}>บันทึกการแก้ไข</button><button className="rounded-lg border border-slate-300 px-4 py-2" type="button" onClick={() => setEditingId(null)} disabled={busy}>ยกเลิก</button></div></form> : <button className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium" type="button" onClick={() => setEditingId(row.id)}>แก้ไขคำขอ</button>)}
            {canApprove && row.status === "pending" && <form onSubmit={(event) => { event.preventDefault(); const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-action") as "approve" | "reject"; if (action) void decide(row.id, action, new FormData(event.currentTarget)); }} className="mt-4 flex flex-wrap items-end gap-2"><label className="text-sm">เปลี่ยนประเภทการลา (ไม่บังคับ)<select className={field} name="final_leave_type_id"><option value="">ใช้ประเภทเดิม</option>{leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.nameTh}</option>)}</select></label><label className="text-sm">หมายเหตุการพิจารณา<input className={field} name="remark" /></label><button className={primary} type="submit" data-action="approve" disabled={busy}>อนุมัติ</button><button className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50" type="submit" data-action="reject" disabled={busy}>ไม่อนุมัติ</button></form>}
          </article>)}</div>
      </section>
      <form onSubmit={(event) => void submit(event)} className="h-fit space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">ส่งคำขอลาใหม่</h2><p className="text-sm leading-6 text-[var(--muted)]">{canSelectEmployee ? "ใช้พนักงานที่เลือกด้านซ้าย" : "ส่งคำขอในชื่อของคุณเท่านั้น"}</p><label className="block text-sm">ประเภทการลา<select className={field} name="leave_type_id" required disabled={leaveTypes.length === 0}><option value="">{leaveTypes.length ? "เลือกประเภทการลา" : "กำลังโหลดประเภทการลา…"}</option>{leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.nameTh}{type.requiresDocument ? " · ต้องแนบเอกสาร" : ""}</option>)}</select></label><label className="block text-sm">วันลาเริ่มต้น<input className={field} name="start_date" type="date" required /></label><label className="block text-sm">วันลาสิ้นสุด<input className={field} name="end_date" type="date" required /></label><label className="block text-sm">เหตุผล<input className={field} name="reason" /></label><label className="flex items-center gap-2 text-sm"><input name="is_retroactive" type="checkbox" /> คำขอย้อนหลัง</label><button className={primary} disabled={busy || !authReady || !employeeId || leaveTypes.length === 0}>ส่งคำขอ</button></form>
    </div>
  </div>;
}
