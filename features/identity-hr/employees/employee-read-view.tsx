"use client";

import { useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { authApi } from "@/lib/auth/auth-api";
import type {
  BankAccountSummary,
  EmployeeSummary,
  WeeklyHolidayItem,
} from "../contracts/types";
import { EmployeeTabs, StatusBadge, styles } from "../ui/primitives";
import { RequestState } from "../ui/request-states";
import { employeeReadApi, type EmployeeAssignment } from "./employee-read-api";
import { EmployeeProfile } from "./employee-profile";
import { EmployeeWriteControls } from "./employee-write-controls";

type View = "profile" | "employment" | "bank" | "weekly-holidays";
type Related =
  | EmployeeAssignment[]
  | BankAccountSummary[]
  | WeeklyHolidayItem[];
type ReadState =
  | { kind: "loading" }
  | { kind: "error"; error: unknown }
  | { kind: "ready"; employee: EmployeeSummary; related: Related };
const titles: Record<View, string> = {
  profile: "แฟ้มพนักงาน",
  employment: "ประวัติการจ้าง",
  bank: "บัญชีรับเงิน",
  "weekly-holidays": "วันหยุดประจำสัปดาห์",
};
const weekdayLabels = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];
const employmentLabels = {
  full_time: "เต็มเวลา",
  part_time: "พาร์ตไทม์",
  temporary: "ชั่วคราว",
};

export function EmployeeReadView({
  employeeId,
  view,
}: {
  employeeId: string;
  view: View;
}) {
  const [state, setState] = useState<ReadState>({ kind: "loading" });
  const [refresh, setRefresh] = useState(0);
  const [canManage, setCanManage] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    authApi
      .current()
      .then((actor) => {
        if (active)
          setCanManage(
            actor.grants.some(
              (grant) =>
                grant.scope === "all" &&
                (grant.role_code === "HR" || grant.role_code === "OWNER"),
            ),
          );
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
      .get(employeeId, controller.signal)
      .then(async (employee) => {
        const related =
          view === "employment"
            ? await employeeReadApi.assignments(employeeId, controller.signal)
            : view === "bank"
              ? await employeeReadApi.bankAccounts(
                  employeeId,
                  controller.signal,
                )
              : view === "weekly-holidays"
                ? await employeeReadApi.weeklyHolidays(
                    employeeId,
                    controller.signal,
                  )
                : [];
        if (!controller.signal.aborted)
          setState({ kind: "ready", employee, related });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ kind: "error", error });
      });
    return () => controller.abort();
  }, [employeeId, refresh, view]);

  const retry = () => {
    setState({ kind: "loading" });
    setRefresh((value) => value + 1);
  };
  const apiError =
    state.kind === "error" && state.error instanceof ApiClientError
      ? state.error
      : null;
  return (
    <div className={styles.scope}>
      <div className={styles.frame}>
        <div className={styles.sectionHead}>
          <div>
            <h1>{titles[view]}</h1>
            <p className={styles.muted}>
              ข้อมูลตามสิทธิ์ของบัญชีที่เข้าสู่ระบบ
            </p>
          </div>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            type="button"
            onClick={retry}
          >
            โหลดใหม่
          </button>
        </div>
        {notice && (
          <RequestState kind="success" title="บันทึกสำเร็จ" detail={notice} />
        )}
        {state.kind === "loading" ? (
          <RequestState
            kind="loading"
            title="กำลังโหลดข้อมูล"
            detail="รอสักครู่"
          />
        ) : state.kind === "error" ? (
          <RequestState
            kind={
              apiError?.status === 403
                ? "forbidden"
                : apiError?.status === 404
                  ? "empty"
                  : "error"
            }
            title={
              apiError?.status === 403
                ? "ไม่มีสิทธิ์ดูข้อมูลนี้"
                : apiError?.status === 404
                  ? "ไม่พบข้อมูลที่คุณเปิดดูได้"
                  : "โหลดข้อมูลไม่สำเร็จ"
            }
            detail={
              apiError?.status === 404
                ? "ตรวจสอบลิงก์หรือกลับไปยังทะเบียนพนักงาน"
                : (apiError?.message ?? "ลองโหลดใหม่อีกครั้ง")
            }
          />
        ) : view === "profile" ? (
          <EmployeeProfile employee={state.employee} />
        ) : (
          <section aria-label={titles[view]}>
            <div className={styles.sectionHead}>
              <div>
                <h2>
                  {state.employee.first_name} {state.employee.last_name}
                </h2>
                <p className={styles.muted}>{state.employee.employee_code}</p>
              </div>
              <StatusBadge>{state.related.length} รายการ</StatusBadge>
            </div>
            <EmployeeTabs id={state.employee.id} />
            {state.related.length === 0 ? (
              <RequestState
                kind="empty"
                title="ยังไม่มีรายการ"
                detail="ไม่พบข้อมูลในหมวดนี้"
              />
            ) : view === "employment" ? (
              <ol className={styles.timeline}>
                {(state.related as EmployeeAssignment[]).map((item) => (
                  <li className={styles.timelineItem} key={item.id}>
                    <div className={styles.sectionHead}>
                      <h3>ตำแหน่ง #{item.position_id}</h3>
                      {item.effective_to === null && (
                        <StatusBadge>ช่วงปัจจุบัน</StatusBadge>
                      )}
                    </div>
                    <dl className={styles.kv}>
                      <div>
                        <dt>สาขา / แผนก</dt>
                        <dd>
                          #{item.branch_id} / #{item.department_id}
                        </dd>
                      </div>
                      <div>
                        <dt>ประเภทการจ้าง</dt>
                        <dd>{employmentLabels[item.employment_type]}</dd>
                      </div>
                      <div>
                        <dt>ช่วงวันที่</dt>
                        <dd>
                          {item.effective_from} –{" "}
                          {item.effective_to ?? "ปัจจุบัน"}
                        </dd>
                      </div>
                      <div>
                        <dt>เงินเดือนฐาน</dt>
                        <dd>฿{item.base_salary}</dd>
                      </div>
                      <div>
                        <dt>สวัสดิการ</dt>
                        <dd>฿{item.welfare_amount}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
            ) : view === "bank" ? (
              <ul className={styles.grid}>
                {(state.related as BankAccountSummary[]).map((item) => (
                  <li className={styles.span6} key={item.id}>
                    <article className={styles.panel}>
                      <div className={styles.sectionHead}>
                        <h3>{item.bank_name}</h3>
                        {item.is_primary && (
                          <StatusBadge>บัญชีหลัก</StatusBadge>
                        )}
                      </div>
                      <dl className={styles.kv}>
                        <div>
                          <dt>ชื่อบัญชี</dt>
                          <dd>{item.account_holder_name}</dd>
                        </div>
                        <div>
                          <dt>เลขบัญชี</dt>
                          <dd>{item.account_number_masked}</dd>
                        </div>
                        <div>
                          <dt>สถานะ</dt>
                          <dd>{item.is_active ? "ใช้งาน" : "ยกเลิกแล้ว"}</dd>
                        </div>
                      </dl>
                    </article>
                  </li>
                ))}
              </ul>
            ) : (
              <ol className={styles.timeline}>
                {(state.related as WeeklyHolidayItem[]).map((item) => (
                  <li className={styles.timelineItem} key={item.id}>
                    <div className={styles.sectionHead}>
                      <h3>วัน{weekdayLabels[item.weekday] ?? item.weekday}</h3>
                      {item.effective_to === null && (
                        <StatusBadge>ช่วงปัจจุบัน</StatusBadge>
                      )}
                    </div>
                    <p className={styles.muted}>
                      {item.effective_from} – {item.effective_to ?? "ปัจจุบัน"}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            {canManage && (
              <EmployeeWriteControls
                employeeId={employeeId}
                view={view}
                related={state.related}
                onSuccess={(message) => {
                  setNotice(message);
                  retry();
                }}
              />
            )}
          </section>
        )}
      </div>
    </div>
  );
}
