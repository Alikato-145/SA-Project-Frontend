"use client";
import { useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api/client";
import type { EmployeeSummary, EmployeeStatus } from "../contracts/types";
import { Field, styles } from "../ui/primitives";

export function EmployeeProfileControls({ employee, onSaved }: { employee: EmployeeSummary; onSaved(message: string): void }) {
  const [status, setStatus] = useState<EmployeeStatus>(employee.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (event: FormEvent<HTMLFormElement>, changeStatus: boolean) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (changeStatus && status === "terminated" && !window.confirm(`สิ้นสุดการจ้างหลังวันทำงานสุดท้าย ${form.get("terminated_at")} หรือไม่? ประวัติการจ้างจะจบช่วงวันที่โดยเก็บข้อมูลเดิมไว้`)) return;
    setBusy(true); setError("");
    const payload = changeStatus ? { status, terminated_at: status === "terminated" ? form.get("terminated_at") : null, reason: form.get("reason") }
      : { first_name: form.get("first_name"), last_name: form.get("last_name"), phone: form.get("phone") || null, personal_email: form.get("personal_email") || null, address: form.get("address") || null };
    try {
      await apiRequest(`/v1/employees/${employee.id}${changeStatus ? "/status" : ""}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      onSaved(changeStatus ? "บันทึกสถานะและประวัติการจ้างแล้ว" : "บันทึกข้อมูลพนักงานแล้ว");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  return <div className="mt-6 space-y-4">
    {error && <p role="alert" className="text-red-800">{error}</p>}
    <details className={styles.panel}><summary className="cursor-pointer font-semibold">แก้ข้อมูลติดต่อพนักงาน</summary>
      <form onSubmit={event => void save(event, false)} className="mt-4 space-y-3">
        <Field label="ชื่อ"><input className={styles.input} name="first_name" defaultValue={employee.first_name} required maxLength={100} /></Field>
        <Field label="นามสกุล"><input className={styles.input} name="last_name" defaultValue={employee.last_name} required maxLength={100} /></Field>
        <Field label="โทรศัพท์"><input className={styles.input} name="phone" defaultValue={employee.phone ?? ""} maxLength={30} /></Field>
        <Field label="อีเมลส่วนตัว"><input className={styles.input} name="personal_email" type="email" defaultValue={employee.personal_email ?? ""} maxLength={255} /></Field>
        <Field label="ที่อยู่"><textarea className={styles.textarea} name="address" defaultValue={employee.address ?? ""} maxLength={2000} /></Field>
        <button className={styles.button} disabled={busy}>บันทึกข้อมูลพนักงาน</button>
      </form>
    </details>
    <details className={styles.panel}><summary className="cursor-pointer font-semibold">เปลี่ยนสถานะพนักงาน</summary>
      <form onSubmit={event => void save(event, true)} className="mt-4 space-y-3">
        <p className={styles.muted}>สิ้นสุดการจ้างจะจบช่วงประวัติการจ้างที่วันทำงานสุดท้าย และเก็บเงินเดือนเดิมไว้ งวดที่ล็อกแล้วเปลี่ยนย้อนหลังไม่ได้</p>
        <Field label="สถานะใหม่"><select className={styles.select} value={status} onChange={event => setStatus(event.target.value as EmployeeStatus)}><option value="active">ทำงานอยู่</option><option value="inactive">พักการใช้งาน</option><option value="suspended">ระงับชั่วคราว</option><option value="terminated">สิ้นสุดการจ้าง</option></select></Field>
        {status === "terminated" && <Field label="วันทำงานสุดท้าย"><input className={styles.input} name="terminated_at" type="date" required min={employee.hire_date} defaultValue={employee.terminated_at ?? ""} /></Field>}
        <Field label="เหตุผลเปลี่ยนสถานะ"><textarea className={styles.textarea} name="reason" required maxLength={500} /></Field>
        <button className={styles.button} disabled={busy}>บันทึกสถานะพนักงาน</button>
      </form>
    </details>
  </div>;
}
