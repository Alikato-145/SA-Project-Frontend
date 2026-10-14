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
  const download = (kind: "bank-transfer" | "social-security") => {
    if (!period) return;
    void run(async () => { await downloadApiFile(`/v1/reports/${kind}.csv?period_id=${encodeURIComponent(period.id)}`, `${kind}-${period.period_year}-${period.period_month}.csv`); setMessage("ดาวน์โหลดไฟล์แล้ว"); });
  };
  return <div className="space-y-7"><PageHeader title="รายงานและส่งออก" description="ตรวจสรุปการลงเวลา การลา OT หนี้ และเงินเดือน ส่งออก CSV ได้เมื่อรอบถูกล็อกแล้ว" />
    <section className="workspace-section space-y-4"><h2 className="text-xl font-semibold">เลือกรอบเงินเดือน</h2><PayrollPeriodPicker value={period?.id ?? ""} onChange={(value) => { setPeriod(value); setBranches([]); setDepartments([]); setBranchId(""); setDepartmentId(""); setSummary(null); setDetailKind(null); setError(""); setMessage(""); }} />
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">สาขา<select className="workspace-control" value={branchId} disabled={!period} onChange={(event) => { setBranchId(event.target.value); setDepartments([]); setDepartmentId(""); setSummary(null); setDetailKind(null); }}><option value="">ทุกสาขาในร้าน</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}</select></label><label className="block text-sm">แผนก<select className="workspace-control" value={departmentId} disabled={!branchId} onChange={(event) => { setDepartmentId(event.target.value); setSummary(null); setDetailKind(null); }}><option value="">ทุกแผนก</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}</select></label></div>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !period} onClick={() => { if (period) void run(async () => setSummary(await apiRequest<Summary>(`/v1/reports/summary?${summaryQuery()}`, { credentials: "same-origin" }))); }}>ดูรายงานสรุป</Button><Button variant="outline" disabled={busy || !period} onClick={() => { if (period) void run(async () => { await downloadApiFile(`/v1/reports/summary.csv?${summaryQuery()}`, `summary-${period.period_year}-${period.period_month}.csv`); }); }}>ส่งออกสรุปตามตัวกรอง (CSV)</Button><Button variant="outline" disabled={busy || period?.status !== "locked"} onClick={() => download("bank-transfer")}>ไฟล์โอนเงินธนาคาร (CSV)</Button><Button variant="outline" disabled={busy || period?.status !== "locked"} onClick={() => download("social-security")}>รายงานประกันสังคม (CSV)</Button></div>
      <p className="text-sm text-[var(--muted)]">รายงานลาแสดงเฉพาะจำนวนวันในงวดที่เลือก ขอบเขตหน่วยงานอิงประวัติที่มีผลในวันนั้น ส่วนรายงาน OT แยกชั่วโมงและวัน รายการหนี้แยกการเรียกเก็บและการกลับรายการ CSV โอนเงินและประกันสังคมรวมทั้งร้านตามงวดล็อก ส่วน CSV สรุปใช้ตัวกรองที่เลือก CSV เป็นไฟล์เตรียมงาน ไม่ใช่หลักฐานการจ่ายเงินหรือการยื่นประกันสังคม</p>
    </section>
    {message && <Feedback kind="success" detail={message} />}{error && <Feedback kind="error" detail={error} />}
    {summary && <section className="grid gap-6 lg:grid-cols-2">{Object.entries(groups).map(([key, label]) => <div key={key} className="workspace-section"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{label}</h2><button className="workspace-secondary" type="button" onClick={() => setDetailKind(key as ReportKind)}>ดูรายการ</button></div>{!summary[key as keyof Summary].length ? <p className="mt-3 text-sm text-[var(--muted)]">ไม่มีรายการ</p> : <ul className="mt-3 space-y-3">{summary[key as keyof Summary].map((row, index) => <li key={index} className="border-b border-[var(--line)] pb-3 text-sm"><strong>{thaiLabel(row.status ?? row.kind ?? "")}</strong> · {row.count} รายการ{row.days && ` · ${row.days} วัน`}{row.hours && ` · ${row.hours} ชั่วโมง`}{row.amount && ` · ${formatThaiMoney(row.amount)}`}{row.earnings && <span className="block">รายได้ {formatThaiMoney(row.earnings)} · หัก {formatThaiMoney(row.deductions ?? "0")} · สุทธิ {formatThaiMoney(row.net ?? "0")}</span>}</li>)}</ul>}</div>)}</section>}
    {period && detailKind && <ReportDetails key={`${period.id}-${detailKind}-${branchId}-${departmentId}`} periodId={period.id} kind={detailKind} branchId={branchId} departmentId={departmentId} onClose={() => setDetailKind(null)} />}
  </div>;
}
