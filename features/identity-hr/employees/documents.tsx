"use client";

import { AttachmentPanel } from "@/components/attachment-panel";
import { useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import type { EmployeeSummary } from "../contracts/types";
import { EmployeeTabs, styles } from "../ui/primitives";
import { RequestState } from "../ui/request-states";
import { employeeReadApi } from "./employee-read-api";

export function EmployeeDocumentsLive({ employeeId }: { employeeId: string }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; employee: EmployeeSummary }
    | { kind: "error"; error: unknown }
  >({ kind: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    employeeReadApi
      .get(employeeId, controller.signal)
      .then((employee) => {
        if (!controller.signal.aborted) setState({ kind: "ready", employee });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ kind: "error", error });
      });
    return () => controller.abort();
  }, [employeeId, retry]);

  if (state.kind === "loading")
    return (
      <RequestState
        kind="loading"
        title="กำลังโหลดข้อมูลพนักงาน"
        detail="กรุณารอสักครู่"
      />
    );
  if (state.kind === "error") {
    const error = state.error instanceof ApiClientError ? state.error : null;
    return (
      <>
        <RequestState
          kind={
            error?.status === 403
              ? "forbidden"
              : error?.status === 404
                ? "empty"
                : "error"
          }
          title={
            error?.status === 403
              ? "ไม่มีสิทธิ์ดูข้อมูลนี้"
              : error?.status === 404
                ? "ไม่พบข้อมูลที่คุณเปิดดูได้"
                : "โหลดข้อมูลไม่สำเร็จ"
          }
          detail={
            error?.status === 404
              ? "กลับไปยังทะเบียนพนักงานเพื่อเลือกบุคคลในขอบเขตของคุณ"
              : (error?.message ?? "กรุณาลองใหม่")
          }
        />
        <button
          className={styles.button}
          type="button"
          onClick={() => {
            setState({ kind: "loading" });
            setRetry((value) => value + 1);
          }}
        >
          โหลดใหม่
        </button>
      </>
    );
  }
  return <EmployeeDocuments employee={state.employee} />;
}

export function EmployeeDocuments({ employee }: { employee: EmployeeSummary }) {
  return (
    <section aria-labelledby="documents-heading">
      <div className={styles.sectionHead}>
        <div>
          <h2 id="documents-heading">เอกสารของ {employee.first_name}</h2>
          <p className={styles.muted}>{employee.employee_code}</p>
        </div>
      </div>
      <EmployeeTabs id={employee.id} />
      <AttachmentPanel path={`/v1/employees/${employee.id}/attachments`} />
    </section>
  );
}
