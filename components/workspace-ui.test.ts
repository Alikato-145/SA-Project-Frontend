import { expect, test } from "bun:test";
import { Feedback, StatusBadge, formatThaiDate, formatThaiMoney, thaiLabel } from "./workspace-ui";

test("uses Thai labels for operational states instead of raw API codes", () => {
  expect(thaiLabel("pending")).toBe("รอพิจารณา");
  expect(thaiLabel("public_holiday")).toBe("วันหยุดนักขัตฤกษ์");
  expect(thaiLabel(null)).toBe("ไม่ระบุ");
  expect(StatusBadge({ value: "approved" }).props.children).toBe("อนุมัติแล้ว");
});

test("formats dates and money for Thai operational screens", () => {
  expect(formatThaiDate("2026-09-29")).toContain("29");
  expect(formatThaiMoney("1250.5")).toContain("1,250.50");
});

test("exposes feedback with status or alert semantics", () => {
  expect(Feedback({ kind: "success", detail: "บันทึกแล้ว" }).props.role).toBe("status");
  expect(Feedback({ kind: "error", detail: "ลองใหม่" }).props.role).toBe("alert");
});
