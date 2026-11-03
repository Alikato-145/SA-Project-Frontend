export function bangkokTime(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

export function attendanceTimes(workDate: string, clockIn: string, clockOut: string, originalClockOut?: string | null) {
  const nextDay = clockIn && clockOut && clockOut < clockIn;
  let endDate = nextDay ? new Date(Date.parse(`${workDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : workDate;
  if (originalClockOut && bangkokTime(originalClockOut) === clockOut) {
    const previousDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(originalClockOut));
    if (previousDate > workDate) endDate = previousDate;
  }
  const instant = (date: string, time: string) => time ? new Date(`${date}T${time}+07:00`).toISOString() : null;
  return { clockIn: instant(workDate, clockIn), clockOut: instant(endDate, clockOut) };
}
