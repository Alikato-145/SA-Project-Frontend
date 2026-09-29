"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Feedback, PageHeader } from "@/components/workspace-ui";
export default function ReportsPage() {
  const [periodId, setPeriodId] = useState(""); const [message, setMessage] = useState("");
  const download = (kind: "bank-transfer" | "social-security") => { if (!periodId) return setMessage("กรุณาระบุรหัสรอบเงินเดือนที่ล็อกแล้ว"); window.open(`/api/v1/reports/${kind}.csv?period_id=${encodeURIComponent(periodId)}`, "_blank", "noopener,noreferrer"); setMessage("กำลังเปิดไฟล์ CSV ในหน้าต่างใหม่"); };
  return <div className="space-y-6"><PageHeader title="รายงานส่งออก" description="ส่งออกได้เฉพาะข้อมูลจากรอบเงินเดือนที่ล็อกแล้ว" /><section className="max-w-xl space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><h2 className="text-xl font-semibold">เลือกรอบเงินเดือน</h2><p className="text-sm leading-6 text-[var(--muted)]">หากยังไม่มีรอบที่ล็อกแล้ว ให้ดำเนินการที่หน้าเงินเดือนก่อน แล้วใช้รหัสรอบจากหน้านั้น</p><label className="block text-sm">รหัสรอบเงินเดือน<input className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2" inputMode="numeric" value={periodId} onChange={(event) => setPeriodId(event.target.value)} /></label><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => download("bank-transfer")}>ไฟล์โอนเงินธนาคาร (CSV)</Button><Button type="button" variant="outline" onClick={() => download("social-security")}>รายงานประกันสังคม (CSV)</Button></div>{message ? <Feedback kind={periodId ? "success" : "warning"} detail={message} /> : null}</section></div>;
}
