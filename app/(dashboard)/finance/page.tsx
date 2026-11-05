"use client";

import { useEffect, useState } from "react";
import { authApi } from "@/lib/auth/auth-api";
import { EmployeePicker } from "@/components/employee-picker";
import { Feedback, PageHeader, StatusBadge, formatThaiMoney } from "@/components/workspace-ui";
import { operationsApi } from "@/lib/operations/operations-api";

type Advance = { id: string | number; employeeId: string | number; requestMonth: string; amount: string; reason: string | null; status: string; decisionNote: string | null };
const field = "workspace-control";
const primary = "workspace-primary";
const secondary = "workspace-secondary";
const api = operationsApi.request;
export default function FinancePage() {
  const [canFinance, setCanFinance] = useState<boolean | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const linkedEmployee = new URLSearchParams(window.location.search).get("employee_id");
    void authApi.current().then((actor) => {
      const admin = actor.grants.some((grant) => ["HR", "OWNER"].includes(grant.role_code));
      setCanFinance(admin);
      if (!admin) setEmployeeName(actor.account.employee?.display_name ?? "ยังไม่เชื่อมข้อมูลพนักงาน");
      const id = admin ? linkedEmployee : actor.account.employee?.id;
      if (id && /^[1-9]\d*$/.test(id)) { setLoading(true); setEmployeeId(id); }
    }).catch(() => setError("ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่"));
  }, []);
  useEffect(() => {
    if (!employeeId) return;
    const controller = new AbortController();
    const query = `employee_id=${encodeURIComponent(employeeId)}`;
    void api<Advance[]>(`/advance-requests?${query}`, { signal: controller.signal })
      .then((rows) => { if (!controller.signal.aborted) setAdvances(rows); })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดคำขอเบิกเงินล่วงหน้าได้");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [employeeId, reload]);
  const load = () => {
    setLoading(true);
    setError("");
    setReload((value) => value + 1);
  };
  const mutate = async (path: string, body: object, success: string) => {
    if (!employeeId) { setError("เลือกพนักงานก่อนทำรายการ"); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      setMessage(success);
      load();
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
        setError(`กรอก${advanceText === "reason" ? "เหตุผลที่ขอเบิกเงินล่วงหน้า" : "เหตุผลที่ไม่อนุมัติเบิกเงินล่วงหน้า"} 1–1000 ตัวอักษร โดยไม่เว้นว่างทั้งหมด`);
        return;
      }
      form.set(advanceText, value.trim());
    }
    void mutate(path, body(form), success);
  };
  if (canFinance === null) return <Feedback kind={error ? "error" : "empty"} detail={error || "กำลังตรวจสอบสิทธิ์…"} />;
  const selectedAdvances = advances.filter((row) => String(row.employeeId) === employeeId);
  return <div className="space-y-7">
    <PageHeader title={canFinance ? "เบิกเงินล่วงหน้า" : "เบิกเงินล่วงหน้าของฉัน"} description="ยื่นและติดตามคำขอเบิกเงินล่วงหน้าของพนักงาน" />
    <form onSubmit={(event) => { event.preventDefault(); load(); }} className="workspace-filter flex flex-wrap items-end gap-3"><label className="min-w-56 flex-1 text-sm font-medium">พนักงาน{canFinance ? <EmployeePicker className={field} required value={employeeId} onChange={(id) => { if (id !== employeeId) { setLoading(Boolean(id)); setError(""); setAdvances([]); setEmployeeId(id); } }} /> : <span className="block mt-2">{employeeName}</span>}</label><button className={primary} disabled={loading || !employeeId}>{loading ? "กำลังโหลด…" : "โหลดข้อมูลการเงิน"}</button></form>
    <div className="space-y-3">{message ? <Feedback kind="success" detail={message} /> : null}{error ? <Feedback kind="error" title="ทำรายการไม่สำเร็จ" detail={error} /> : null}</div>
    <section className="workspace-section" aria-labelledby="advances-title">
      <h2 id="advances-title" className="text-xl font-semibold">เบิกเงินล่วงหน้า</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">การอนุมัติตรวจสอบวันที่ขอ จำนวนวันทำงาน เพดานเงินเดือน และเงินสุทธิที่คาดการณ์</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <form onSubmit={(event) => submit(event, "/advance-requests", (form) => ({ employee_id: employeeId, amount: String(form.get("amount")), reason: String(form.get("reason")) }), "ส่งคำขอเบิกเงินล่วงหน้าแล้ว")} className="space-y-4">
          <label className="block text-sm">จำนวนเงิน<input className={field} name="amount" type="number" min="0.01" step="0.01" required /></label>
          <label className="block text-sm">เหตุผลที่ขอเบิกเงินล่วงหน้า<textarea className={field} name="reason" maxLength={1000} required /></label>
          <button className={primary} disabled={busy}>ส่งคำขอเบิกเงินล่วงหน้า</button>
        </form>
        <div className="workspace-records">
          {selectedAdvances.length === 0 && <div className="py-3"><Feedback kind="empty" detail={loading ? "กำลังโหลดคำขอเบิกเงินล่วงหน้า…" : employeeId ? "ไม่พบคำขอเบิกเงินล่วงหน้าของพนักงานที่เลือก" : "เลือกพนักงานเพื่อดูคำขอเบิกเงินล่วงหน้า"} /></div>}
          {selectedAdvances.map((row) => <article key={row.id} data-testid={`advance-request-${row.id}`} className="workspace-record">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">{row.requestMonth} · {formatThaiMoney(row.amount)}</p><StatusBadge value={row.status} /></div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--muted)]">{row.reason ?? "รายการเดิม: ไม่ได้บันทึกเหตุผลที่ขอ"}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--muted)]">{row.decisionNote ? `เหตุผลการพิจารณา: ${row.decisionNote}` : "ยังไม่มีหมายเหตุการพิจารณา"}</p>
            {canFinance && row.status === "pending" && <div className="mt-4 flex flex-wrap items-end gap-3">
              <button className={secondary} disabled={busy} onClick={() => void mutate(`/advance-requests/${row.id}/approve`, {}, "อนุมัติเบิกเงินล่วงหน้าแล้ว")}>อนุมัติ</button>
              <form onSubmit={(event) => submit(event, `/advance-requests/${row.id}/reject`, (form) => ({ note: String(form.get("note")) }), "ไม่อนุมัติเบิกเงินล่วงหน้าแล้ว")} className="flex flex-wrap items-end gap-2">
                <label className="block text-sm">เหตุผลที่ไม่อนุมัติเบิกเงินล่วงหน้า<input className={field} name="note" maxLength={1000} required /></label>
                <button className={secondary} disabled={busy}>ไม่อนุมัติ</button>
              </form>
            </div>}
          </article>)}
        </div>
      </div>
    </section>
  </div>;
}
