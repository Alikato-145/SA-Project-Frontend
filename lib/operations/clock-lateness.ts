export function clockLateMinutes(localClock: string, start: string | null | undefined, grace: number): number | null {
  const clock = /T(\d{2}):(\d{2})/.exec(localClock), scheduled = /^(\d{2}):(\d{2})/.exec(start ?? "");
  if (!clock || !scheduled) return null;
  const [hour, minute, startHour, startMinute] = [clock[1], clock[2], scheduled[1], scheduled[2]].map(Number);
  if (hour >= 24 || startHour >= 24 || minute >= 60 || startMinute >= 60 || !Number.isInteger(grace) || grace < 0) return null;
  return Math.max(0, hour * 60 + minute - startHour * 60 - startMinute - grace);
}
