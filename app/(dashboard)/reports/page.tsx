"use client";
import { useEffect, useState } from "react";
import { ReportDetails, type ReportKind } from "@/components/report-details";
import { Button } from "@/components/ui/button";
import { Feedback, PageHeader, thaiLabel, formatThaiMoney } from "@/components/workspace-ui";
import { PayrollPeriodPicker } from "@/components/payroll-period-picker";
import { type BranchChoice, type DepartmentChoice } from "@/features/identity-hr/onboarding/onboarding-api";
import { organizationApi } from "@/lib/organization/organization-api";
import { apiRequest } from "@/lib/api/client";
import { downloadApiFile } from "@/lib/api/download";
import type { PayrollPeriod } from "@/lib/payroll/payroll-api";

type Group = { status?: string; kind?: string; count: number; days?: string | null; hours?: string | null; amount?: string | null; earnings?: string | null; deductions?: string | null; net?: string | null };
type Summary = { attendance: Group[]; leave: Group[]; overtime: Group[]; debt: Group[]; payroll: Group[] };
const groups = { attendance: "การลงเวลา", leave: "คำขอลา", overtime: "OT", debt: "รายการหนี้", payroll: "เงินเดือน" } as const;
export default function ReportsPage() {
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [branches, setBranches] = useState<BranchChoice[]>([]);
  const [departments, setDepartments] = useState<DepartmentChoice[]>([]);
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [detailKind, setDetailKind] = useState<ReportKind | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const shopId = period?.shop_id;
  useEffect(() => {
    if (!shopId) return;
    const abort = new AbortController();
    void organizationApi.listBranches(shopId, abort.signal).then(setBranches).catch((cause) => { if (!abort.signal.aborted) setError(cause.message); });
    return () => abort.abort();
  }, [shopId]);
  useEffect(() => {
    if (!branchId) return;
    const abort = new AbortController();
    void organizationApi.listDepartments(branchId, abort.signal).then(setDepartments).catch((cause) => { if (!abort.signal.aborted) setError(cause.message); });
    return () => abort.abort();
  }, [branchId]);
  const summaryQuery = () => new URLSearchParams({ period_id: period!.id, ...(branchId ? { branch_id: branchId } : {}), ...(departmentId ? { department_id: departmentId } : {}) });
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(""); setMessage("");
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดรายงานไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const download = (kind: "bank-transfer" | "period-bank-transfer" | "social-security" | "social-security-all" | "salary-summary" | "creditor-summary") => {
    if (!period) return;
    const extension = kind.endsWith("summary") ? "pdf" : "csv";
    const endpoint = kind === "social-security-all" ? "social-security" : kind;
    void run(async () => { await downloadApiFile(`/v1/reports/${endpoint}.${extension}?${kind === "period-bank-transfer" || kind === "social-security-all" ? new URLSearchParams({ period_id: period.id }) : summaryQuery()}`, `${kind}-${period.period_year}-${period.period_month}.${extension}`); setMessage("ดาวน์โหลดไฟล์แล้ว"); });
  };
  return <div className="space-y-7"><PageHeader title="รายงานและส่งออก" description="ตรวจสรุปการลงเวลา การลา OT หนี้ และเงินเดือน ส่งออก PDF และ CSV ได้เมื่อรอบถูกล็อกแล้ว" />
    <section className="workspace-section space-y-4"><h2 className="text-xl font-semibold">เลือกรอบเงินเดือน</h2><PayrollPeriodPicker value={period?.id ?? ""} onChange={(value) => { setPeriod(value); setBranches([]); setDepartments([]); setBranchId(""); setDepartmentId(""); setSummary(null); setDetailKind(null); setError(""); setMessage(""); }} />
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">สาขา<select className="workspace-control" value={branchId} disabled={!period} onChange={(event) => { setBranchId(event.target.value); setDepartments([]); setDepartmentId(""); setSummary(null); setDetailKind(null); }}><option value="">ทุกสาขาในร้าน</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}</select></label><label className="block text-sm">แผนก<select className="workspace-control" value={departmentId} disabled={!branchId} onChange={(event) => { setDepartmentId(event.target.value); setSummary(null); setDetailKind(null); }}><option value="">ทุกแผนก</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}</select></label></div>
      <div className="border-t border-[var(--line)] pt-4 space-y-3">
        <h3 className="font-semibold">ตรวจและส่งออกข้อมูลสรุป</h3>
        <p className="text-sm text-[var(--muted)]">เลือกสาขาหรือแผนก แล้วตรวจรายงานและส่งออก CSV เพื่อนำไปจัดรูปแบบหรือแยกข้อมูลภายนอกระบบ</p>
        <div className="flex flex-wrap gap-2"><Button disabled={busy || !period} onClick={() => { if (period) void run(async () => setSummary(await apiRequest<Summary>(`/v1/reports/summary?${summaryQuery()}`, { credentials: "same-origin" }))); }}>ดูรายงานสรุป</Button><Button variant="outline" disabled={busy || !period} onClick={() => { if (period) void run(async () => { await downloadApiFile(`/v1/reports/summary.csv?${summaryQuery()}`, `summary-${period.period_year}-${period.period_month}.csv`); setMessage("ดาวน์โหลดไฟล์แล้ว"); }); }}>ส่งออกสรุปตามตัวกรอง (CSV)</Button><Button variant="outline" disabled={busy || !period} onClick={() => { if (period) void run(async () => { await downloadApiFile(`/v1/reports/employee-salary.csv?${summaryQuery()}`, `employee-salary-${period.period_year}-${period.period_month}.csv`); setMessage("ดาวน์โหลดรายชื่อและยอดเงินเดือนแล้ว"); }); }}>ส่งออกรายชื่อและยอดเงินเดือน (CSV)</Button></div>
      </div>
      <div className="border-t border-[var(--line)] pt-4 space-y-3">
        <h3 className="font-semibold">ส่งออกไฟล์สำหรับดำเนินการภายนอก</h3>
        <p className="text-sm text-[var(--muted)]">เลือกไฟล์โอนเงินธนาคารหรือรายงานประกันสังคมของงวดที่ล็อกแล้ว การดาวน์โหลดไม่ยืนยันว่าจ่ายเงินหรือยื่นประกันสังคมสำเร็จ</p>
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || period?.status !== "locked"} onClick={() => download("period-bank-transfer")}>ไฟล์โอนเงินธนาคาร (CSV)</Button><Button variant="outline" disabled={busy || period?.status !== "locked"} onClick={() => download("social-security-all")}>รายงานประกันสังคม (CSV)</Button></div>
        {period && period.status !== "locked" && <p className="text-sm text-amber-800">ต้องล็อกรอบเงินเดือนก่อนส่งออกไฟล์โอนเงินหรือรายงานประกันสังคม</p>}
        <p className="text-sm text-[var(--muted)]">ไฟล์ธนาคารครอบคลุมทั้งรอบ ใช้บัญชีหลักปัจจุบันและรวมรายการที่อาจบันทึกว่าจ่ายแล้ว กรุณาตรวจยอดและสถานะก่อนนำไปจ่าย รายงานประกันสังคมครอบคลุมทั้งรอบเช่นกัน</p>
      </div>
      <details className="border-t border-[var(--line)] pt-4"><summary className="cursor-pointer font-semibold">ตัวเลือกเพิ่มเติม: รายงาน PDF และไฟล์ที่เตรียมจ่ายแล้ว</summary><p className="mt-2 text-sm text-[var(--muted)]">สรุปเจ้าหนี้หมายถึงเงินเดือนที่ร้านต้องจ่ายให้พนักงาน</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={busy || period?.status !== "locked"} onClick={() => download("salary-summary")}>สรุปเงินเดือน (PDF)</Button><Button variant="outline" disabled={busy || period?.status !== "locked"} onClick={() => download("creditor-summary")}>สรุปเจ้าหนี้เงินเดือน (PDF)</Button><Button variant="outline" disabled={busy || period?.status !== "locked"} onClick={() => download("bank-transfer")}>ไฟล์โอนเงินที่เตรียมจ่ายแล้ว (CSV)</Button><Button variant="outline" disabled={busy || period?.status !== "locked"} onClick={() => download("social-security")}>รายงานประกันสังคมตามตัวกรอง (CSV)</Button></div></details>
      <p className="text-sm text-[var(--muted)]">รายงานลาแสดงเฉพาะจำนวนวันในงวดที่เลือก ขอบเขตหน่วยงานอิงประวัติที่มีผลในวันนั้น ส่วนรายงาน OT แยกชั่วโมงและวัน รายการหนี้แยกการเรียกเก็บและการกลับรายการ</p>
    </section>
    {message && <Feedback kind="success" detail={message} />}{error && <Feedback kind="error" detail={error} />}
    {summary && <section className="grid gap-6 lg:grid-cols-2">{Object.entries(groups).map(([key, label]) => <div key={key} className="workspace-section"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{label}</h2><button className="workspace-secondary" type="button" onClick={() => setDetailKind(key as ReportKind)}>ดูรายการ</button></div>{!summary[key as keyof Summary].length ? <p className="mt-3 text-sm text-[var(--muted)]">ไม่มีรายการ</p> : <ul className="mt-3 space-y-3">{summary[key as keyof Summary].map((row, index) => <li key={index} className="border-b border-[var(--line)] pb-3 text-sm"><strong>{thaiLabel(row.status ?? row.kind ?? "")}</strong> · {row.count} รายการ{row.days && ` · ${row.days} วัน`}{row.hours && ` · ${row.hours} ชั่วโมง`}{row.amount && ` · ${formatThaiMoney(row.amount)}`}{row.earnings && <span className="block">รายได้ {formatThaiMoney(row.earnings)} · หัก {formatThaiMoney(row.deductions ?? "0")} · สุทธิ {formatThaiMoney(row.net ?? "0")}</span>}</li>)}</ul>}</div>)}</section>}
    {period && detailKind && <ReportDetails key={`${period.id}-${detailKind}-${branchId}-${departmentId}`} periodId={period.id} kind={detailKind} branchId={branchId} departmentId={departmentId} onClose={() => setDetailKind(null)} />}
  </div>;
}
