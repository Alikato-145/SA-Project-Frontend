"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Feedback, PageHeader } from "@/components/workspace-ui";
import { ApiClientError, type ApiPage } from "@/lib/api/client";
import { auditApi, type AuditFilters, type AuditLog } from "@/lib/audit/audit-api";

const field = "mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-sm";
const tokenPattern = "[A-Za-z0-9][A-Za-z0-9._:-]*";

const messageFor = (cause: unknown) => cause instanceof ApiClientError
  ? cause.message
  : "ไม่สามารถโหลดประวัติการเปลี่ยนแปลงได้";

const localDateTime = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "");
  return text ? new Date(text).toISOString() : undefined;
};

const formatDateTime = (value: string) => new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

function Snapshot({ label, value }: { label: string; value: unknown }) {
  if (value === null) return null;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-semibold text-[var(--accent)] underline decoration-transparent underline-offset-4 hover:decoration-current">
        {label}
      </summary>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--paper)] p-3 text-[0.75rem] leading-5 text-[var(--ink)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export default function AuditPage() {
  const [result, setResult] = useState<ApiPage<AuditLog> | null>(null);
  const [activeFilters, setActiveFilters] = useState<AuditFilters>({ page_size: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const search = useCallback(async (filters: AuditFilters, page: number) => {
    setLoading(true);
    setError("");
    try {
      setResult(await auditApi.list({ ...filters, page }));
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void auditApi.list({ page: 1, page_size: 20 }, { signal: controller.signal })
      .then(setResult)
      .catch((cause) => {
        if (!(cause instanceof ApiClientError && cause.code === "REQUEST_ABORTED"))
          setError(messageFor(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const filters: AuditFilters = {
      page_size: 20,
      action: String(data.get("action") ?? "").trim() || undefined,
      actor_account_id: String(data.get("actor_account_id") ?? "").trim() || undefined,
      table_name: String(data.get("table_name") ?? "").trim() || undefined,
      record_id: String(data.get("record_id") ?? "").trim() || undefined,
      request_id: String(data.get("request_id") ?? "").trim() || undefined,
      occurred_from: localDateTime(data.get("occurred_from")),
      occurred_to: localDateTime(data.get("occurred_to")),
    };
    setActiveFilters(filters);
    void search(filters, 1);
  };

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.page_size)) : 1;

  return (
    <div className="space-y-8">
      <PageHeader
        title="ประวัติการเปลี่ยนแปลง"
        description="ตรวจสอบผู้ดำเนินการ เวลา รายการที่ได้รับผล และข้อมูลก่อน–หลัง โดยระบบแสดงเฉพาะข้อมูลที่ผ่านการปกปิดข้อมูลลับแล้ว"
      />

      <form onSubmit={submit} className="space-y-4 border-y border-[var(--line)] py-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">การดำเนินการ<input className={field} name="action" pattern={tokenPattern} placeholder="เช่น employee.update.succeeded…" autoComplete="off" spellCheck={false} /></label>
          <label className="text-sm">ตารางข้อมูล<input className={field} name="table_name" pattern={tokenPattern} placeholder="เช่น employees…" autoComplete="off" spellCheck={false} /></label>
          <label className="text-sm">รหัสรายการ<input className={field} name="record_id" pattern={tokenPattern} autoComplete="off" spellCheck={false} /></label>
          <label className="text-sm">รหัสบัญชีผู้ดำเนินการ<input className={field} name="actor_account_id" pattern="[1-9][0-9]*" inputMode="numeric" autoComplete="off" /></label>
          <label className="text-sm">ตั้งแต่เวลา<input className={field} name="occurred_from" type="datetime-local" autoComplete="off" /></label>
          <label className="text-sm">ถึงเวลา<input className={field} name="occurred_to" type="datetime-local" autoComplete="off" /></label>
          <label className="text-sm sm:col-span-2">Request ID<input className={field} name="request_id" pattern={tokenPattern} autoComplete="off" spellCheck={false} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={loading}>{loading ? "กำลังค้นหา…" : "ค้นหาประวัติ"}</Button>
          <p className="text-sm text-[var(--muted)]">ค้นหาตามค่าที่ตรงกันทั้งหมด สูงสุด 20 รายการต่อหน้า</p>
        </div>
      </form>

      {error ? <Feedback kind="error" title="โหลดข้อมูลไม่สำเร็จ" detail={error} /> : null}
      {loading && !result ? <Feedback kind="loading" detail="กำลังโหลดประวัติการเปลี่ยนแปลง…" /> : null}
      {!loading && result?.data.length === 0 ? <Feedback kind="empty" title="ไม่พบประวัติ" detail="ลองลดเงื่อนไขหรือเปลี่ยนช่วงเวลาแล้วค้นหาอีกครั้ง" /> : null}

      {result && result.data.length > 0 ? (
        <section aria-labelledby="audit-results-heading" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="audit-results-heading" className="text-xl font-semibold">ผลการค้นหา</h2>
            <p className="text-sm tabular-nums text-[var(--muted)]">พบ {result.total.toLocaleString("th-TH")} รายการ · หน้า {result.page} จาก {totalPages}</p>
          </div>
          <div className="overflow-x-auto border-y border-[var(--line)]">
            <table className="w-full min-w-[68rem] border-collapse text-left text-sm">
              <thead className="bg-[var(--surface)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-3 font-semibold">เวลา</th>
                  <th className="px-3 py-3 font-semibold">บัญชี</th>
                  <th className="px-3 py-3 font-semibold">การดำเนินการ</th>
                  <th className="px-3 py-3 font-semibold">เป้าหมาย</th>
                  <th className="px-3 py-3 font-semibold">เหตุผล / Request</th>
                  <th className="px-3 py-3 font-semibold">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {result.data.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-[var(--surface)]">
                    <td className="whitespace-nowrap px-3 py-4 tabular-nums">{formatDateTime(row.occurred_at)}</td>
                    <td className="px-3 py-4 tabular-nums">{row.actor_account_id ? `#${row.actor_account_id}` : "ระบบ"}</td>
                    <td className="px-3 py-4 font-mono text-xs" translate="no">{row.action}</td>
                    <td className="px-3 py-4"><span className="font-medium" translate="no">{row.table_name}</span><span className="block text-xs text-[var(--muted)]" translate="no">#{row.record_id}</span></td>
                    <td className="max-w-64 px-3 py-4"><span className="block">{row.reason ?? "—"}</span><span className="mt-1 block break-all font-mono text-xs text-[var(--muted)]" translate="no">{row.request_id ?? "ไม่มี Request ID"}</span></td>
                    <td className="space-y-2 px-3 py-4"><Snapshot label="ข้อมูลเดิม" value={row.old_data} /><Snapshot label="ข้อมูลใหม่" value={row.new_data} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Button type="button" variant="outline" disabled={loading || result.page <= 1} onClick={() => void search(activeFilters, result.page - 1)}>หน้าก่อน</Button>
            <span className="text-sm tabular-nums text-[var(--muted)]">หน้า {result.page} / {totalPages}</span>
            <Button type="button" variant="outline" disabled={loading || result.page >= totalPages} onClick={() => void search(activeFilters, result.page + 1)}>หน้าถัดไป</Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
