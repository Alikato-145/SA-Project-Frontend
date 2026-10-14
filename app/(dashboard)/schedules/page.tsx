"use client";

import { useEffect, useState } from "react";
import { PageHeader, Feedback } from "@/components/workspace-ui";
import { authApi } from "@/lib/auth/auth-api";
import { ScheduleHolidayControls } from "@/lib/operations/operation-controls";

export default function SchedulesPage() {
  const [canHoliday, setCanHoliday] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void authApi.current().then((actor) => setCanHoliday(actor.grants.some((grant) => ["HR", "OWNER"].includes(grant.role_code))))
      .catch(() => setError("ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองโหลดหน้าใหม่"));
  }, []);
  return <div className="space-y-7">
    <PageHeader title="ตารางเวลาและวันหยุด" description="ตั้งเวลาทำงานของสาขาก่อนลงเวลาและคำนวณเงินเดือน การเปลี่ยนตารางจะเก็บช่วงวันที่เดิมเป็นประวัติ" />
    {error ? <Feedback kind="error" detail={error} /> : null}
    {canHoliday === null ? <p role="status">กำลังตรวจสอบสิทธิ์…</p> : <ScheduleHolidayControls canHoliday={canHoliday} />}
  </div>;
}
