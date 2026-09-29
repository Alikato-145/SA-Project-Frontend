import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type FeedbackKind = "loading" | "empty" | "success" | "warning" | "error" | "final";

const labels: Record<string, string> = {
  pending: "รอพิจารณา",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิกแล้ว",
  locked: "ล็อกแล้ว",
  draft: "ฉบับร่าง",
  generated: "ออกแล้ว",
  voided: "ยกเลิกแล้ว",
  present: "มาทำงาน",
  late: "มาสาย",
  absent: "ขาดงาน",
  weekly_holiday: "วันหยุดประจำสัปดาห์",
  public_holiday: "วันหยุดนักขัตฤกษ์",
  hourly: "รายชั่วโมง",
  rest_day: "วันหยุดประจำสัปดาห์",
  charge: "บันทึกหนี้",
  adjustment: "ปรับยอด",
  reversal: "กลับรายการ",
  active: "ใช้งาน",
  inactive: "ปิดใช้งาน",
};

export const thaiLabel = (value: string | null | undefined, fallback = "ไม่ระบุ") =>
  value ? (labels[value] ?? value.replaceAll("_", " ")) : fallback;

export const formatThaiDate = (value: string | null | undefined) => {
  if (!value) return "ไม่ระบุวันที่";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(date);
};

export const formatThaiMoney = (value: string | number | null | undefined) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 })
    .format(Number(value ?? 0));

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-6 sm:pb-7">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{title}</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function Feedback({ kind, title, detail }: { kind: FeedbackKind; title?: string; detail: string }) {
  const styles = {
    loading: "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]",
    empty: "border-dashed border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    error: "border-red-200 bg-red-50 text-red-950",
    final: "border-[var(--line)] bg-[var(--accent-soft)] text-[var(--ink)]",
  }[kind];
  return (
    <Alert className={cn("px-4 py-3", styles)} role={kind === "error" ? "alert" : "status"} aria-live="polite">
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription className="text-current">{detail}</AlertDescription>
    </Alert>
  );
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const normalized = value ?? "";
  const tone = ["rejected", "voided", "absent"].includes(normalized)
    ? "border-red-200 bg-red-50 text-red-900"
    : ["pending", "draft", "late"].includes(normalized)
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : ["approved", "locked", "generated", "present"].includes(normalized)
        ? "border-emerald-200 bg-emerald-50 text-emerald-950"
        : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]";
  return <Badge variant="outline" className={cn("h-auto px-2.5 py-1 text-xs font-semibold", tone)}>{thaiLabel(value)}</Badge>;
}

export function FinalStateNote({ children }: { children: ReactNode }) {
  return <Feedback kind="final" title="ข้อมูลนี้อยู่ในสถานะสุดท้าย" detail={String(children)} />;
}
