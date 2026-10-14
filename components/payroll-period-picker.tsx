"use client";
import { useEffect, useState } from "react";
import { organizationApi, type Shop } from "@/lib/organization/organization-api";
import { payrollApi, type PayrollPeriod } from "@/lib/payroll/payroll-api";
import { Feedback } from "@/components/workspace-ui";

export function PayrollPeriodPicker({ value, onChange, lockedOnly = false }: { value: string; onChange(period: PayrollPeriod | null): void; lockedOnly?: boolean }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState("");
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { const abort = new AbortController(); void organizationApi.listShops(abort.signal).then(setShops).catch((cause) => { if (!abort.signal.aborted) setError(cause.message); }); return () => abort.abort(); }, []);
  useEffect(() => {
    if (!shopId) return;
    const abort = new AbortController();
    void payrollApi.listPeriods(shopId, { signal: abort.signal }).then((result) => { if (!abort.signal.aborted) setPeriods(result.data); }).catch((cause) => { if (!abort.signal.aborted) setError(cause.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [shopId]);
  const visible = periods.filter((period) => !lockedOnly || period.status === "locked");
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="block text-sm">ร้าน<select className="workspace-control" value={shopId} onChange={(event) => { setShopId(event.target.value); setPeriods([]); setError(""); setLoading(Boolean(event.target.value)); onChange(null); }}><option value="">เลือกร้าน</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.code} · {shop.name}{shop.is_active ? "" : " · ปิดใช้งาน"}</option>)}</select></label>
    <label className="block text-sm">งวดเงินเดือน<select className="workspace-control" value={value} onChange={(event) => onChange(visible.find((period) => period.id === event.target.value) ?? null)} disabled={!shopId || loading} required><option value="">{loading ? "กำลังโหลด…" : "เลือกงวด"}</option>{visible.map((period) => <option key={period.id} value={period.id}>{String(period.period_month).padStart(2, "0")}/{period.period_year} · {period.status === "locked" ? "ล็อกแล้ว" : period.status === "previewed" ? "คำนวณแล้ว" : "ร่าง"}</option>)}</select></label>
    {shopId && !loading && !visible.length && <p className="text-sm text-[var(--muted)] sm:col-span-2">{lockedOnly ? "ยังไม่มีงวดที่ล็อกแล้ว ไปหน้าเงินเดือนเพื่อคำนวณและล็อกรอบก่อน" : "ยังไม่มีงวดในร้านนี้"}</p>}
    {error && <div className="sm:col-span-2"><Feedback kind="error" detail={error} /></div>}
  </div>;
}
