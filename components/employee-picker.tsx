"use client";

import { useEffect, useId, useState } from "react";
import type { EmployeeContext } from "@/lib/auth/auth-api";
import { employeeApi, type Employee } from "@/lib/employee/employee-api";

const label = (employee: Employee) => `${employee.employee_code} · ${employee.first_name} ${employee.last_name}`;

export function EmployeePicker({ value, onChange, className, required = false }: {
  value: string; onChange(value: string): void; className: string; required?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Employee[]>([]);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    let current = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      void employeeApi.list(query).then((rows) => { if (current) setOptions(rows); })
        .catch(() => { if (current) setOptions([]); })
        .finally(() => { if (current) setLoading(false); });
    }, 150);
    return () => { current = false; window.clearTimeout(timeout); };
  }, [active, query]);

  return <div>
    <input className={className} list={listId} value={query} required={required}
      placeholder="ค้นหาชื่อหรือรหัสพนักงาน" autoComplete="off"
      onFocus={() => setActive(true)}
      onChange={(event) => {
        const next = event.target.value;
        setQuery(next);
        const selected = options.find((employee) => label(employee) === next);
        onChange(selected?.id ?? "");
      }} />
    <datalist id={listId}>{options.map((employee) => <option key={employee.id} value={label(employee)} />)}</datalist>
    <p className="mt-1 text-xs text-slate-500" aria-live="polite">{loading ? "กำลังค้นหารายชื่อ…" : value ? "เลือกพนักงานแล้ว" : active && query && options.length === 0 ? "ไม่พบพนักงานที่ค้นหา" : "พิมพ์ชื่อจริงหรือรหัสพนักงาน แล้วเลือกจากรายการ"}</p>
  </div>;
}

export function EmployeeContextPicker({
  context,
  value,
  onChange,
  className,
  selfLabel,
}: {
  context: EmployeeContext | null | undefined;
  value: string;
  onChange(value: string): void;
  className: string;
  selfLabel: string;
}) {
  if (context === undefined)
    return (
      <p className="text-sm font-medium" role="status">
        กำลังตรวจสอบข้อมูลพนักงาน…
      </p>
    );

  if (context === null)
    return (
      <p
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
        role="alert"
      >
        ยังตรวจสอบข้อมูลพนักงานไม่ได้ กรุณาลองโหลดหน้าใหม่
      </p>
    );

  if (context.mode === "management")
    return (
      <label className="block text-sm font-medium">
        พนักงาน
        <EmployeePicker
          className={className}
          required
          value={value}
          onChange={onChange}
        />
        <span className="mt-1 block text-xs text-[var(--muted)]">
          ระบบจะแสดงเฉพาะพนักงานในขอบเขตสิทธิ์ของบัญชีคุณ
        </span>
      </label>
    );

  if (context.mode === "self")
    return (
      <p className="text-sm font-medium">
        {selfLabel}
        <span className="mt-1 block rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 font-normal text-[var(--ink)]">
          {context.employee.display_name}
          <small className="ml-2 text-[var(--muted)]">
            {context.employee.employee_code}
          </small>
        </span>
      </p>
    );

  return (
    <div
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
      role="status"
    >
      <strong className="block">บัญชียังไม่เชื่อมข้อมูลพนักงาน</strong>
      <span>ติดต่อ HR หรือ Owner ให้เชื่อมบัญชีก่อนทำรายการ</span>
    </div>
  );
}
