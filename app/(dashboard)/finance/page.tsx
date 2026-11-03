"use client";

import { useEffect, useState } from "react";
import { authApi } from "@/lib/auth/auth-api";
import { EmployeePicker } from "@/components/employee-picker";
import { Feedback, PageHeader, StatusBadge, formatThaiMoney } from "@/components/workspace-ui";
import { operationsApi } from "@/lib/operations/operations-api";

type Advance = { id: string; employeeId: string; requestMonth: string; amount: string; reason: string | null; status: string; decisionNote: string | null };
const field = "workspace-control";
const primary = "workspace-primary";
const secondary = "workspace-secondary";
const api = operationsApi.request;
export default function FinancePage() {
  const [canFinance, setCanFinance] = useState<boolean | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const linkedEmployee = new URLSearchParams(window.location.search).get("employee_id");
    void authApi.current().then((actor) => {
      const admin = actor.grants.some((grant) => ["HR", "OWNER"].includes(grant.role_code));
      setCanFinance(admin);
      if (!admin) { setEmployeeId(actor.account.employee?.id ?? ""); setEmployeeName(actor.account.employee?.display_name ?? "ยังไม่เชื่อมข้อมูลพนักงาน"); }
      else {
        const requested = linkedEmployee;
        if (requested && /^[1-9]\d*$/.test(requested)) setEmployeeId(requested);
      }
    }).catch(() => setError("ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่"));
  }, []);
  const load = async () => {
    if (!employeeId) { setError("เลือกพนักงานก่อนโหลดข้อมูลการเงิน"); return; }
    setLoading(true); setError(""); setAdvances([]);
    try {
      const query = `employee_id=${encodeURIComponent(employeeId)}`;
      setAdvances(await api<Advance[]>(`/advance-requests?${query}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดคำขอเงินทดรองจ่ายได้");
    } finally { setLoading(false); }
  };
  const mutate = async (path: string, body: object, success: string) => {
    if (!employeeId) { setError("เลือกพนักงานก่อนทำรายการ"); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      setMessage(success);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกรายการทางการเงินได้"); }
    finally { setBusy(false); }
  };
  const submit = (event: React.FormEvent<HTMLFormElement>, path: string,
    body: (form: FormData) => object, success: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const advanceText = path === "/advance-requests" ? "reason" : /^\/advance-requests\/[^/]+\/reject$/.test(path) ? "note" : null;
    if (advanceText) {
      const value = String(form.get(advanceText) ?? "");
      if (!value.trim() || value.length > 1000) {
        setError(`กรอก${advanceText === "reason" ? "เหตุผลที่ขอเงินทดรองจ่าย" : "เหตุผลที่ไม่อนุมัติเงินทดรองจ่าย"} 1–1000 ตัวอักษร โดยไม่เว้นว่างทั้งหมด`);
        return;
      }
      form.set(advanceText, value.trim());
    }
    void mutate(path, body(form), success);
  };
  if (canFinance === null) return <Feedback kind={error ? "error" : "empty"} detail={error || "กำลังตรวจสอบสิทธิ์…"} />;
  return <div className="space-y-7">
    <PageHeader title={canFinance ? "เงินทดรองจ่าย" : "เงินทดรองจ่ายของฉัน"} description="ยื่นและติดตามคำขอเงินทดรองจ่ายของพนักงาน" />
    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="workspace-filter flex flex-wrap items-end gap-3"><label className="min-w-56 flex-1 text-sm font-medium">พนักงาน{canFinance ? <EmployeePicker className={field} required value={employeeId} onChange={setEmployeeId} /> : <span className="block mt-2">{employeeName}</span>}</label><button className={primary} disabled={loading}>{loading ? "กำลังโหลด…" : "โหลดข้อมูลการเงิน"}</button></form>
    <div className="space-y-3">{message ? <Feedback kind="success" detail={message} /> : null}{error ? <Feedback kind="error" title="ทำรายการไม่สำเร็จ" detail={error} /> : null}</div>
    <section className="workspace-section" aria-labelledby="advances-title">
      <h2 id="advances-title" className="text-xl font-semibold">เงินทดรองจ่าย</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">การอนุมัติตรวจสอบวันที่ขอ จำนวนวันทำงาน เพดานเงินเดือน และเงินสุทธิที่คาดการณ์</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <form onSubmit={(event) => submit(event, "/advance-requests", (form) => ({ employee_id: employeeId, amount: String(form.get("amount")), reason: String(form.get("reason")) }), "ส่งคำขอเงินทดรองจ่ายแล้ว")} className="space-y-4">
          <label className="block text-sm">จำนวนเงิน<input className={field} name="amount" type="number" min="0.01" step="0.01" required /></label>
          <label className="block text-sm">เหตุผลที่ขอเงินทดรองจ่าย<textarea className={field} name="reason" maxLength={1000} required /></label>
          <button className={primary} disabled={busy}>ส่งคำขอเงินทดรองจ่าย</button>
        </form>
        <div className="workspace-records">
          {advances.length === 0 && <div className="py-3"><Feedback kind="empty" detail="ไม่พบคำขอเงินทดรองจ่ายของพนักงานที่เลือก" /></div>}
          {advances.map((row) => <article key={row.id} data-testid={`advance-request-${row.id}`} className="workspace-record">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">{row.requestMonth} · {formatThaiMoney(row.amount)}</p><StatusBadge value={row.status} /></div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--muted)]">{row.reason ?? "รายการเดิม: ไม่ได้บันทึกเหตุผลที่ขอ"}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--muted)]">{row.decisionNote ? `เหตุผลการพิจารณา: ${row.decisionNote}` : "ยังไม่มีหมายเหตุการพิจารณา"}</p>
            {canFinance && row.status === "pending" && <div className="mt-4 flex flex-wrap items-end gap-3">
              <button className={secondary} disabled={busy} onClick={() => void mutate(`/advance-requests/${row.id}/approve`, {}, "อนุมัติเงินทดรองจ่ายแล้ว")}>อนุมัติ</button>
              <form onSubmit={(event) => submit(event, `/advance-requests/${row.id}/reject`, (form) => ({ note: String(form.get("note")) }), "ไม่อนุมัติเงินทดรองจ่ายแล้ว")} className="flex flex-wrap items-end gap-2">
                <label className="block text-sm">เหตุผลที่ไม่อนุมัติเงินทดรองจ่าย<input className={field} name="note" maxLength={1000} required /></label>
                <button className={secondary} disabled={busy}>ไม่อนุมัติ</button>
              </form>
            </div>}
          </article>)}
        </div>
      </div>
    </section>
  </div>;
}
