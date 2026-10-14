"use client";

import { useEffect, useState, type FormEvent } from "react";
import { EmployeePicker } from "@/components/employee-picker";
import { Feedback } from "@/components/workspace-ui";
import { operationsApi } from "@/lib/operations/operations-api";

type Type = { id: string; code: string; nameTh: string; quotaType: string; quotaDays: string | null; isDeductible: boolean; requiresDocument: boolean; allowExceed: boolean; isActive: boolean };
type Quota = { id: string; leaveTypeId: string; quotaYear: number; entitledDays: string; usedDays: string; frozenAt: string | null };
const control = "workspace-control";
const api = operationsApi.request;

export function LeaveAdministration({ onChanged }: { onChanged(): void }) {
  const [types, setTypes] = useState<Type[]>([]);
  const [editing, setEditing] = useState<Type | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { const abort = new AbortController(); void api<Type[]>("/leave-types/manage", { signal: abort.signal }).then(setTypes).catch((cause) => { if (!abort.signal.aborted) setError(cause.message); }); return () => abort.abort(); }, []);
  useEffect(() => {
    const abort = new AbortController();
    if (employeeId) void api<Quota[]>(`/leave-quotas?employee_id=${encodeURIComponent(employeeId)}&quota_year=${year}`, { signal: abort.signal }).then(setQuotas).catch((cause) => { if (!abort.signal.aborted) setError(cause.message); });
    return () => abort.abort();
  }, [employeeId, year]);
  const saveType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError(""); setNotice("");
    const quotaType = String(form.get("quota_type"));
    try {
      await api(`/leave-types${editing ? `/${editing.id}` : ""}`, { method: editing ? "PATCH" : "POST", body: JSON.stringify({
        code: form.get("code"), name_th: form.get("name_th"), quota_type: quotaType,
        quota_days: quotaType === "fixed" ? String(form.get("quota_days")) : null,
        is_deductible: form.get("is_deductible") === "on", requires_document: form.get("requires_document") === "on",
        allow_exceed: form.get("allow_exceed") === "on", is_active: form.get("is_active") === "on",
      }) });
      setTypes(await api<Type[]>("/leave-types/manage")); setEditing(null); setNotice("บันทึกประเภทการลาแล้ว"); onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const saveQuota = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError(""); setNotice("");
    try {
      await api("/leave-quotas", { method: "PUT", body: JSON.stringify({ employee_id: employeeId, leave_type_id: form.get("leave_type_id"), quota_year: year, entitled_days: form.get("entitled_days") }) });
      setQuotas(await api<Quota[]>(`/leave-quotas?employee_id=${employeeId}&quota_year=${year}`)); setNotice("บันทึกสิทธิ์วันลาแล้ว จำนวนวันที่ใช้ไปคงเดิม");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  return <details className="workspace-section"><summary className="cursor-pointer text-xl font-semibold">จัดการประเภทและสิทธิ์วันลา (HR / เจ้าของ)</summary>
    <p className="mt-3 text-sm text-[var(--muted)]">ประเภทที่ใช้งานแล้วเปลี่ยนได้เฉพาะชื่อและสถานะ เมื่อต้องการเปลี่ยนนโยบายให้สร้างประเภทใหม่ เพื่อรักษาประวัติการคำนวณ</p>
    {error && <Feedback kind="error" detail={error} />}{notice && <Feedback kind="success" detail={notice} />}
    <div className="mt-5 grid gap-6 xl:grid-cols-2">
      <form key={editing?.id ?? "new"} onSubmit={saveType} className="space-y-3"><h3 className="font-semibold">{editing ? `แก้ไข ${editing.nameTh}` : "เพิ่มประเภทการลา"}</h3>
        <label className="block text-sm">รหัสประเภท<input className={control} name="code" defaultValue={editing?.code} required pattern="[A-Z][A-Z0-9_]{0,29}" placeholder="SICK_LEAVE" /></label>
        <label className="block text-sm">ชื่อประเภท<input className={control} name="name_th" defaultValue={editing?.nameTh} required maxLength={100} /></label>
        <label className="block text-sm">รูปแบบสิทธิ์<select className={control} name="quota_type" defaultValue={editing?.quotaType ?? "fixed"}><option value="fixed">จำนวนวันคงที่</option><option value="by_seniority">กำหนดตามอายุงานเป็นรายคน</option><option value="none">ไม่จำกัดด้วยโควตา</option></select></label>
        <label className="block text-sm">จำนวนวันมาตรฐาน (สำหรับสิทธิ์คงที่)<input className={control} name="quota_days" type="number" min="0" max="366" step="0.01" defaultValue={editing?.quotaDays ?? "0"} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_deductible" defaultChecked={editing?.isDeductible} /> หักค่าจ้าง</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="requires_document" defaultChecked={editing?.requiresDocument} /> ต้องแนบเอกสารก่อนอนุมัติ</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="allow_exceed" defaultChecked={editing?.allowExceed} /> อนุญาตเกินสิทธิ์ โดยส่วนเกินไม่ได้รับค่าจ้าง</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={editing?.isActive ?? true} /> เปิดใช้งาน</label>
        <div className="flex gap-2"><button className="workspace-primary" disabled={busy}>บันทึกประเภท</button>{editing && <button className="workspace-secondary" type="button" onClick={() => setEditing(null)}>เพิ่มประเภทใหม่</button>}</div>
      </form>
      <section><h3 className="font-semibold">ประเภททั้งหมด</h3><ul className="mt-3 space-y-3">{types.map((type) => <li key={type.id} className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3"><span>{type.nameTh} · {type.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</span><button type="button" className="workspace-secondary" onClick={() => setEditing(type)} disabled={busy}>แก้ไข</button></li>)}</ul></section>
      <form onSubmit={saveQuota} className="space-y-3"><h3 className="font-semibold">กำหนดสิทธิ์รายปี</h3>
        <label className="block text-sm">พนักงาน<EmployeePicker value={employeeId} onChange={(id) => { setQuotas([]); setEmployeeId(id); }} className={control} required /></label>
        <label className="block text-sm">ปี ค.ศ.<input className={control} type="number" min="2000" max="2200" value={year} onChange={(event) => { setQuotas([]); setYear(Number(event.target.value)); }} required /></label>
        <label className="block text-sm">ประเภทการลา<select className={control} name="leave_type_id" required><option value="">เลือกประเภท</option>{types.filter((type) => type.isActive && type.quotaType !== "none").map((type) => <option key={type.id} value={type.id}>{type.nameTh}</option>)}</select></label>
        <label className="block text-sm">สิทธิ์ทั้งหมด (วัน)<input className={control} name="entitled_days" type="number" min="0" max="366" step="0.01" required /></label>
        <button className="workspace-primary" disabled={busy || !employeeId}>บันทึกสิทธิ์วันลา</button>
      </form>
      <section><h3 className="font-semibold">สิทธิ์และยอดใช้ปี {year}</h3>{!employeeId ? <p className="mt-3 text-sm">เลือกพนักงานเพื่อดูสิทธิ์</p> : <ul className="mt-3 space-y-3">{quotas.map((quota) => <li key={quota.id}>{types.find((type) => type.id === quota.leaveTypeId)?.nameTh ?? "ประเภทที่ปิดใช้งาน"}: ใช้ {quota.usedDays} / {quota.entitledDays} วัน {quota.frozenAt ? "· ล็อกสิทธิ์แล้ว" : ""}</li>)}{!quotas.length && <li>ยังไม่มีสิทธิ์ในปีนี้</li>}</ul>}</section>
    </div>
  </details>;
}
