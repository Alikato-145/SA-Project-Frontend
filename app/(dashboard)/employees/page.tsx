"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { authApi } from "@/lib/auth/auth-api";
import { organizationApi, type Branch } from "@/lib/organization/organization-api";
import type {
  EmployeeStatus,
  EmployeeSummary,
} from "@/features/identity-hr/contracts/types";
import { employeeReadApi } from "@/features/identity-hr/employees/employee-read-api";
import { RequestState } from "@/features/identity-hr/ui/request-states";
import {
  Field,
  StatusBadge,
  styles,
} from "@/features/identity-hr/ui/primitives";

const statuses: Record<EmployeeStatus, string> = {
  active: "ทำงานอยู่",
  inactive: "พักการใช้งาน",
  suspended: "ระงับชั่วคราว",
  terminated: "สิ้นสุดการจ้าง",
};

async function loadInBatches<T, R>(items: T[], load: (item: T) => Promise<R[]>): Promise<R[]> {
  const result: R[] = [];
  for (let start = 0; start < items.length; start += 20) {
    result.push(...(await Promise.all(items.slice(start, start + 20).map(load))).flat());
  }
  return result;
}

export default function EmployeesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | EmployeeStatus>("all");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<{ id: string; branch_id: string; code: string; name: string }[]>([]);
  const [choicesError, setChoicesError] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<EmployeeSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    let active = true;
    authApi
      .current()
      .then(async (actor) => {
        if (active)
          setCanManage(
            actor.grants.some(
              (grant) =>
                (grant.scope === "all" && (grant.role_code === "HR" || grant.role_code === "OWNER")) ||
                (grant.scope === "branch" && grant.role_code === "BRANCH_MANAGER" && grant.branch_id !== null),
            ),
          );
        if (actor.grants.some(grant => grant.scope === "all" || grant.scope === "branch" || grant.scope === "department")) {
          try {
            const shops = await organizationApi.listShops();
            const available = await loadInBatches(shops, shop => organizationApi.listBranches(shop.id));
            const availableDepartments = await loadInBatches(available, branch => organizationApi.listDepartments(branch.id));
            if (active) { setBranches(available); setDepartments(availableDepartments); }
          } catch { if (active) setChoicesError("โหลดรายชื่อสาขาและแผนกไม่สำเร็จ กรุณาโหลดหน้าใหม่"); }
        }
      })
      .catch(() => {
        if (active) setCanManage(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    employeeReadApi
      .list({ page, search, status, branchId, departmentId }, controller.signal)
      .then((result) => {
        setRows(result.data);
        setTotal(result.total);
        setPageSize(result.page_size);
        setError(null);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setRows([]);
          setTotal(0);
          setError(cause);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, refresh, search, status, branchId, departmentId]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setPage(1);
    setSearch(searchInput.trim());
    setRefresh((value) => value + 1);
  };

  const apiError = error instanceof ApiClientError ? error : null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className={styles.scope}>
      <div className={styles.frame}>
        <div className={styles.sectionHead}>
          <div>
            <h1>ทะเบียนพนักงาน</h1>
            <p className={styles.muted}>
              รายชื่อและข้อมูลที่เซิร์ฟเวอร์อนุญาตให้คุณเห็น
            </p>
          </div>
          {canManage && (
            <Link className={styles.button} href="/employees/new">
              เพิ่มพนักงาน
            </Link>
          )}
        </div>
        <div className={styles.grid}>
          <section
            className={`${styles.panel} ${styles.span12}`}
            aria-labelledby="employee-list-heading"
          >
            <h2 id="employee-list-heading">รายชื่อพนักงาน</h2>
            {!loading && !error && (
              <p className={styles.muted} role="status">
                พบ {total} คน · หน้า {page} จาก {pageCount}
              </p>
            )}
            <form className={styles.toolbar} onSubmit={submitSearch}>
              <Field label="ค้นหาชื่อหรือรหัสพนักงาน">
                <input
                  className={styles.input}
                  aria-label="ค้นหาชื่อหรือรหัสพนักงาน"
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  maxLength={150}
                />
              </Field>
              <Field label="สถานะ">
                <select
                  className={styles.select}
                  aria-label="สถานะพนักงาน"
                  value={status}
                  onChange={(event) => {
                    setLoading(true);
                    setPage(1);
                    setStatus(event.target.value as "all" | EmployeeStatus);
                  }}
                >
                  <option value="all">ทุกสถานะ</option>
                  {Object.entries(statuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="สาขา">
                <select className={styles.select} aria-label="สาขา" value={branchId} onChange={(event) => { setLoading(true); setPage(1); setBranchId(event.target.value); setDepartmentId(""); }}>
                  <option value="">ทุกสาขาที่มีสิทธิ์</option>
                  {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}
                  {branches.length === 0 && [...new Set(rows.map(row => row.branch_id).filter((id): id is string => id !== null))].map(id => <option key={id} value={id}>สาขา #{id}</option>)}
                </select>
              </Field>
              <Field label="แผนก">
                <select className={styles.select} aria-label="แผนก" value={departmentId} onChange={(event) => { setLoading(true); setPage(1); setDepartmentId(event.target.value); }}>
                  <option value="">ทุกแผนกที่มีสิทธิ์</option>
                  {departments.filter(department => !branchId || department.branch_id === branchId).map(department => <option key={department.id} value={department.id}>{department.code} · {department.name}{!branchId ? ` · ${branches.find(branch => branch.id === department.branch_id)?.name ?? `สาขา #${department.branch_id}`}` : ""}</option>)}
                  {departments.length === 0 && [...new Set(rows.filter(row => !branchId || row.branch_id === branchId).map(row => row.department_id).filter((id): id is string => id !== null))].map(id => <option key={id} value={id}>แผนก #{id}</option>)}
                </select>
              </Field>
              <button className={styles.button} type="submit">
                ค้นหา
              </button>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                type="button"
                onClick={() => {
                  setLoading(true);
                  setRefresh((value) => value + 1);
                }}
              >
                โหลดใหม่
              </button>
            </form>
            {choicesError && <p role="alert" className={styles.muted}>{choicesError}</p>}
            {loading ? (
              <RequestState
                kind="loading"
                title="กำลังโหลดรายชื่อ"
                detail="รอสักครู่"
              />
            ) : error ? (
              <RequestState
                kind={apiError?.status === 403 ? "forbidden" : "error"}
                title={
                  apiError?.status === 403
                    ? "ไม่มีสิทธิ์ดูรายชื่อนี้"
                    : "โหลดรายชื่อไม่สำเร็จ"
                }
                detail={apiError?.message ?? "ลองโหลดใหม่อีกครั้ง"}
              />
            ) : rows.length === 0 ? (
              <RequestState
                kind="empty"
                title="ไม่พบพนักงานในขอบเขตนี้"
                detail="ลองเปลี่ยนคำค้นหรือสถานะ"
              />
            ) : (
              <ul className={styles.recordList} aria-label="รายชื่อพนักงาน">
                {rows.map((employee) => (
                  <li key={employee.id}>
                    <article className={styles.panel}>
                      <div className={styles.sectionHead}>
                        <div>
                          <h3>
                            <Link href={`/employees/${employee.id}`}>
                              {employee.first_name} {employee.last_name}
                            </Link>
                          </h3>
                          <p className={styles.muted}>
                            {employee.employee_code}
                          </p>
                        </div>
                        <StatusBadge
                          tone={employee.status === "active" ? "ok" : "warn"}
                        >
                          {statuses[employee.status]}
                        </StatusBadge>
                      </div>
                      <p className={styles.muted}>
                        สาขา #{employee.branch_id ?? "ไม่ระบุ"} · แผนก #
                        {employee.department_id ?? "ไม่ระบุ"}
                      </p>
                    </article>
                  </li>
                ))}
              </ul>
            )}
            {!error && (
              <nav
                className={styles.actions}
                aria-label="แบ่งหน้ารายชื่อพนักงาน"
              >
                <button
                  className={`${styles.button} ${styles.buttonSecondary}`}
                  type="button"
                  disabled={loading || page === 1}
                  onClick={() => {
                    setLoading(true);
                    setPage((value) => value - 1);
                  }}
                >
                  หน้าก่อน
                </button>
                <span aria-live="polite">หน้า {page}</span>
                <button
                  className={`${styles.button} ${styles.buttonSecondary}`}
                  type="button"
                  disabled={loading || page >= pageCount}
                  onClick={() => {
                    setLoading(true);
                    setPage((value) => value + 1);
                  }}
                >
                  หน้าถัดไป
                </button>
              </nav>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
