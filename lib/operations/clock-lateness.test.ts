import { expect, test } from "bun:test";
import { clockLateMinutes } from "./clock-lateness";
test("clock entry follows historical start and grace boundaries without depending on browser timezone", () => {
  expect(clockLateMinutes("2026-09-01T09:05", "09:00:00", 5)).toBe(0);
  expect(clockLateMinutes("2026-09-01T09:06", "09:00", 5)).toBe(1);
  expect(clockLateMinutes("2026-09-01T09:07", "09:00", 5)).toBe(2);
  expect(clockLateMinutes("2026-09-01T09:07", "10:00", 0)).toBe(0);
  expect(clockLateMinutes("", "09:00", 5)).toBeNull();
  expect(clockLateMinutes("2026-09-01T25:00", "09:00", 5)).toBeNull();
});
