export const payrollMonth = (value: string) => {
  if (!/^(20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(value)) throw new Error("กรอกเดือนแบบ YYYY-MM เช่น 2026-10 โดยใช้ปี ค.ศ.");
  const [year, month] = value.split("-").map(Number);
  return { year, month, start: `${value}-01`, end: `${value}-${new Date(Date.UTC(year!, month!, 0)).getUTCDate()}` };
};
