"use client";
import { useEffect, useState, type FormEvent } from "react";
import { PayrollPeriodPicker } from "./payroll-period-picker";
import { Feedback, StatusBadge, formatThaiMoney } from "./workspace-ui";
import { payrollApi, type PayrollAdjustment, type PayrollPeriod, type PayrollPreview } from "@/lib/payroll/payroll-api";

export function PayrollAdjustments() {
  const [original, setOriginal] = useState<PayrollPeriod | null>(null);
  const [detail, setDetail] = useState<PayrollPreview | null>(null);
  const [recordId, setRecordId] = useState("");
  const [target, setTarget] = useState<PayrollPeriod | null>(null);
  const [rows, setRows] = useState<PayrollAdjustment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!recordId) return;
    const abort = new AbortController();
    void payrollApi.listAdjustments(recordId, { signal: abort.signal }).then((result) => { if (!abort.signal.aborted) setRows(result.data); }).catch((cause) => { if (!abort.signal.aborted) setError(cause.message); });
    return () => abort.abort();
  }, [recordId]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : "ทำรายการไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!recordId || !target) return;
    const form = new FormData(event.currentTarget);
    void run(async () => {
      await payrollApi.requestAdjustment({ original_payroll_record_id: recordId, applied_payroll_period_id: target.id, direction: String(form.get("direction")) as "earning" | "deduction", amount: String(form.get("amount")), reason: String(form.get("reason")) });
      setRows((await payrollApi.listAdjustments(recordId)).data); setNotice("ส่งรายการปรับปรุงแล้ว ต้องอนุมัติก่อนคำนวณงวดปลายทาง");
    });
  };
  const targetValid = Boolean(original && target && original.shop_id === target.shop_id && target.status !== "locked" && target.start_date > original.end_date);
  return <><CurrentPayrollAdjustments /><details className="workspace-section"><summary className="cursor-pointer text-xl font-semibold">รายการปรับปรุงหลังล็อกรอบ</summary><p className="mt-3 text-sm text-[var(--muted)]">เลือกงวดต้นทางและพนักงาน แล้วนำส่วนต่างไปงวดภายหลังของร้านเดียวกัน ต้องมีประวัติการจ้างในงวดปลายทาง ระบบเก็บผลเดิมและประวัติการอนุมัติ</p>
    {error && <Feedback kind="error" detail={error} />}{notice && <Feedback kind="success" detail={notice} />}
    <form onSubmit={submit} className="mt-5 space-y-5"><fieldset className="space-y-3"><legend className="font-semibold">ต้นทางที่ล็อกแล้ว</legend><PayrollPeriodPicker lockedOnly value={original?.id ?? ""} onChange={(period) => { setOriginal(period); setDetail(null); setRecordId(""); setRows([]); if (period) void run(async () => setDetail((await payrollApi.getPeriod(period.id)).data)); }} /><label className="block text-sm">พนักงาน<select className="workspace-control" value={recordId} onChange={(event) => { setRecordId(event.target.value); setRows([]); }} required disabled={!detail || busy}><option value="">เลือกพนักงาน</option>{detail?.records.map((row) => { const employee = detail.roster?.find((item) => item.employeeId === row.employee_id); return <option key={row.id} value={row.id}>{employee ? `${employee.employeeCode} · ${employee.employeeName}` : `พนักงาน ${row.employee_id}`} · สุทธิ {formatThaiMoney(row.net_pay)}</option>; })}</select></label></fieldset>
      <fieldset><legend className="mb-3 font-semibold">งวดปลายทาง</legend><PayrollPeriodPicker value={target?.id ?? ""} onChange={setTarget} />{target && !targetValid && <p className="mt-2 text-sm text-amber-900">เลือกงวดภายหลังที่ยังไม่ล็อกของร้านเดียวกับต้นทาง</p>}</fieldset>
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">ทิศทาง<select className="workspace-control" name="direction"><option value="earning">เพิ่มรายได้</option><option value="deduction">เพิ่มรายการหัก</option></select></label><label className="block text-sm">จำนวนเงิน<input className="workspace-control" type="number" name="amount" min="0.01" step="0.01" required /></label><label className="block text-sm sm:col-span-2">เหตุผล<input className="workspace-control" name="reason" required maxLength={1000} /></label></div>
      <button className="workspace-primary" disabled={busy || !recordId || !targetValid}>ส่งรายการปรับปรุง</button>
    </form>
    <h3 className="mt-7 font-semibold">ประวัติรายการของพนักงานที่เลือก</h3>{!rows.length ? <p className="mt-3 text-sm text-[var(--muted)]">ยังไม่มีรายการปรับปรุง</p> : <ul className="mt-3 divide-y divide-[var(--line)]">{rows.map((row) => <li key={row.id} className="space-y-2 py-4"><div className="flex flex-wrap justify-between gap-3"><span>{row.direction === "earning" ? "เพิ่มรายได้" : "เพิ่มรายการหัก"} {formatThaiMoney(row.amount)} · {row.reason}</span><StatusBadge value={row.status} /></div><p className="text-sm text-[var(--muted)]">{row.applied_payroll_item_id ? "นำไปใช้ในรายการเงินเดือนแล้ว" : row.status === "approved" ? "รอคำนวณและล็อกงวดปลายทาง" : "ยังไม่ถูกนำไปหักหรือจ่าย"}</p>{row.status === "pending" && <div className="flex gap-2">{(["approve", "reject"] as const).map((decision) => <button key={decision} className={decision === "approve" ? "workspace-primary" : "workspace-secondary"} disabled={busy} type="button" onClick={() => void run(async () => { await payrollApi.decideAdjustment(row.id, decision); setRows((await payrollApi.listAdjustments(recordId)).data); setNotice(decision === "approve" ? "อนุมัติแล้ว คำนวณงวดปลายทางเพื่อนำส่วนต่างไปใช้" : "ปฏิเสธแล้ว"); })}>{decision === "approve" ? "อนุมัติ" : "ไม่อนุมัติ"}</button>)}</div>}</li>)}</ul>}
  </details></>;
}


function CurrentPayrollAdjustments() {
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [detail, setDetail] = useState<PayrollPreview | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [rows, setRows] = useState<PayrollAdjustment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!period) return;
    const abort = new AbortController();
    void Promise.all([payrollApi.getPeriod(period.id, { signal: abort.signal }), payrollApi.listAdjustments(undefined, { periodId: period.id, signal: abort.signal })])
      .then(([result, adjustments]) => { if (!abort.signal.aborted) { setDetail(result.data); setRows(adjustments.data); } })
      .catch((cause) => { if (!abort.signal.aborted) setError(cause.message); });
    return () => abort.abort();
  }, [period]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : "ทำรายการไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const refresh = async () => { if (period) setRows((await payrollApi.listAdjustments(undefined, { periodId: period.id })).data); };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!period || !employeeId || period.status === "locked") return;
    const form = new FormData(event.currentTarget);
    void run(async () => {
      await payrollApi.requestAdjustment({ employee_id: employeeId, applied_payroll_period_id: period.id, direction: String(form.get("direction")) as "earning" | "deduction", amount: String(form.get("amount")), reason: String(form.get("reason")) });
      await refresh(); setNotice("ส่งรายการแล้ว รออนุมัติก่อนคำนวณและล็อกงวดนี้");
    });
  };
  const roster = [...new Map(detail?.roster?.map((row) => [row.employeeId, row])).values()];
  return <section className="workspace-section" aria-label="รายการเพิ่มและหักในงวดปัจจุบัน">
    <h2 className="text-xl font-semibold">รายการเพิ่มและหักในงวดปัจจุบัน</h2>
    <p className="mt-3 text-sm text-[var(--muted)]">เลือกงวดที่ยังไม่ล็อกและพนักงานในงวด รายการรออนุมัติจะขวางการล็อกรอบ เมื่ออนุมัติแล้วจึงนำไปคำนวณ</p>
    {error && <Feedback kind="error" detail={error} />}{notice && <Feedback kind="success" detail={notice} />}
    <form onSubmit={submit} className="mt-5 space-y-5">
      <PayrollPeriodPicker value={period?.id ?? ""} onChange={(value) => { setPeriod(value); setDetail(null); setEmployeeId(""); setRows([]); setError(""); setNotice(""); }} />
      {period?.status === "locked" && <p className="text-sm text-amber-900">งวดนี้ล็อกแล้ว กรุณาเลือกงวดที่ยังไม่ล็อก หรือใช้รายการปรับปรุงหลังล็อกรอบด้านล่าง</p>}
      <label className="block text-sm">พนักงานในงวด<select className="workspace-control" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required disabled={!detail || busy || period?.status === "locked"}><option value="">เลือกพนักงาน</option>{roster.map((row) => <option key={row.employeeId} value={row.employeeId}>{row.employeeCode} · {row.employeeName} · {row.branchName}</option>)}</select></label>
      {detail && !roster.length && <p className="text-sm text-[var(--muted)]">ไม่มีพนักงานที่มีประวัติการจ้างในงวดนี้</p>}
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">ทิศทาง<select className="workspace-control" name="direction"><option value="earning">เพิ่มรายได้</option><option value="deduction">เพิ่มรายการหัก</option></select></label><label className="block text-sm">จำนวนเงิน<input className="workspace-control" type="number" name="amount" min="0.01" step="0.01" required /></label><label className="block text-sm sm:col-span-2">เหตุผล<input className="workspace-control" name="reason" required maxLength={1000} /></label></div>
      <button className="workspace-primary" disabled={busy || !employeeId || !period || period.status === "locked"}>ส่งรายการในงวดนี้</button>
    </form>
    <h3 className="mt-7 font-semibold">รายการในงวดที่เลือก</h3>
    {!rows.length ? <p className="mt-3 text-sm text-[var(--muted)]">ยังไม่มีรายการปรับปรุง</p> : <ul className="mt-3 divide-y divide-[var(--line)]">{rows.map((row) => <li key={row.id} className="space-y-2 py-4"><div className="flex flex-wrap justify-between gap-3"><span>{roster.find((employee) => employee.employeeId === row.employee_id)?.employeeName ?? `พนักงาน ${row.employee_id}`} · {row.direction === "earning" ? "เพิ่มรายได้" : "เพิ่มรายการหัก"} {formatThaiMoney(row.amount)} · {row.reason}</span><StatusBadge value={row.status} /></div>{row.status === "pending" && period?.status !== "locked" && <div className="flex gap-2">{(["approve", "reject"] as const).map((decision) => <button key={decision} type="button" className={decision === "approve" ? "workspace-primary" : "workspace-secondary"} disabled={busy} onClick={() => void run(async () => { await payrollApi.decideAdjustment(row.id, decision); await refresh(); setNotice(decision === "approve" ? "อนุมัติแล้ว คำนวณงวดนี้เพื่อนำรายการไปใช้" : "ปฏิเสธแล้ว"); })}>{decision === "approve" ? "อนุมัติ" : "ไม่อนุมัติ"}</button>)}</div>}</li>)}</ul>}
  </section>;
}
