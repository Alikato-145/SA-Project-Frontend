"use client";

import { DecisionHistoryView } from "@/lib/operations/operation-controls";

import { useEffect, useState } from "react";
import { EmployeeContextPicker } from "@/components/employee-picker";
import { Button } from "@/components/ui/button";
import { Feedback, PageHeader, StatusBadge, formatThaiDate, thaiLabel } from "@/components/workspace-ui";
import {
  authApi,
  employeeContextFor,
  type EmployeeContext,
} from "@/lib/auth/auth-api";
import { operationsApi } from "@/lib/operations/operations-api";

type Overtime = { id: string; employeeId: string; overtimeDate: string; overtimeType: "hourly" | "rest_day" | "public_holiday"; hours: string | null; dayUnits: string | null; reason: string | null; status: string };
const field = "workspace-control";
const api = operationsApi.request;

export default function OvertimePage() {
  const [employeeId, setEmployeeId] = useState("");
  const [employeeContext, setEmployeeContext] = useState<
    EmployeeContext | null | undefined
  >(undefined);
  const [rows, setRows] = useState<Overtime[]>([]);
  const [type, setType] = useState<Overtime["overtimeType"]>("hourly");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<Overtime["overtimeType"]>("hourly");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const linkedEmployee = new URLSearchParams(window.location.search).get("employee_id");
    void authApi.current().then((actor) => {
      const context = employeeContextFor(actor);
      setEmployeeContext(context);
      if (context.mode === "self") setEmployeeId(context.employee.id);
      if (context.mode === "management") {
        const requestedEmployee = linkedEmployee;
        if (requestedEmployee && /^[1-9]\d*$/.test(requestedEmployee)) {
          setEmployeeId(requestedEmployee);
          setLoading(true);
          void api<Overtime[]>(`/overtime-records?employee_id=${encodeURIComponent(requestedEmployee)}`)
            .then(setRows)
            .catch((cause) => setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดคำขอ OT ได้"))
            .finally(() => setLoading(false));
        }
      }
    }).catch((cause) => {
      setEmployeeContext(null);
      setError(cause instanceof Error ? cause.message : "ไม่สามารถตรวจสอบสิทธิ์ได้");
    });
  }, []);

  const canManageEmployees = employeeContext?.mode === "management";

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
        employee_id: employeeId, overtime_date: form.get("overtime_date"), overtime_type: type,
        ...(type === "hourly" ? { hours: form.get("hours") } : { day_units: form.get("day_units") }),
        work_day_record_id: form.get("work_day_record_id") ? String(form.get("work_day_record_id")) : undefined,
        reason: form.get("reason"),
      }) });
      setMessage("ส่งคำขอ OT แล้ว รอผู้มีสิทธิ์พิจารณา"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถส่งคำขอ OT ได้"); }
    finally { setBusy(false); }
  };
  const update = async (id: string, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/overtime-records/${id}`, { method: "PATCH", body: JSON.stringify({
        overtime_date: form.get("overtime_date"), overtime_type: editType,
        ...(editType === "hourly" ? { hours: form.get("hours") } : { day_units: form.get("day_units") }),
        reason: form.get("reason"),
      }) });
      setEditingId(null); setMessage("แก้ไขคำขอ OT แล้ว"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถแก้ไขคำขอ OT ได้"); }
    finally { setBusy(false); }
  };
  const decide = async (id: string, action: "approve" | "reject", remark: string) => {
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/overtime-records/${id}/${action}`, { method: "POST", body: JSON.stringify({ remark }) });
      setMessage(action === "approve" ? "อนุมัติ OT แล้ว" : "ไม่อนุมัติ OT แล้ว"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถดำเนินการคำขอ OT ได้"); }
    finally { setBusy(false); }
  };

  return <div className="space-y-7">
    <PageHeader title="การทำงานล่วงเวลา" description="ส่งคำขอ OT และตรวจสอบผลการพิจารณา OT จะนำไปจ่ายได้เมื่ออนุมัติแล้วเท่านั้น" />
    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="workspace-filter flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1"><EmployeeContextPicker context={employeeContext} className={field} selfLabel="กำลังดูคำขอ OT ของ" value={employeeId} onChange={setEmployeeId} /></div>
      <Button type="submit" disabled={loading || employeeContext === undefined || !employeeId}>{loading ? "กำลังโหลด…" : "โหลดคำขอ OT"}</Button>
    </form>
    <div className="space-y-3">{message ? <Feedback kind="success" detail={message} /> : null}{error ? <Feedback kind="error" title="ทำรายการไม่สำเร็จ" detail={error} /> : null}</div>
    <form onSubmit={(event) => void submit(event)} className="workspace-section"><div className="max-w-2xl"><h2 className="text-xl font-semibold">ส่งคำขอ OT ใหม่</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{canManageEmployees ? "คำขอนี้จะใช้พนักงานที่เลือกไว้ด้านบน" : employeeContext?.mode === "self" ? "คำขอนี้จะส่งในชื่อของคุณเท่านั้น" : "ต้องเชื่อมข้อมูลพนักงานก่อนส่งคำขอ"}</p></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">วันที่ทำ OT<input className={field} name="overtime_date" type="date" required /></label><label className="text-sm">ประเภท OT<select className={field} value={type} onChange={(event) => setType(event.target.value as Overtime["overtimeType"])}><option value="hourly">รายชั่วโมง</option><option value="rest_day">วันหยุดประจำสัปดาห์</option><option value="public_holiday">วันหยุดนักขัตฤกษ์</option></select></label>{type === "hourly" ? <label className="text-sm">จำนวนชั่วโมง<input className={field} name="hours" type="number" min="0.01" step="0.01" required /></label> : <label className="text-sm">จำนวนวัน<input className={field} name="day_units" type="number" min="0.01" max="1" step="0.01" required /></label>}<label className="text-sm">อ้างอิงรายการลงเวลา <span className="text-[var(--muted)]">(ถ้ามี)</span><input className={field} name="work_day_record_id" type="number" min="1" inputMode="numeric" /></label><label className="text-sm sm:col-span-2">เหตุผล<input className={field} name="reason" /></label><div className="sm:col-span-2"><Button type="submit" disabled={busy || !employeeId}>ส่งคำขอ</Button></div></div></form>
    <section aria-labelledby="overtime-list-heading"><div><h2 id="overtime-list-heading" className="text-xl font-semibold">คำขอ OT</h2><p className="mt-1 text-sm text-[var(--muted)]">รายการล่าสุดของพนักงานที่เลือก</p></div>{rows.length === 0 && !loading ? <div className="mt-4"><Feedback kind="empty" title="ยังไม่มีคำขอ OT" detail="ส่งคำขอใหม่จากแบบฟอร์มด้านบน หรือเปลี่ยนพนักงานแล้วโหลดข้อมูลอีกครั้ง" /></div> : <div className="workspace-records mt-4">
      {rows.map((row) => <article key={row.id} className="workspace-record"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{formatThaiDate(row.overtimeDate)} · {thaiLabel(row.overtimeType)}</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{row.hours ? `${row.hours} ชั่วโมง` : `${row.dayUnits ?? "0"} วัน`}<span className="block">{row.reason ?? "ไม่ระบุเหตุผล"}</span></p></div><StatusBadge value={row.status} /></div>
        {row.status === "pending" && (editingId === row.id ? <form onSubmit={(event) => void update(row.id, event)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">วันที่ทำ OT<input className={field} name="overtime_date" type="date" defaultValue={row.overtimeDate} required /></label>
          <label className="text-sm">ประเภท OT<select className={field} value={editType} onChange={(event) => setEditType(event.target.value as Overtime["overtimeType"])}><option value="hourly">รายชั่วโมง</option><option value="rest_day">วันหยุดประจำสัปดาห์</option><option value="public_holiday">วันหยุดนักขัตฤกษ์</option></select></label>
          {editType === "hourly" ? <label className="text-sm">จำนวนชั่วโมง<input key="hours" className={field} name="hours" type="number" min="0.01" step="0.01" defaultValue={row.hours ?? ""} required /></label> : <label className="text-sm">จำนวนวัน<input key="days" className={field} name="day_units" type="number" min="0.01" max="1" step="0.01" defaultValue={row.dayUnits ?? ""} required /></label>}
          <label className="text-sm">เหตุผล<input className={field} name="reason" defaultValue={row.reason ?? ""} /></label>
          <div className="flex gap-2"><Button type="submit" disabled={busy}>บันทึก</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setEditingId(null)}>ยกเลิก</Button></div>
        </form> : <Button className="mt-4" type="button" variant="outline" onClick={() => { setEditType(row.overtimeType); setEditingId(row.id); }}>แก้ไขคำขอ</Button>)}
        {canManageEmployees && row.status === "pending" ? <form onSubmit={(event) => { event.preventDefault(); const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-action") as "approve" | "reject"; if (action) void decide(row.id, action, String(new FormData(event.currentTarget).get("remark") ?? "")); }} className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--line)] pt-4"><label className="min-w-52 flex-1 text-sm">หมายเหตุการพิจารณา<input className={field} name="remark" /></label><Button type="submit" data-action="approve" disabled={busy}>อนุมัติ</Button><Button type="submit" variant="outline" data-action="reject" disabled={busy}>ไม่อนุมัติ</Button></form> : null}
        {row.status !== "pending" ? <p className="mt-4 border-t border-[var(--line)] pt-3 text-sm text-[var(--muted)]">คำขอนี้พิจารณาเสร็จแล้ว หากข้อมูลคลาดเคลื่อน ให้ติดต่อ HR เพื่อดำเนินการตามขั้นตอนที่บันทึกประวัติได้</p> : null}
        <DecisionHistoryView path={`/overtime-records/${row.id}/history`} />
      </article>)}
    </div>}</section>
  </div>;
}
