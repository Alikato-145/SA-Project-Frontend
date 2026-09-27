"use client";

import { useState } from "react";
import { ApiClientError } from "../../../lib/api/client";
import { payrollApi, type PayrollConfiguration, type PayrollPeriod, type PayrollPreview, type PayrollRecord } from "../../../lib/payroll/payroll-api";

const field = "mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-sm";
const button = "rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45";
const quietButton = "rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-45";
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
};

export default function PayrollPage() {
  const [shopId, setShopId] = useState("1");
  const [configurations, setConfigurations] = useState<PayrollConfiguration[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selected, setSelected] = useState<PayrollPeriod | null>(null);
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [record, setRecord] = useState<PayrollRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [canMutate, setCanMutate] = useState<boolean | null>(null);
  const [configurationKey, setConfigurationKey] = useState<ConfigurationKey>("STANDARD_WORK_DAYS");

  const run = async <T,>(work: () => Promise<{ data: T; requestId: string | null }>, onDone: (data: T) => void, noticeText?: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await work(); onDone(result.data); setRequestId(result.requestId);
      if (noticeText) setNotice(noticeText);
    } catch (cause) { setError(messageFor(cause)); }
    finally { setBusy(false); }
  };

  const loadWorkspace = async () => {
    setLoading(true); setError(""); setNotice(""); setPreview(null); setRecord(null);
    const [accessResult, configResult, periodResult] = await Promise.allSettled([
      payrollApi.getAccess(), payrollApi.listConfigurations(shopId), payrollApi.listPeriods(shopId),
    ]);
    if (accessResult.status === "fulfilled") setCanMutate(accessResult.value.data.can_mutate);
    if (configResult.status === "fulfilled") { setConfigurations(configResult.value.data); setRequestId(configResult.value.requestId); }
    if (periodResult.status === "fulfilled") { setPeriods(periodResult.value.data); setSelected(periodResult.value.data[0] ?? null); setRequestId(periodResult.value.requestId); }
    const failed = [accessResult, configResult, periodResult].find((result) => result.status === "rejected");
    if (failed?.status === "rejected") setError(messageFor(failed.reason));
    setLoading(false);
  };

  const submitConfiguration = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void run(() => payrollApi.createConfiguration({
      shop_id: shopId, branch_id: String(form.get("branch_id") ?? "") || null,
      config_key: configurationKey, numeric_value: String(form.get("numeric_value")),
      unit: configurationOptions[configurationKey].unit, effective_from: String(form.get("effective_from")), effective_to: null,
    }), (created) => setConfigurations((rows) => [...rows, created]), "บันทึกค่าคำนวณแล้ว");
  };

  const submitPeriod = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const month = String(form.get("month"));
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    void run(() => payrollApi.createPeriod({ shop_id: shopId, period_year: year, period_month: monthNumber,
      start_date: `${month}-01`, end_date: `${month}-${String(lastDay).padStart(2, "0")}` }),
    (created) => { setPeriods((rows) => [created, ...rows]); setSelected(created); }, "เปิดรอบเงินเดือนแล้ว");
  };

  const calculate = (mode: "preview" | "lock") => {
    if (!selected) return;
    if (mode === "lock" && !window.confirm("ล็อกรอบนี้หรือไม่? ผลคำนวณและรายการหักจะถูกตรึงเป็นประวัติ")) return;
    void run(() => mode === "preview" ? payrollApi.previewPeriod(selected.id) : payrollApi.lockPeriod(selected.id),
      (result) => { setPreview(result); setSelected(result.period); setPeriods((rows) => rows.map((row) => row.id === result.period.id ? result.period : row)); },
      mode === "preview" ? "คำนวณตัวอย่างล่าสุดแล้ว" : "ล็อกรอบเงินเดือนแล้ว");
  };

  const showRecord = (row: PayrollRecord) => {
    if (!selected || !row.id) { setRecord(row); return; }
    void run(() => payrollApi.getRecord(selected.id, row.id!), setRecord);
  };

  return <div className="space-y-8">
    <header className="border-b border-[var(--line)] pb-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div><p className="text-sm font-semibold text-[var(--accent)]">รอบจ่ายและหลักฐานการคำนวณ</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">สมุดงานเงินเดือน</h1><p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">ตรวจรายการรายวัน แก้ blocker แล้วจึงล็อกรอบ ข้อมูลที่ล็อกแล้วแก้ผ่าน adjustment เท่านั้น</p></div>
        <form onSubmit={(event) => { event.preventDefault(); void loadWorkspace(); }} className="flex w-full items-end gap-2 sm:w-auto">
          <label className="min-w-0 flex-1 text-sm sm:w-32">Shop ID<input className={field} value={shopId} onChange={(event) => setShopId(event.target.value)} inputMode="numeric" required /></label>
          <button className={button} disabled={loading}>{loading ? "กำลังโหลด…" : "เปิดสมุดงาน"}</button>
        </form>
      </div>
      {requestId && <p className="mt-3 text-xs text-[var(--muted)]">Request ID: {requestId}</p>}
    </header>

    {notice && <p role="status" className="border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}
    {error && <p role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>}
    {canMutate === false && <p className="border-l-4 border-blue-600 bg-blue-50 px-4 py-3 text-sm text-blue-950">โหมดอ่านอย่างเดียว: บัญชีนี้ดูข้อมูลตามสาขาที่ได้รับสิทธิ์ แต่สร้าง คำนวณ หรือล็อกรอบไม่ได้</p>}

    {canMutate !== false && <section className="grid gap-px overflow-hidden border border-[var(--line)] bg-[var(--line)] lg:grid-cols-2">
      <details className="bg-[var(--surface)] p-5" open><summary className="cursor-pointer font-semibold">เพิ่มค่าคำนวณแบบ effective-dated</summary>
        <form onSubmit={submitConfiguration} className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">ค่าคำนวณ<select className={field} name="config_key" value={configurationKey} onChange={(event) => setConfigurationKey(event.target.value as ConfigurationKey)}>{Object.entries(configurationOptions).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}</select></label>
          <label className="text-sm">หน่วย<input className={`${field} bg-[var(--canvas)]`} value={configurationOptions[configurationKey].unitLabel} readOnly /></label>
          <label className="text-sm">ค่า<input className={field} name="numeric_value" inputMode="decimal" placeholder="20.0000" required /></label>
          <label className="text-sm">เริ่มใช้<input className={field} name="effective_from" type="date" required /></label>
          <label className="text-sm sm:col-span-2">Branch ID <span className="text-[var(--muted)]">(เว้นว่าง = ทั้งร้าน)</span><input className={field} name="branch_id" inputMode="numeric" /></label>
          <button className={`${button} sm:col-span-2 sm:justify-self-start`} disabled={busy}>บันทึกค่าคำนวณ</button>
        </form>
      </details>
      <details className="bg-[var(--surface)] p-5" open><summary className="cursor-pointer font-semibold">เปิดรอบเงินเดือน</summary>
        <form onSubmit={submitPeriod} className="mt-5 flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm">เดือน<input className={field} name="month" type="month" required /></label><button className={button} disabled={busy}>เปิดรอบ</button></form>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">หนึ่งร้านเปิดได้หนึ่งรอบต่อเดือน ช่วงวันที่จะสร้างตามเดือนที่เลือก</p>
      </details>
    </section>}

    <section className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside><h2 className="font-semibold">รอบเงินเดือน</h2><div className="mt-3 border-y border-[var(--line)]">
        {periods.length === 0 && <p className="py-5 text-sm text-[var(--muted)]">ยังไม่มีรอบ กด “เปิดสมุดงาน” หรือสร้างรอบใหม่</p>}
        {periods.map((period) => <button key={period.id} onClick={() => { setSelected(period); setPreview(null); setRecord(null); }} className={`flex w-full items-center justify-between border-b border-[var(--line)] px-2 py-4 text-left text-sm last:border-0 ${selected?.id === period.id ? "bg-[var(--accent-soft)]" : "bg-transparent"}`}><span><strong className="block">{period.period_month.toString().padStart(2, "0")}/{period.period_year}</strong><span className="text-[var(--muted)]">{period.start_date} – {period.end_date}</span></span><span className="rounded-full border border-[var(--line)] bg-white px-2 py-1 text-xs">{periodStatusLabels[period.status] ?? period.status}</span></button>)}
      </div></aside>

      <div className="min-w-0 space-y-6">
        {!selected ? <div className="border border-dashed border-[var(--line)] p-8 text-center text-[var(--muted)]">เลือกรอบเพื่อเริ่มตรวจเงินเดือน</div> : <>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5"><div><h2 className="text-xl font-semibold">งวด {selected.period_month.toString().padStart(2, "0")}/{selected.period_year}</h2><p className="mt-1 text-sm text-[var(--muted)]">สถานะ {periodStatusLabels[selected.status] ?? selected.status}</p></div>{canMutate !== false && <div className="flex gap-2"><button className={quietButton} onClick={() => calculate("preview")} disabled={busy || selected.status === "locked"}>คำนวณตัวอย่าง</button><button className={button} onClick={() => calculate("lock")} disabled={busy || selected.status === "locked"}>ล็อกรอบ</button></div>}</div>
          {preview?.blockers.length ? <div className="border border-amber-300 bg-amber-50 p-4"><h3 className="font-semibold text-amber-950">ยังล็อกรอบไม่ได้</h3><ul className="mt-2 space-y-2 text-sm text-amber-950">{preview.blockers.map((item, index) => <li key={`${item.code}-${index}`}><strong>{blockerLabels[item.code] ?? item.code}</strong>{item.employeeId ? ` · พนักงาน ${item.employeeId}` : ""}<br />{item.detail}</li>)}</ul></div> : null}
          <div className="overflow-x-auto border-y border-[var(--line)]"><table className="w-full min-w-[680px] border-collapse text-sm"><thead><tr className="text-left text-[var(--muted)]"><th className="py-3 pr-4">พนักงาน</th><th className="py-3 pr-4 text-right">รายได้</th><th className="py-3 pr-4 text-right">รายการหัก</th><th className="py-3 pr-4 text-right">สุทธิ</th><th className="py-3 text-right">หลักฐาน</th></tr></thead><tbody>
            {(!preview || preview.records.length === 0) && <tr><td colSpan={5} className="border-t border-[var(--line)] py-8 text-center text-[var(--muted)]">กดคำนวณตัวอย่างเพื่อดูรายการ หรือแก้ blocker ที่ระบบแจ้ง</td></tr>}
            {preview?.records.map((row) => <tr key={row.employee_id} className="border-t border-[var(--line)]"><td className="py-4 pr-4 font-semibold">#{row.employee_id}<span className="block text-xs font-normal text-[var(--muted)]">Branch {row.branch_id}</span></td><td className="py-4 pr-4 text-right tabular-nums">{formatMoney(row.total_earnings)}</td><td className="py-4 pr-4 text-right tabular-nums">{formatMoney(row.total_deductions)}</td><td className="py-4 pr-4 text-right font-semibold tabular-nums">{formatMoney(row.net_pay)}</td><td className="py-4 text-right"><button className={quietButton} onClick={() => showRecord(row)}>ดู {row.items.length} รายการ</button></td></tr>)}
          </tbody></table></div>
          {record && <section aria-labelledby="record-evidence" className="bg-[var(--ink)] p-5 text-white"><div className="flex items-center justify-between gap-4"><h3 id="record-evidence" className="font-semibold">หลักฐานพนักงาน #{record.employee_id}</h3><button className="text-sm underline" onClick={() => setRecord(null)}>ปิด</button></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><dt className="text-white/60">ฐานเงินเดือน</dt><dd>{formatMoney(record.base_salary_snapshot)}</dd></div><div><dt className="text-white/60">สวัสดิการ</dt><dd>{formatMoney(record.welfare_snapshot)}</dd></div><div><dt className="text-white/60">รายได้</dt><dd>{formatMoney(record.total_earnings)}</dd></div><div><dt className="text-white/60">สุทธิ</dt><dd>{formatMoney(record.net_pay)}</dd></div></dl><ul className="mt-5 divide-y divide-white/15">{record.items.map((item, index) => <li key={`${item.item_type}-${item.source_id ?? index}`} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]"><span>{itemLabels[item.item_type] ?? item.description}<span className="block text-xs text-white/60">{item.occurred_on ? `${item.occurred_on} · ` : ""}{item.source_table && item.source_id ? `${item.source_table} #${item.source_id}` : item.item_type}{item.payroll_configuration_id ? ` · config #${item.payroll_configuration_id}` : ""}</span></span><strong className="tabular-nums">{item.direction === "deduction" ? "−" : "+"}{formatMoney(item.amount)}</strong></li>)}</ul></section>}
        </>}
      </div>
    </section>

    {canMutate !== false && <section className="grid gap-6 border-t border-[var(--line)] pt-7 lg:grid-cols-[1fr_1.3fr]"><div><h2 className="text-xl font-semibold">Adjustment หลังล็อกรอบ</h2><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">ไม่แก้รายการเดิม ระบุ payroll record ที่ล็อกแล้วและรอบถัดไปที่จะนำส่วนต่างไปใช้</p></div><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(() => payrollApi.requestAdjustment({ original_payroll_record_id: String(form.get("record_id")), applied_payroll_period_id: String(form.get("target_period_id")), direction: String(form.get("direction")) as "earning" | "deduction", amount: String(form.get("amount")), reason: String(form.get("reason")) }), () => undefined, "ส่ง adjustment เพื่ออนุมัติแล้ว"); }} className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Locked record ID<input className={field} name="record_id" inputMode="numeric" required /></label><label className="text-sm">Target period ID<input className={field} name="target_period_id" inputMode="numeric" required /></label><label className="text-sm">ทิศทาง<select className={field} name="direction"><option value="earning">เพิ่มรายได้</option><option value="deduction">เพิ่มรายการหัก</option></select></label><label className="text-sm">จำนวนเงิน<input className={field} name="amount" inputMode="decimal" required /></label><label className="text-sm sm:col-span-2">เหตุผล<input className={field} name="reason" required maxLength={1000} /></label><button className={`${button} sm:col-span-2 sm:justify-self-start`} disabled={busy}>ส่ง Adjustment</button></form></section>}

    <details className="border-t border-[var(--line)] pt-5"><summary className="cursor-pointer font-semibold">ค่าคำนวณที่โหลดแล้ว ({configurations.length})</summary><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="text-left text-[var(--muted)]"><th className="py-2">ค่า</th><th>ขอบเขต</th><th>ตัวเลข</th><th>เริ่มใช้</th></tr></thead><tbody>{configurations.map((row) => <tr key={row.id} className="border-t border-[var(--line)]"><td className="py-3 font-medium">{configurationLabel(row.config_key)}<span className="block font-mono text-xs font-normal text-[var(--muted)]">{row.config_key}</span></td><td>{row.branch_id ? `สาขา ${row.branch_id}` : "ทั้งร้าน"}</td><td>{row.numeric_value} {unitLabel(row.unit)}</td><td>{row.effective_from}</td></tr>)}</tbody></table></div></details>
  </div>;
}
