"use client";

import { useState } from "react";
import { configurationOptions, type ConfigurationKey } from "@/lib/payroll/configuration-options";
import { fromConfigurationInput, toConfigurationInput } from "@/lib/payroll/configuration-values";
import { payrollApi, type PayrollConfiguration } from "@/lib/payroll/payroll-api";

export function PayrollConfigurationSuccessor({ configuration, onSaved }: { configuration: PayrollConfiguration; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const option = configurationOptions[configuration.config_key as ConfigurationKey];
  return <details className="mt-2"><summary className="cursor-pointer underline">เปลี่ยนค่าตั้งแต่วันที่</summary>
    <form className="mt-2 space-y-2" onSubmit={async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError("");
      try {
        await payrollApi.supersedeConfiguration(configuration.id, { numeric_value: fromConfigurationInput(configuration.config_key, String(data.get("numeric_value"))), effective_from: String(data.get("effective_from")), effective_to: configuration.effective_to });
        onSaved();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ"); }
      finally { setBusy(false); }
    }}>
      <p className="text-xs text-[var(--muted)]">จบช่วงเดิมก่อนวันที่ใหม่หนึ่งวันและเก็บค่าเดิมเป็นประวัติ งวดที่ล็อกแล้วเปลี่ยนไม่ได้</p>
      <label className="block">ค่าใหม่ {option && <span className="text-[var(--muted)]">({option.unitLabel})</span>}<input name="numeric_value" className="workspace-control" type="number" min={option?.min ?? "0"} max={option?.max} step={option?.step ?? "0.0001"} defaultValue={toConfigurationInput(configuration.config_key, configuration.numeric_value)} required /></label>
      <label className="block">วันที่เริ่มใช้ค่าใหม่<input name="effective_from" className="workspace-control" type="date" min={configuration.effective_from} max={configuration.effective_to ?? undefined} required /></label>
      <button className="workspace-secondary" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกช่วงใหม่"}</button>
      {error && <p role="alert" className="text-red-800">{error}</p>}
    </form>
  </details>;
}
