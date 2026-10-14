"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PayrollConfigurationSuccessor } from "@/components/payroll-configuration-successor";
import { PayrollAdjustments } from "@/components/payroll-adjustments";
import { PageHeader } from "@/components/workspace-ui";
import { missingConfigurationCoverage } from "@/lib/payroll/configuration-coverage";
import { payrollMonth } from "@/lib/payroll/payroll-month";
import { ApiClientError } from "../../../lib/api/client";
import { payrollApi, type PayrollConfiguration, type PayrollPeriod, type PayrollPreview, type PayrollRecord, type PayrollRosterEntry, type PayrollReadiness } from "../../../lib/payroll/payroll-api";
import { authApi } from "../../../lib/auth/auth-api";
import { canAccessDashboardPath } from "@/lib/auth/route-access";
import { organizationApi, type Branch, type Shop } from "../../../lib/organization/organization-api";

const field = "workspace-control";
const button = "workspace-primary";
const quietButton = "workspace-secondary";
const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (value: string) => money.format(Number(value));
const messageFor = (cause: unknown) => cause instanceof ApiClientError
  ? `${cause.message} (${cause.code})`
  : cause instanceof Error ? cause.message : "ไม่สามารถทำรายการได้";

const configurationOptions = {
  STANDARD_WORK_DAYS: { label: "จำนวนวันทำงานมาตรฐาน", unit: "days", unitLabel: "วัน" },
  ABSENCE_RATE: { label: "อัตราหักเมื่อขาดงาน", unit: "multiplier", unitLabel: "เท่าของค่าแรงรายวัน" },
  LATE_RATE: { label: "อัตราหักเมื่อมาสาย", unit: "currency_per_minute", unitLabel: "บาทต่อนาที" },
  OT_HOURLY_RATE: { label: "อัตรา OT รายชั่วโมง", unit: "multiplier", unitLabel: "เท่าของค่าแรงรายชั่วโมง" },
  OT_REST_DAY_RATE: { label: "อัตรา OT วันหยุดประจำสัปดาห์", unit: "multiplier", unitLabel: "เท่าของค่าแรงรายวัน" },
  OT_PUBLIC_HOLIDAY_RATE: { label: "อัตรา OT วันหยุดนักขัตฤกษ์", unit: "multiplier", unitLabel: "เท่าของค่าแรงรายวัน" },
  SOCIAL_SECURITY_RATE: { label: "อัตราประกันสังคม", unit: "ratio", unitLabel: "สัดส่วน (เช่น 0.0500 = 5%)" },
  SOCIAL_SECURITY_CAP: { label: "เพดานหักประกันสังคม", unit: "currency", unitLabel: "บาท" },
} as const;
type ConfigurationKey = keyof typeof configurationOptions;
const configurationLabel = (key: string) => configurationOptions[key as ConfigurationKey]?.label ?? key;
const unitLabel = (unit: string) => Object.values(configurationOptions).find((option) => option.unit === unit)?.unitLabel ?? unit;
const periodStatusLabels: Record<string, string> = { draft: "ฉบับร่าง", previewed: "คำนวณแล้ว", locked: "ล็อกแล้ว" };
const itemLabels: Record<string, string> = {
  base_salary: "ค่าแรงพื้นฐานรายวัน", welfare: "สวัสดิการรายวัน", absence: "หักขาดงาน",
  sick_unpaid: "หักลาไม่รับค่าจ้าง", lateness: "หักมาสาย", overtime_hourly: "OT รายชั่วโมง",
  overtime_rest_day: "OT วันหยุดประจำสัปดาห์", overtime_public_holiday: "OT วันหยุดนักขัตฤกษ์",
  social_security: "ประกันสังคม", advance: "เงินเบิกล่วงหน้า", loan_installment: "ค่างวดเงินกู้",
  debt: "หนี้พนักงาน", adjustment: "รายการปรับปรุง", other: "หลักฐานค่าคำนวณ",
};
const blockerLabels: Record<string, string> = {
  PAYROLL_CONFIGURATION_MISSING: "ค่าคำนวณไม่ครบ", PAYROLL_ATTENDANCE_INCOMPLETE: "ข้อมูลลงเวลาไม่ครบ",
  PAYROLL_APPROVALS_PENDING: "ยังมีรายการรออนุมัติ", PAYROLL_ASSIGNMENT_MISSING: "ประวัติการสังกัดไม่ครบ",
  PAYROLL_NEGATIVE_NET_PAY: "เงินสุทธิติดลบ", PAYROLL_TOTAL_MISMATCH: "ยอดรวมไม่ตรงกัน",
  PAYROLL_CALCULATION_OUT_OF_RANGE: "ยอดคำนวณเกินช่วงที่รองรับ",
};
const requiredConfigurationKeys = Object.keys(configurationOptions) as ConfigurationKey[];

export default function PayrollPage() {
  const [shopId, setShopId] = useState("");
  const [shops, setShops] = useState<Shop[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roleCodes, setRoleCodes] = useState<string[]>([]);
  const [accessChecked, setAccessChecked] = useState(false);
  const [configurations, setConfigurations] = useState<PayrollConfiguration[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selected, setSelected] = useState<PayrollPeriod | null>(null);
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [readiness, setReadiness] = useState<PayrollReadiness | null>(null);
  const [roster, setRoster] = useState<PayrollRosterEntry[]>([]);
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  const [record, setRecord] = useState<PayrollRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [canMutate, setCanMutate] = useState<boolean | null>(null);
  const [configurationKey, setConfigurationKey] = useState<ConfigurationKey>("STANDARD_WORK_DAYS");
  const unavailableRole = !canAccessDashboardPath("/payroll", roleCodes);
  const coverage = useMemo(() => selected ? branches.map((branch) => ({ branch, missing: missingConfigurationCoverage(configurations, branch.id, requiredConfigurationKeys, selected.start_date, selected.end_date) })).filter((row) => row.missing.length) : [], [configurations, branches, selected]);
  const employeeLabel = (id: string) => { const row = roster.find((item) => item.employeeId === id); return row ? `${row.employeeCode} · ${row.employeeName}` : `พนักงาน ${id}`; };

  useEffect(() => {
    void authApi.current().then(async (actor) => {
      const codes = actor.grants.map((grant) => grant.role_code);
      setRoleCodes(codes);
      if (!canAccessDashboardPath("/payroll", codes)) return;
      const shopRows = await organizationApi.listShops();
      setShops(shopRows); setShopId((current) => current || shopRows.find(shop => shop.is_active)?.id || shopRows[0]?.id || "");
    }).catch((cause) => setError(messageFor(cause))).finally(() => setAccessChecked(true));
  }, []);
  useEffect(() => {
    if (!shopId) return;
    void organizationApi.listBranches(shopId).then(setBranches).catch((cause) => setError(messageFor(cause)));
  }, [shopId]);
  const archivedShop = shops.some(shop => shop.id === shopId && !shop.is_active);
  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setDetailLoading(true); setReadiness(null);
      void payrollApi.getReadiness(selectedId, { signal: controller.signal }).then((result) => {
        if (!controller.signal.aborted) setReadiness(result.data);
      }).catch((cause) => { if (!controller.signal.aborted) setError(messageFor(cause)); });
      return payrollApi.getPeriod(selectedId, { signal: controller.signal }).then((result) => {
        if (!controller.signal.aborted) {
          // Blocked previews are not persisted; keep their details during the same-period refresh.
          setPreview(current => current?.period.id === selectedId && current.blockers.length > 0 ? current : result.data);
          setRoster(result.data.roster ?? []);
        }
      }).catch((cause) => {
        if (!controller.signal.aborted) setError(messageFor(cause));
      }).finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    });
    return () => controller.abort();
  }, [selectedId, workspaceVersion]);

  const run = async <T,>(work: () => Promise<{ data: T; requestId: string | null }>, onDone: (data: T) => void, noticeText?: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await work(); onDone(result.data); setRequestId(result.requestId);
      if (noticeText) setNotice(noticeText);
    } catch (cause) { setError(messageFor(cause)); }
    finally { setBusy(false); }
  };

  const loadWorkspace = async () => {
    if (!shopId) { setError("เลือกร้านก่อนเปิดสมุดงาน"); return; }
    setLoading(true); setError(""); setNotice(""); setPreview(null); setRecord(null);
    const [accessResult, configResult, periodResult] = await Promise.allSettled([
      payrollApi.getAccess(), payrollApi.listConfigurations(shopId), payrollApi.listPeriods(shopId),
    ]);
    if (accessResult.status === "fulfilled") setCanMutate(accessResult.value.data.can_mutate);
    if (configResult.status === "fulfilled") { setConfigurations(configResult.value.data); setRequestId(configResult.value.requestId); }
    if (periodResult.status === "fulfilled") { setPeriods(periodResult.value.data); setSelected(periodResult.value.data[0] ?? null); setRequestId(periodResult.value.requestId); }
    const failed = [accessResult, configResult, periodResult].find((result) => result.status === "rejected");
    if (failed?.status === "rejected") setError(messageFor(failed.reason));
    setWorkspaceVersion((version) => version + 1); setLoading(false);
  };

  const submitConfiguration = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void run(() => payrollApi.createConfiguration({
      shop_id: shopId, branch_id: String(form.get("branch_id") ?? "") || null,
      config_key: configurationKey, numeric_value: String(form.get("numeric_value")),
      unit: configurationOptions[configurationKey].unit, effective_from: String(form.get("effective_from")), effective_to: null,
    }), (created) => { setConfigurations((rows) => [...rows, created]); setWorkspaceVersion((version) => version + 1); }, "บันทึกค่าคำนวณแล้ว");
  };

  const submitPeriod = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const month = String(form.get("month"));
    let dates;
    try { dates = payrollMonth(month); } catch (cause) { setError(messageFor(cause)); return; }
    const { year, month: monthNumber, start, end } = dates;
    void run(() => payrollApi.createPeriod({ shop_id: shopId, period_year: year, period_month: monthNumber,
      start_date: start, end_date: end }),
    (created) => { setPeriods((rows) => [created, ...rows]); setSelected(created); }, "เปิดรอบเงินเดือนแล้ว");
  };

  const calculate = (mode: "preview" | "lock") => {
    if (!selected) return;
    if (mode === "lock" && !window.confirm("ล็อกรอบนี้หรือไม่? ผลคำนวณและรายการหักจะถูกตรึงเป็นประวัติ")) return;
    void run(() => mode === "preview" ? payrollApi.previewPeriod(selected.id) : payrollApi.lockPeriod(selected.id),
      (result) => { setWorkspaceVersion((version) => version + 1); setPreview(result); setSelected(result.period); setPeriods((rows) => rows.map((row) => row.id === result.period.id ? result.period : row)); },
      mode === "preview" ? "คำนวณตัวอย่างล่าสุดแล้ว" : "ล็อกรอบเงินเดือนแล้ว");
  };

  const showRecord = (row: PayrollRecord) => {
    if (!selected || !row.id) { setRecord(row); return; }
    void run(() => payrollApi.getRecord(selected.id, row.id!), setRecord);
  };

  if (!accessChecked) return <div className="h-32 animate-pulse rounded-lg bg-[var(--line)]" />;
  if (unavailableRole) return <section className="workspace-section max-w-xl"><h1 className="text-2xl font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1><p className="mt-3 leading-7 text-[var(--muted)]">{roleCodes.includes("SUPERVISOR") ? "Supervisor ใช้งาน Attendance และ Leave approval ตามแผนกเมื่อ workflow นั้นเชื่อมเสร็จ" : "Employee ใช้งาน self-service และ payslip เมื่อ feature นั้นพร้อม"}</p></section>;

  return <div className="space-y-7">
    <div>
      <PageHeader title="สมุดงานเงินเดือน" description="ตรวจรายการรายวัน แก้ blocker แล้วจึงล็อกรอบ ข้อมูลที่ล็อกแล้วแก้ผ่าน adjustment เท่านั้น" />
      <form onSubmit={(event) => { event.preventDefault(); void loadWorkspace(); }} className="workspace-filter mt-5 flex w-full flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm sm:w-60">ร้าน<select className={field} value={shopId} onChange={(event) => setShopId(event.target.value)} required><option value="">เลือกร้าน</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.code} · {shop.name}{shop.is_active ? "" : " · ปิดใช้งาน"}</option>)}</select></label>
          <button className={button} disabled={busy || loading || !shopId}>{loading ? "กำลังโหลด…" : "เปิดสมุดงาน"}</button>
      </form>
      {requestId && <p className="mt-3 text-xs text-[var(--muted)]">Request ID: {requestId}</p>}
    </div>

    {notice && <p role="status" className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}
    {error && <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>}
    {canMutate === false && <p className="border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink)]">โหมดอ่านอย่างเดียว: Branch Manager ดูข้อมูลตามสาขาที่ได้รับสิทธิ์ แต่สร้าง คำนวณ หรือล็อกรอบไม่ได้</p>}

    {canMutate === true && <section className="grid gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)] lg:grid-cols-2">
      <details className="bg-[var(--surface)] p-5" open><summary className="cursor-pointer font-semibold">เพิ่มค่าคำนวณแบบ effective-dated</summary>
        <form onSubmit={submitConfiguration} className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">ค่าคำนวณ<select className={field} name="config_key" value={configurationKey} onChange={(event) => setConfigurationKey(event.target.value as ConfigurationKey)}>{Object.entries(configurationOptions).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}</select></label>
          <label className="text-sm">หน่วย<input className={`${field} bg-[var(--canvas)]`} value={configurationOptions[configurationKey].unitLabel} readOnly /></label>
          <label className="text-sm">ค่า<input className={field} name="numeric_value" inputMode="decimal" placeholder="20.0000" required /></label>
          <label className="text-sm">เริ่มใช้<input className={field} name="effective_from" type="date" required /></label>
          <label className="text-sm sm:col-span-2">สาขา <span className="text-[var(--muted)]">(เว้นว่าง = ทั้งร้าน)</span><select className={field} name="branch_id"><option value="">ทั้งร้าน</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}</select></label>
          <button className={`${button} sm:col-span-2 sm:justify-self-start`} disabled={busy || archivedShop}>บันทึกค่าคำนวณ</button>
        </form>
      </details>
      <details className="bg-[var(--surface)] p-5" open><summary className="cursor-pointer font-semibold">เปิดรอบเงินเดือน</summary>
        <form onSubmit={submitPeriod} className="mt-5 flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm">เดือน<input className={field} name="month" type="month" placeholder="2026-10" pattern="[0-9]{4}-(0[1-9]|1[0-2])" aria-describedby="payroll-month-help" required /></label><button className={button} disabled={busy || archivedShop}>เปิดรอบ</button></form>
        <p id="payroll-month-help" className="mt-4 text-sm leading-6 text-[var(--muted)]">ใช้ปี ค.ศ. และเดือน เช่น 2026-10 หมายถึงตุลาคม 2026 หนึ่งร้านเปิดได้หนึ่งรอบต่อเดือน</p>
      </details>
    </section>}

    <section className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside><h2 className="font-semibold">รอบเงินเดือน</h2><div className="mt-3 border-y border-[var(--line)]">
        {periods.length === 0 && <p className="py-5 text-sm text-[var(--muted)]">ยังไม่มีรอบ กด “เปิดสมุดงาน” หรือสร้างรอบใหม่</p>}
        {periods.map((period) => <button key={period.id} disabled={busy || loading} onClick={() => { setSelected(period); setPreview(null); setRecord(null); }} className={`flex w-full items-center justify-between border-b border-[var(--line)] px-2 py-4 text-left text-sm last:border-0 ${selected?.id === period.id ? "bg-[var(--accent-soft)]" : "bg-transparent"}`}><span><strong className="block">{period.period_month.toString().padStart(2, "0")}/{period.period_year}</strong><span className="text-[var(--muted)]">{period.start_date} ถึง {period.end_date}</span></span><span className="rounded-full border border-[var(--line)] bg-white px-2 py-1 text-xs">{periodStatusLabels[period.status] ?? period.status}</span></button>)}
      </div></aside>

      <div className="min-w-0 space-y-6">
        {!selected ? <div className="border border-dashed border-[var(--line)] p-8 text-center text-[var(--muted)]">เลือกรอบเพื่อเริ่มตรวจเงินเดือน</div> : <>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5"><div><h2 className="text-xl font-semibold">งวด {selected.period_month.toString().padStart(2, "0")}/{selected.period_year}</h2><p className="mt-1 text-sm text-[var(--muted)]">สถานะ {periodStatusLabels[selected.status] ?? selected.status}</p></div>{canMutate === true && <div className="flex gap-2"><button className={quietButton} onClick={() => calculate("preview")} disabled={busy || detailLoading || selected.status === "locked"}>คำนวณตัวอย่าง</button><button className={button} onClick={() => calculate("lock")} disabled={busy || detailLoading || selected.status === "locked"}>ล็อกรอบ</button></div>}</div>
          <section className="workspace-section" aria-label="ความพร้อมของงวด">
            <h3 className="font-semibold">ความพร้อมของงวด</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">ตรวจข้อมูลตามช่วงวันที่ก่อนล็อกงวด บัญชีธนาคารจำเป็นสำหรับ CSV โอนเงิน ส่วนการล็อกยังตรวจยอดสุทธิและหลักฐานอีกครั้ง</p>
            {!readiness ? <p role="status" className="mt-3 text-sm">กำลังตรวจความพร้อม…</p> : <ul className="mt-4 space-y-3">{readiness.checks.map((check) => <li key={check.key} className="border-t border-[var(--line)] pt-3 text-sm">
              <strong>{check.label}</strong><span className="ml-2">{({ ready: "พร้อม", not_configured: "ยังไม่ตั้งค่า", invalid: "ข้อมูลไม่ครบ", pending: "รอพิจารณา" })[check.status]}</span>
              {check.issues.length > 0 && <ul className="mt-2 space-y-2">{check.issues.map((issue, index) => <li key={index}><Link href={issue.href} className="underline underline-offset-4">{issue.message}</Link>{issue.dates?.length ? <details className="mt-1"><summary className="cursor-pointer text-[var(--muted)]">วันที่ต้องตรวจ ({issue.dates.length})</summary><p className="mt-1 break-words">{issue.dates.join(", ")}</p></details> : null}</li>)}</ul>}
            </li>)}</ul>}
          </section>
          {preview?.blockers.length ? <div className="border border-amber-300 bg-amber-50 p-4"><h3 className="font-semibold text-amber-950">ยังล็อกรอบไม่ได้</h3><ul className="mt-2 space-y-2 text-sm text-amber-950">{preview.blockers.map((item, index) => <li key={`${item.code}-${index}`}><strong>{blockerLabels[item.code] ?? item.code}</strong>{item.employeeId ? ` · ${item.employeeName ?? employeeLabel(item.employeeId)}` : ""}<br />{item.detail}<br /><Link className="underline" href={item.code === "PAYROLL_ASSIGNMENT_MISSING" ? `/employees/${item.employeeId}/employment` : item.code === "PAYROLL_CONFIGURATION_MISSING" ? "#configuration-readiness" : item.code === "PAYROLL_APPROVALS_PENDING" ? "/leave" : "/attendance"}>ไปตรวจข้อมูลที่เกี่ยวข้อง</Link>{item.code === "PAYROLL_ATTENDANCE_INCOMPLETE" && <Link className="ml-3 underline" href="/schedules">ตรวจตารางสาขา</Link>}</li>)}</ul></div> : null}
          <details className="workspace-section"><summary className="cursor-pointer font-semibold">พนักงานที่มีประวัติการสังกัดในงวดนี้ ({new Set(roster.map((row) => row.employeeId)).size} คน)</summary>
            <p className="mt-3 text-sm text-[var(--muted)]">รายชื่อมาจากประวัติการจ้างที่มีผลในช่วงงวด การผูกบัญชีหรือบทบาทกับสาขาเพียงอย่างเดียวไม่เพิ่มพนักงานในเงินเดือน หากไม่พบรายชื่อ ให้ตรวจวันที่เริ่มงานและประวัติการสังกัด</p>
            <ul className="mt-3 space-y-2 text-sm">{roster.map((row) => <li key={`${row.employeeId}-${row.effectiveFrom}`}><Link className="underline" href={`/employees/${row.employeeId}/employment`}>{row.employeeCode} · {row.employeeName}</Link> · {row.branchName} · {row.effectiveFrom} ถึง {row.effectiveTo ?? "ปัจจุบัน"}{preview?.blockers.some((item) => item.employeeId === row.employeeId) ? " · ต้องแก้ข้อมูลก่อนคำนวณ" : preview?.records.some((item) => item.employee_id === row.employeeId) ? " · มีผลคำนวณแล้ว" : " · ยังไม่มีผลคำนวณ"}</li>)}</ul>
          </details>
          <div className="overflow-x-auto border-y border-[var(--line)]"><table className="w-full min-w-[680px] border-collapse text-sm"><thead><tr className="text-left text-[var(--muted)]"><th className="py-3 pr-4">พนักงาน</th><th className="py-3 pr-4 text-right">รายได้</th><th className="py-3 pr-4 text-right">รายการหัก</th><th className="py-3 pr-4 text-right">สุทธิ</th><th className="py-3 text-right">หลักฐาน</th></tr></thead><tbody>
            {(detailLoading || !preview || preview.records.length === 0) && <tr><td colSpan={5} className="border-t border-[var(--line)] py-8 text-center text-[var(--muted)]">{detailLoading ? "กำลังโหลดรายการเงินเดือน…" : selected.status === "locked" ? "ไม่มีรายการเงินเดือนในงวดที่ล็อกนี้" : "ยังไม่มีรายการเงินเดือน กดคำนวณตัวอย่างหรือตรวจข้อมูลก่อนคำนวณ"}</td></tr>}
            {preview?.records.map((row) => <tr key={row.employee_id} className="border-t border-[var(--line)]"><td className="py-4 pr-4 font-semibold">{employeeLabel(row.employee_id)}<span className="block text-xs font-normal text-[var(--muted)]">{branches.find((branch) => branch.id === row.branch_id)?.name ?? "สาขาตามประวัติการจ้าง"}</span></td><td className="py-4 pr-4 text-right tabular-nums">{formatMoney(row.total_earnings)}</td><td className="py-4 pr-4 text-right tabular-nums">{formatMoney(row.total_deductions)}</td><td className="py-4 pr-4 text-right font-semibold tabular-nums">{formatMoney(row.net_pay)}</td><td className="py-4 text-right"><button className={quietButton} onClick={() => showRecord(row)}>ดู {row.items.length} รายการ</button></td></tr>)}
          </tbody></table></div>
          {record && <section aria-labelledby="record-evidence" className="bg-[var(--ink)] p-5 text-white"><div className="flex items-center justify-between gap-4"><h3 id="record-evidence" className="font-semibold">หลักฐาน {employeeLabel(record.employee_id)}</h3><button className="text-sm underline" onClick={() => setRecord(null)}>ปิด</button></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><dt className="text-white/60">ฐานเงินเดือน</dt><dd>{formatMoney(record.base_salary_snapshot)}</dd></div><div><dt className="text-white/60">สวัสดิการ</dt><dd>{formatMoney(record.welfare_snapshot)}</dd></div><div><dt className="text-white/60">รายได้</dt><dd>{formatMoney(record.total_earnings)}</dd></div><div><dt className="text-white/60">สุทธิ</dt><dd>{formatMoney(record.net_pay)}</dd></div></dl><ul className="mt-5 divide-y divide-white/15">{record.items.map((item, index) => <li key={`${item.item_type}-${item.source_id ?? index}`} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]"><span>{itemLabels[item.item_type] ?? item.description}<span className="block text-xs text-white/60">{item.occurred_on ? `${item.occurred_on} · ` : ""}{item.source_table && item.source_id ? `${item.source_table} #${item.source_id}` : item.item_type}{item.payroll_configuration_id ? ` · config #${item.payroll_configuration_id}` : ""}</span></span><strong className="tabular-nums">{item.direction === "deduction" ? "−" : "+"}{formatMoney(item.amount)}</strong></li>)}</ul></section>}
        </>}
      </div>
    </section>

    {canMutate === true && <PayrollAdjustments />}

    <details id="configuration-readiness" className="border-t border-[var(--line)] pt-5"><summary className="cursor-pointer font-semibold">ความพร้อมของค่าคำนวณ ({configurations.length})</summary><div className="mt-4 grid gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]"><div className="bg-[var(--accent-soft)] p-4 text-sm"><strong className="block">ก่อน preview/lock</strong><p className="mt-2 leading-6">{!selected ? "เลือกงวดเพื่อตรวจช่วงวันที่" : coverage.length ? coverage.map(({ branch, missing }) => `${branch.name}: ${missing.map((item) => `${configurationLabel(item.key)} (เริ่มขาด ${item.date})`).join(" · ")}`).join("; ") : "ค่าคำนวณครอบคลุมทุกวันของงวดในสาขาที่แสดงแล้ว"}</p>{shops.length === 0 ? <Link href="/settings" className="mt-3 inline-block font-semibold underline underline-offset-4">ไปเพิ่มร้าน</Link> : null}</div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="text-left text-[var(--muted)]"><th className="py-2">ค่า</th><th>ขอบเขต</th><th>ตัวเลข</th><th>เริ่มใช้</th></tr></thead><tbody>{configurations.map((row) => <tr key={row.id} className="border-t border-[var(--line)]"><td className="py-3 font-medium">{configurationLabel(row.config_key)}<span className="block font-mono text-xs font-normal text-[var(--muted)]">{row.config_key}</span></td><td>{row.branch_id ? branches.find((branch) => branch.id === row.branch_id)?.name ?? "สาขาตามประวัติ" : "ทั้งร้าน"}</td><td>{row.numeric_value} {unitLabel(row.unit)}</td><td>{row.effective_from} ถึง {row.effective_to ?? "ปัจจุบัน"}{canMutate && !archivedShop && <PayrollConfigurationSuccessor configuration={row} onSaved={() => { void loadWorkspace(); }} />}</td></tr>)}</tbody></table></div></div></details>
  </div>;
}
