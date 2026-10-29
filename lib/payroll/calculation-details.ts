import type { PayrollItem } from "./payroll-api";
import { configurationOptions, type ConfigurationKey } from "./configuration-options";
import { toConfigurationInput } from "./configuration-values";

export function calculationDetail(item: PayrollItem, branches: Record<string, string>): string {
  const description = item.description;
  if (description === "Automatic standard workdays") return `จำนวนวันทำงานมาตรฐาน: ${item.quantity === null ? "ไม่ระบุ" : Number(item.quantity)} วัน`;
  const config = /^Configuration ([A-Z_]+)$/.exec(description);
  if (config) {
    const key = config[1]!;
    const option = configurationOptions[key as ConfigurationKey];
    if (!option) return description;
    return `${option.label}: ${item.rate === null ? "ไม่ระบุ" : toConfigurationInput(key, item.rate)} ${option.unitLabel}`;
  }
  const calendar = /^Workday calendar \d{4}-\d{2}-\d{2}; branch=(\d+); working=(true|false); reasons=(.*)$/.exec(description);
  if (calendar) {
    const reasons: Record<string, string> = { weekly: "วันหยุดประจำสัปดาห์", public: "วันหยุดร้าน", branch_closed: "สาขาปิด" };
    const status = calendar[2] === "true" ? "วันทำงานตามกำหนด" : calendar[3]!.split(",").map(value => reasons[value] ?? value).filter(Boolean).join(", ") || "วันหยุด";
    return `${status} · ${branches[calendar[1]!] ?? `สาขา ${calendar[1]}`}`;
  }
  const attendance = /^Attendance (\w+); late_minutes=(\d+); deductible=(true|false)$/.exec(description);
  if (attendance) {
    const labels: Record<string, string> = { present: "มาทำงาน", late: "มาสาย", absent: "ขาดงาน", leave: "ลา", weekly_holiday: "วันหยุดประจำสัปดาห์", public_holiday: "วันหยุดร้าน" };
    const status = labels[attendance[1]!] ?? attendance[1];
    return `${status}${attendance[1] === "late" ? ` ${attendance[2]} นาที` : ""} · ${attendance[3] === "true" ? "หักเงิน" : "ไม่หักเงิน"}`;
  }
  if (description.startsWith("Approved leave ")) {
    const paid = /(?:^|; )paid=(true|false)/.exec(description);
    const deductible = /(?:^|; )deductible=(true|false)/.exec(description);
    return `การลาที่อนุมัติแล้ว${paid ? paid[1] === "true" ? " · ได้รับค่าจ้าง" : " · ไม่ได้รับค่าจ้าง" : ""}${deductible ? deductible[1] === "true" ? " · หักเงิน" : " · ไม่หักเงิน" : ""}`;
  }
  return description || "ข้อมูลประกอบการคำนวณ";
}
export function groupPayrollMoney(items: readonly PayrollItem[]): { itemType: string; direction: PayrollItem["direction"]; total: string; items: PayrollItem[] }[] {
  const groups = new Map<string, { itemType: string; direction: PayrollItem["direction"]; cents: bigint; items: PayrollItem[] }>();
  for (const item of items) {
    const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(item.amount);
    if (!match) throw new Error("Invalid payroll amount");
    const cents = (BigInt(match[2]!) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0"))) * (match[1] ? BigInt(-1) : BigInt(1));
    if (item.item_type === "other" && cents === BigInt(0)) continue;
    const key = `${item.item_type}:${item.direction}`;
    const group = groups.get(key) ?? { itemType: item.item_type, direction: item.direction, cents: BigInt(0), items: [] };
    group.cents += cents; group.items.push(item); groups.set(key, group);
  }
  return [...groups.values()].map(({ cents, ...group }) => {
    const absolute = cents < BigInt(0) ? -cents : cents;
    return { ...group, total: `${cents < BigInt(0) ? "-" : ""}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}` };
  });
}

export function calculationCategory(item: PayrollItem): string {
  if (item.description.startsWith("Workday calendar ")) return "วันทำงานและวันหยุดตามตาราง";
  if (item.description.startsWith("Attendance ")) return "ข้อมูลการลงเวลา";
  if (item.description.startsWith("Configuration ") || item.description === "Automatic standard workdays") return "ค่าที่ใช้คำนวณ";
  if (item.description.startsWith("Approved leave ")) return "การลาที่อนุมัติแล้ว";
  return "ข้อมูลประกอบอื่น ๆ";
}
