"use client";

import { useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { employeeApi, type Employee } from "@/lib/employee/employee-api";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try { setEmployees(await employeeApi.list()); }
    catch (error) { setMessage(error instanceof ApiClientError ? error.message : "ไม่สามารถโหลดรายชื่อพนักงานได้"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    void employeeApi.list()
      .then((rows) => { if (active) setEmployees(rows); })
      .catch((error) => { if (active) setMessage(error instanceof ApiClientError ? error.message : "ไม่สามารถโหลดรายชื่อพนักงานได้"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      const employee = await employeeApi.create({
        employee_code: String(form.get("employee_code") ?? ""),
        national_id: String(form.get("national_id") ?? ""),
        first_name: String(form.get("first_name") ?? ""),
        last_name: String(form.get("last_name") ?? ""),
        hire_date: String(form.get("hire_date") ?? ""),
      });
      setEmployees((current) => [...current, employee]);
      event.currentTarget.reset();
      setMessage(`สร้าง ${employee.employee_code} แล้ว`);
    } catch (error) { setMessage(error instanceof ApiClientError ? error.message : "ไม่สามารถสร้างพนักงานได้"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-8">
      <header className="border-b border-[var(--line)] pb-6"><p className="text-sm font-semibold text-[var(--accent)]">HR master data</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">ทะเบียนพนักงาน</h1><p className="mt-2 text-[var(--muted)]">ข้อมูลที่แสดงและสร้างถูกตรวจสิทธิ์จาก A3 บนเซิร์ฟเวอร์</p></header>
      {message && <p role="status" className="border border-[var(--line)] bg-[var(--surface)] p-4 text-sm">{message}</p>}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="border-y border-[var(--line)]"><div className="flex items-center justify-between py-3"><h2 className="font-semibold">รายชื่อที่มองเห็นได้</h2><button type="button" className="text-sm underline" onClick={() => void load()} disabled={loading}>โหลดใหม่</button></div>{loading ? <p className="border-t border-[var(--line)] py-6 text-[var(--muted)]">กำลังโหลด…</p> : employees.length === 0 ? <p className="border-t border-[var(--line)] py-6 text-[var(--muted)]">ยังไม่มีพนักงานในขอบเขตนี้</p> : <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">{employees.map((employee) => <li key={employee.id} className="py-4"><strong>{employee.employee_code} · {employee.first_name} {employee.last_name}</strong><span className="ml-2 text-sm text-[var(--muted)]">{employee.status}</span></li>)}</ul>}</div>
        <form onSubmit={create} className="space-y-3 border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="font-semibold">สร้างพนักงาน</h2><label className="block text-sm">รหัสพนักงาน<input className="mt-1 w-full border border-[var(--line)] p-2" name="employee_code" required maxLength={30} /></label><label className="block text-sm">เลขบัตรประชาชน<input className="mt-1 w-full border border-[var(--line)] p-2" name="national_id" required maxLength={20} inputMode="numeric" /></label><label className="block text-sm">ชื่อ<input className="mt-1 w-full border border-[var(--line)] p-2" name="first_name" required maxLength={100} /></label><label className="block text-sm">นามสกุล<input className="mt-1 w-full border border-[var(--line)] p-2" name="last_name" required maxLength={100} /></label><label className="block text-sm">วันเริ่มงาน<input className="mt-1 w-full border border-[var(--line)] p-2" name="hire_date" type="date" required /></label><button className="w-full bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={busy}>{busy ? "กำลังบันทึก…" : "สร้างพนักงาน"}</button></form>
      </section>
    </div>
  );
}
