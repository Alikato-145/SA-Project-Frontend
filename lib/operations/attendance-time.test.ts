import { expect, test } from "bun:test";
import { attendanceTimes, bangkokTime } from "./attendance-time";

test("combines work date and time in Bangkok, with overnight rollover", () => {
  expect(attendanceTimes("2026-10-31", "09:07", "18:00")).toEqual({ clockIn: "2026-10-31T02:07:00.000Z", clockOut: "2026-10-31T11:00:00.000Z" });
  expect(attendanceTimes("2026-10-31", "22:00", "02:00")).toEqual({ clockIn: "2026-10-31T15:00:00.000Z", clockOut: "2026-10-31T19:00:00.000Z" });
  expect(attendanceTimes("2026-10-31", "", "")).toEqual({ clockIn: null, clockOut: null });
  expect(bangkokTime("2026-10-31T19:00:00.000Z")).toBe("02:00");
  expect(attendanceTimes("2026-10-31", "08:00", "09:00", "2026-11-01T02:00:00.000Z").clockOut).toBe("2026-11-01T02:00:00.000Z");
});
