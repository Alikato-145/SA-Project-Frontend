"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { EmployeeStatus, EmployeeSummary } from "../contracts/types";
import { previewEmployees } from "../fixtures/preview-data";
import { RequestState } from "../ui/request-states";
import { Field, StatusBadge, styles } from "../ui/primitives";

const statusLabels: Record<EmployeeStatus, string> = {
  active: "ทำงานอยู่",
  inactive: "พักการใช้งาน",
  suspended: "ระงับชั่วคราว",
  terminated: "สิ้นสุดการจ้าง",
};

const statusTone = (status: EmployeeStatus): "ok" | "warn" | "danger" =>
  status === "active" ? "ok" : status === "terminated" ? "danger" : "warn";

const pageSize = 2;

export function EmployeeList({
  employees = previewEmployees,
}: {
  employees?: EmployeeSummary[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | EmployeeStatus>("all");
  const [branchId, setBranchId] = useState("all");
  const [departmentId, setDepartmentId] = useState("all");
  const [page, setPage] = useState(1);

  const branchIds = useMemo(
    () =>
      Array.from(
        new Set(employees.flatMap((employee) => employee.branch_id ?? [])),
      ),
    [employees],
  );
  const departmentIds = useMemo(
    () =>
      Array.from(
        new Set(employees.flatMap((employee) => employee.department_id ?? [])),
      ),
    [employees],
  );

  const matching = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("th");
    return employees.filter((employee) => {
      const searchable =
        `${employee.employee_code} ${employee.first_name} ${employee.last_name}`.toLocaleLowerCase(
          "th",
        );
      return (
        (!keyword || searchable.includes(keyword)) &&
        (status === "all" || employee.status === status) &&
        (branchId === "all" || employee.branch_id === branchId) &&
        (departmentId === "all" || employee.department_id === departmentId)
      );
    });
  }, [branchId, departmentId, employees, search, status]);

  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = matching.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const updateFilters = (update: () => void) => {
    update();
    setPage(1);
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setBranchId("all");
    setDepartmentId("all");
    setPage(1);
  };

  return (
    <section aria-labelledby="employee-list-heading">
      <div className={styles.sectionHead}>
        <div>
          <h2 id="employee-list-heading">พนักงานที่อยู่ในขอบเขตของคุณ</h2>
          <p className={styles.muted}>
            ผลลัพธ์จริงจะถูกจำกัดตามสิทธิ์จากเซิร์ฟเวอร์เสมอ
          </p>
        </div>
        <Link className={styles.button} href="/employees/new">
          เพิ่มพนักงาน
        </Link>
      </div>

      <div className={`${styles.panel} ${styles.toolbar}`}>
        <Field label="ค้นหาชื่อหรือรหัสพนักงาน">
          <input
            className={styles.input}
            type="search"
            value={search}
            onChange={(event) =>
              updateFilters(() => setSearch(event.target.value))
            }
            placeholder="เช่น EMP-0101 หรือ อามีนะห์"
          />
        </Field>
        <Field label="สถานะ">
          <select
            className={styles.select}
            value={status}
            onChange={(event) =>
              updateFilters(() =>
                setStatus(event.target.value as "all" | EmployeeStatus),
              )
            }
          >
            <option value="all">ทุกสถานะ</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="สาขา">
          <select
            className={styles.select}
            value={branchId}
            onChange={(event) =>
              updateFilters(() => setBranchId(event.target.value))
            }
          >
            <option value="all">ทุกสาขาที่มองเห็น</option>
            {branchIds.map((id) => (
              <option key={id} value={id}>
                สาขา #{id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="แผนก">
          <select
            className={styles.select}
            value={departmentId}
            onChange={(event) =>
              updateFilters(() => setDepartmentId(event.target.value))
            }
          >
            <option value="all">ทุกแผนกที่มองเห็น</option>
            {departmentIds.map((id) => (
              <option key={id} value={id}>
                แผนก #{id}
              </option>
            ))}
          </select>
        </Field>
        <button
          className={`${styles.button} ${styles.buttonSecondary}`}
          type="button"
          onClick={resetFilters}
        >
          ล้างตัวกรอง
        </button>
      </div>

      <p className={styles.muted} role="status" aria-live="polite">
        พบ {matching.length} คน · หน้า {safePage} จาก {pageCount}
        {search.trim() ? ` · คำค้น “${search.trim()}”` : ""}
        {status !== "all" ? ` · ${statusLabels[status]}` : ""}
      </p>

      {visible.length === 0 ? (
        <RequestState
          kind="empty"
          title="ไม่พบพนักงานในขอบเขตนี้"
          detail="ลองล้างตัวกรองหรือเปลี่ยนคำค้น ระบบจะไม่เปิดเผยว่ามีพนักงานอยู่นอกขอบเขตหรือไม่"
        />
      ) : (
        <ul className={styles.grid} aria-label="รายชื่อพนักงาน">
          {visible.map((employee) => (
            <li className={styles.span6} key={employee.id}>
              <article className={styles.panel}>
                <div className={styles.sectionHead}>
                  <div>
                    <h3>
                      <Link href={`/employees/${employee.id}`}>
                        {employee.first_name} {employee.last_name}
                      </Link>
                    </h3>
                    <p className={styles.muted}>{employee.employee_code}</p>
                  </div>
                  <StatusBadge tone={statusTone(employee.status)}>
                    {statusLabels[employee.status]}
                  </StatusBadge>
                </div>
                <dl className={styles.kv}>
                  <div>
                    <dt>สาขา</dt>
                    <dd>
                      {employee.branch_id
                        ? `#${employee.branch_id}`
                        : "ยังไม่มีข้อมูล"}
                    </dd>
                  </div>
                  <div>
                    <dt>แผนก</dt>
                    <dd>
                      {employee.department_id
                        ? `#${employee.department_id}`
                        : "ยังไม่มีข้อมูล"}
                    </dd>
                  </div>
                  <div>
                    <dt>ตำแหน่ง</dt>
                    <dd>
                      {employee.position_id
                        ? `#${employee.position_id}`
                        : "ยังไม่มีข้อมูล"}
                    </dd>
                  </div>
                  <div>
                    <dt>ข้อมูลที่แสดง</dt>
                    <dd>
                      {"phone" in employee
                        ? "โปรไฟล์ตามสิทธิ์"
                        : "ข้อมูลทีมพื้นฐาน"}
                    </dd>
                  </div>
                </dl>
              </article>
            </li>
          ))}
        </ul>
      )}

      <nav className={styles.actions} aria-label="แบ่งหน้ารายชื่อพนักงาน">
        <button
          className={`${styles.button} ${styles.buttonSecondary}`}
          type="button"
          disabled={safePage <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          หน้าก่อน
        </button>
        <button
          className={`${styles.button} ${styles.buttonSecondary}`}
          type="button"
          disabled={safePage >= pageCount}
          onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
        >
          หน้าถัดไป
        </button>
      </nav>
    </section>
  );
}
