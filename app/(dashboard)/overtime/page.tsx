"use client";

import { useEffect, useState } from "react";
import { EmployeePicker } from "@/components/employee-picker";
import { Button } from "@/components/ui/button";
import { Feedback, PageHeader, StatusBadge, formatThaiDate, thaiLabel } from "@/components/workspace-ui";
import { authApi } from "@/lib/auth/auth-api";
import { operationsApi } from "@/lib/operations/operations-api";

type Overtime = { id: number; employeeId: number; overtimeDate: string; overtimeType: "hourly" | "rest_day" | "public_holiday"; hours: string | null; dayUnits: string | null; reason: string | null; status: string };
const field = "mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[var(--ink)]";
const api = operationsApi.request;
const canManageOvertime = (roles: string[]) => roles.some((role) => ["SUPERVISOR", "BRANCH_MANAGER", "HR", "OWNER"].includes(role));

export default function OvertimePage() {
  const [employeeId, setEmployeeId] = useState("");
  const [ownEmployeeName, setOwnEmployeeName] = useState("");
  const [canSelectEmployee, setCanSelectEmployee] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [rows, setRows] = useState<Overtime[]>([]);
  const [type, setType] = useState<Overtime["overtimeType"]>("hourly");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void authApi.current().then((actor) => {
      const manages = canManageOvertime(actor.grants.map((grant) => grant.role_code));
      setCanApprove(manages); setCanSelectEmployee(manages);
      if (actor.account.employee && !manages) {
        setEmployeeId(actor.account.employee.id);
        setOwnEmployeeName(actor.account.employee.display_name);
      }
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "ไม่สามารถตรวจสอบสิทธิ์ได้"))
      .finally(() => setAuthReady(true));
  }, []);

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
        employee_id: Number(employeeId), overtime_date: form.get("overtime_date"), overtime_type: type,
        ...(type === "hourly" ? { hours: form.get("hours") } : { day_units: form.get("day_units") }),
        work_day_record_id: form.get("work_day_record_id") ? Number(form.get("work_day_record_id")) : undefined,
        reason: form.get("reason"),
      }) });
      setMessage("ส่งคำขอ OT แล้ว รอผู้มีสิทธิ์พิจารณา"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถส่งคำขอ OT ได้"); }
    finally { setBusy(false); }
  };
  const decide = async (id: number, action: "approve" | "reject", remark: string) => {
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/overtime-records/${id}/${action}`, { method: "POST", body: JSON.stringify({ remark }) });
      setMessage(action === "approve" ? "อนุมัติ OT แล้ว" : "ไม่อนุมัติ OT แล้ว"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถดำเนินการคำขอ OT ได้"); }
    finally { setBusy(false); }
  };

  return <div className="space-y-8">
    <PageHeader title="การทำงานล่วงเวลา" description="ส่งคำขอ OT และตรวจสอบผลการพิจารณา OT จะนำไปจ่ายได้เมื่ออนุมัติแล้วเท่านั้น" />
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex flex-wrap items-end gap-3">
          {canSelectEmployee ? <label className="min-w-52 flex-1 text-sm font-medium">พนักงาน<EmployeePicker className={field} required value={employeeId} onChange={setEmployeeId} /></label> : <p className="min-w-52 flex-1 text-sm font-medium">คำขอ OT ของคุณ<span className="mt-1 block rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 font-normal text-[var(--ink)]">{ownEmployeeName || "กำลังตรวจสอบสิทธิ์…"}</span></p>}
          <Button type="submit" disabled={loading || !authReady || !employeeId}>{loading ? "กำลังโหลด…" : "โหลดคำขอ OT"}</Button>
        </form>
        <div className="mt-4 space-y-3">{message ? <Feedback kind="success" detail={message} /> : null}{error ? <Feedback kind="error" title="ทำรายการไม่สำเร็จ" detail={error} /> : null}</div>
        <div className="mt-6 space-y-4"><h2 className="text-xl font-semibold">คำขอ OT</h2>{rows.length === 0 && !loading ? <Feedback kind="empty" title="ยังไม่มีคำขอ OT" detail="ส่งคำขอใหม่จากแบบฟอร์มด้านขวา หรือเปลี่ยนพนักงานแล้วโหลดข้อมูลอีกครั้ง" /> : null}
          {rows.map((row) => <article key={row.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{formatThaiDate(row.overtimeDate)} · {thaiLabel(row.overtimeType)}</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{row.hours ? `${row.hours} ชั่วโมง` : `${row.dayUnits ?? "0"} วัน`} · {row.reason ?? "ไม่ระบุเหตุผล"}</p></div><StatusBadge value={row.status} /></div>
            {canApprove && row.status === "pending" ? <form onSubmit={(event) => { event.preventDefault(); const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-action") as "approve" | "reject"; if (action) void decide(row.id, action, String(new FormData(event.currentTarget).get("remark") ?? "")); }} className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--line)] pt-4"><label className="min-w-52 flex-1 text-sm">หมายเหตุการพิจารณา<input className={field} name="remark" /></label><Button type="submit" data-action="approve" disabled={busy}>อนุมัติ</Button><Button type="submit" variant="outline" data-action="reject" disabled={busy}>ไม่อนุมัติ</Button></form> : null}
            {row.status !== "pending" ? <p className="mt-4 border-t border-[var(--line)] pt-3 text-sm text-[var(--muted)]">คำขอนี้พิจารณาเสร็จแล้ว หากข้อมูลคลาดเคลื่อน ให้ติดต่อ HR เพื่อดำเนินการตามขั้นตอนที่บันทึกประวัติได้</p> : null}
          </article>)}</div>
      </section>
      <form onSubmit={(event) => void submit(event)} className="h-fit space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">ส่งคำขอ OT ใหม่</h2><p className="text-sm leading-6 text-[var(--muted)]">{canSelectEmployee ? "ใช้พนักงานที่เลือกด้านซ้าย" : "ส่งคำขอในชื่อของคุณเท่านั้น"}</p><label className="block text-sm">วันที่ทำ OT<input className={field} name="overtime_date" type="date" required /></label><label className="block text-sm">ประเภท OT<select className={field} value={type} onChange={(event) => setType(event.target.value as Overtime["overtimeType"])}><option value="hourly">รายชั่วโมง</option><option value="rest_day">วันหยุดประจำสัปดาห์</option><option value="public_holiday">วันหยุดนักขัตฤกษ์</option></select></label>{type === "hourly" ? <label className="block text-sm">จำนวนชั่วโมง<input className={field} name="hours" type="number" min="0.01" step="0.01" required /></label> : <label className="block text-sm">จำนวนวัน<input className={field} name="day_units" type="number" min="0.01" step="0.01" required /></label>}<label className="block text-sm">อ้างอิงรายการลงเวลา <span className="text-[var(--muted)]">(ถ้ามี)</span><input className={field} name="work_day_record_id" type="number" min="1" inputMode="numeric" /></label><label className="block text-sm">เหตุผล<input className={field} name="reason" /></label><Button type="submit" disabled={busy || !authReady || !employeeId}>ส่งคำขอ</Button></form>
    </div>
  </div>;
}
