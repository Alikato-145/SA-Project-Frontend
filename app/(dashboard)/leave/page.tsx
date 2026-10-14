"use client";

import { LeaveAdministration } from "@/components/leave-administration";
import { AttachmentPanel } from "@/components/attachment-panel";
import { DecisionHistoryView } from "@/lib/operations/operation-controls";

import { useEffect, useState } from "react";
import { EmployeeContextPicker } from "@/components/employee-picker";
import { Feedback, PageHeader, StatusBadge, formatThaiDate } from "@/components/workspace-ui";
import {
  authApi,
  employeeContextFor,
  type EmployeeContext,
} from "@/lib/auth/auth-api";
import { operationsApi } from "@/lib/operations/operations-api";

type Leave = { id: string; employeeId: string; originalLeaveTypeId: string; finalLeaveTypeId: string | null; startDate: string; endDate: string; requestedDays: string; status: string; reason: string | null; isRetroactive: boolean };
type LeaveType = { id: string; nameTh: string; requiresDocument: boolean };
const field = "workspace-control";
const primary = "workspace-primary";
const secondary = "workspace-secondary";
const api = operationsApi.request;

export default function LeavePage() {
  const [employeeId, setEmployeeId] = useState("");
  const [rows, setRows] = useState<Leave[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employeeContext, setEmployeeContext] = useState<
    EmployeeContext | null | undefined
  >(undefined);
  const [canAdmin, setCanAdmin] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void api<LeaveType[]>("/leave-types").then(setLeaveTypes).catch((cause) => setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดประเภทการลาได้"));
    void authApi.current().then((actor) => {
      setCanAdmin(actor.grants.some((grant) => ["HR", "OWNER"].includes(grant.role_code) && grant.scope === "all"));
      const context = employeeContextFor(actor);
      setEmployeeContext(context);
      if (context.mode === "self") setEmployeeId(context.employee.id);
    }).catch((cause) => {
      setEmployeeContext(null);
      setError(cause instanceof Error ? cause.message : "ไม่สามารถตรวจสอบสิทธิ์ได้");
    });
  }, []);

  const canManageEmployees = employeeContext?.mode === "management";
  const canEdit =
    employeeContext?.mode === "management" || employeeContext?.mode === "self";

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
      await api("/leave-requests", { method: "POST", body: JSON.stringify({ employee_id: employeeId, leave_type_id: String(form.get("leave_type_id")), start_date: form.get("start_date"), end_date: form.get("end_date"), reason: form.get("reason"), is_retroactive: form.get("is_retroactive") === "on" }) });
      setMessage("ส่งคำขอลาแล้ว"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถส่งคำขอลาได้"); }
    finally { setBusy(false); }
  };
  const decide = async (id: string, action: "approve" | "reject", form: FormData) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const finalType = String(form.get("final_leave_type_id") ?? "");
      await api(`/leave-requests/${id}/${action}`, { method: "POST", body: JSON.stringify(action === "approve" ? { ...(finalType ? { final_leave_type_id: finalType } : {}), remark: String(form.get("remark") ?? "") } : { remark: String(form.get("remark") ?? "") }) });
      setMessage(action === "approve" ? "อนุมัติคำขอลาแล้ว" : "ไม่อนุมัติคำขอลาแล้ว"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถดำเนินการคำขอลาได้"); }
    finally { setBusy(false); }
  };
  const update = async (id: string, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api(`/leave-requests/${id}`, { method: "PATCH", body: JSON.stringify({ leave_type_id: String(form.get("leave_type_id")), start_date: form.get("start_date"), end_date: form.get("end_date"), reason: form.get("reason"), is_retroactive: form.get("is_retroactive") === "on" }) });
      setEditingId(null); setMessage("แก้ไขคำขอลาแล้ว"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถแก้ไขคำขอลาได้"); }
    finally { setBusy(false); }
  };
  const leaveTypeName = (id: string) => leaveTypes.find((type) => type.id === id)?.nameTh ?? "ไม่ระบุประเภท";

  return <div className="space-y-7">
    <PageHeader title="การลา" description="ส่งคำขอลา ตรวจสอบผล และแก้ไขได้เฉพาะคำขอที่ยังรอพิจารณา" />
    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="workspace-filter flex flex-wrap items-end gap-3"><div className="min-w-56 flex-1"><EmployeeContextPicker context={employeeContext} className={field} selfLabel="กำลังดูคำขอลาของ" value={employeeId} onChange={setEmployeeId} /></div><button className={primary} disabled={loading || employeeContext === undefined || !employeeId}>{loading ? "กำลังโหลด…" : "โหลดคำขอ"}</button></form>
    <div className="space-y-3">{message ? <Feedback kind="success" detail={message} /> : null}{error ? <Feedback kind="error" title="ทำรายการไม่สำเร็จ" detail={error} /> : null}</div>
    <form onSubmit={(event) => void submit(event)} className="workspace-section"><div className="max-w-2xl"><h2 className="text-xl font-semibold">ส่งคำขอลาใหม่</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{canManageEmployees ? "คำขอนี้จะใช้พนักงานที่เลือกไว้ด้านบน" : employeeContext?.mode === "self" ? "คำขอนี้จะส่งในชื่อของคุณเท่านั้น" : "ต้องเชื่อมข้อมูลพนักงานก่อนส่งคำขอ"}</p></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm sm:col-span-2">ประเภทการลา<select className={field} name="leave_type_id" required disabled={leaveTypes.length === 0}><option value="">{leaveTypes.length ? "เลือกประเภทการลา" : "กำลังโหลดประเภทการลา…"}</option>{leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.nameTh}{type.requiresDocument ? " (ต้องแนบเอกสาร)" : ""}</option>)}</select></label><label className="text-sm">วันลาเริ่มต้น<input className={field} name="start_date" type="date" required /></label><label className="text-sm">วันลาสิ้นสุด<input className={field} name="end_date" type="date" required /></label><label className="text-sm sm:col-span-2">เหตุผล<input className={field} name="reason" /></label><label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input name="is_retroactive" type="checkbox" /> เป็นคำขอย้อนหลัง</label><div className="sm:col-span-2"><button className={primary} disabled={busy || !employeeId || leaveTypes.length === 0}>ส่งคำขอ</button></div></div></form>
    {canAdmin && <LeaveAdministration onChanged={() => { void api<LeaveType[]>("/leave-types").then(setLeaveTypes).catch((cause) => setError(cause.message)); }} />}
    <section aria-labelledby="leave-list-heading"><div><h2 id="leave-list-heading" className="text-xl font-semibold">คำขอลา</h2><p className="mt-1 text-sm text-[var(--muted)]">รายการล่าสุดของพนักงานที่เลือก</p></div>{rows.length === 0 && !loading ? <div className="mt-4"><Feedback kind="empty" title="ยังไม่มีคำขอในรายการนี้" detail="เลือกพนักงานแล้วกดโหลดคำขอ หรือส่งคำขอใหม่จากแบบฟอร์มด้านบน" /></div> : <div className="workspace-records mt-4">
      {rows.map((row) => <article key={row.id} className="workspace-record"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{formatThaiDate(row.startDate)} ถึง {formatThaiDate(row.endDate)}</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{row.requestedDays} วัน · {leaveTypeName(row.finalLeaveTypeId ?? row.originalLeaveTypeId)}<span className="block">{row.reason ?? "ไม่ระบุเหตุผล"}</span></p></div><StatusBadge value={row.status} /></div>
        {canEdit && row.status === "pending" && (editingId === row.id ? <form onSubmit={(event) => void update(row.id, event)} className="mt-4 grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-2"><label className="text-sm">ประเภทการลา<select className={field} name="leave_type_id" defaultValue={row.originalLeaveTypeId} required>{leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.nameTh}</option>)}</select></label><label className="text-sm">เหตุผล<input className={field} name="reason" defaultValue={row.reason ?? ""} /></label><label className="text-sm">วันลาเริ่มต้น<input className={field} name="start_date" type="date" defaultValue={row.startDate} required /></label><label className="text-sm">วันลาสิ้นสุด<input className={field} name="end_date" type="date" defaultValue={row.endDate} required /></label><label className="flex min-h-11 items-center gap-2 text-sm"><input name="is_retroactive" type="checkbox" defaultChecked={row.isRetroactive} /> เป็นคำขอย้อนหลัง</label><div className="flex flex-wrap gap-2"><button className={primary} type="submit" disabled={busy}>บันทึก</button><button className={secondary} type="button" onClick={() => setEditingId(null)} disabled={busy}>ยกเลิก</button></div></form> : <button className={`${secondary} mt-4`} type="button" onClick={() => setEditingId(row.id)}>แก้ไขคำขอ</button>)}
        {canManageEmployees && row.status === "pending" && <form onSubmit={(event) => { event.preventDefault(); const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-action") as "approve" | "reject"; if (action) void decide(row.id, action, new FormData(event.currentTarget)); }} className="mt-4 grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-2"><label className="text-sm">เปลี่ยนประเภทการลา (ถ้าจำเป็น)<select className={field} name="final_leave_type_id"><option value="">ใช้ประเภทเดิม</option>{leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.nameTh}</option>)}</select></label><label className="text-sm">หมายเหตุการพิจารณา<input className={field} name="remark" /></label><div className="flex flex-wrap gap-2 sm:col-span-2"><button className={primary} type="submit" data-action="approve" disabled={busy}>อนุมัติ</button><button className={secondary} type="submit" data-action="reject" disabled={busy}>ไม่อนุมัติ</button></div></form>}
        <DecisionHistoryView path={`/leave-requests/${row.id}/history`} />
        <AttachmentPanel path={`/v1/leave-requests/${row.id}/attachments`} />
      </article>)}
    </div>}</section>
  </div>;
}
