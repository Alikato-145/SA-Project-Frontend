"use client";

import { useEffect, useId, useState } from "react";
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
