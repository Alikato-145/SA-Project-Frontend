import { expect, test } from "bun:test";
import { payrollMonth } from "./payroll-month";

test("payroll month uses calendar boundaries and rejects invalid browser fallback text", () => {
  expect(payrollMonth("2028-02").end).toBe("2028-02-29");
  expect(payrollMonth("2026-02").end).toBe("2026-02-28");
  expect(payrollMonth("2026-10")).toEqual({ year: 2026, month: 10, start: "2026-10-01", end: "2026-10-31" });
  for (const value of ["2026-13", "2026-1", "10/2026", "2569-10"]) expect(() => payrollMonth(value)).toThrow();
});
