"use client";

export default function PayrollError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-6" role="alert"><h2 className="text-xl font-semibold text-red-950">เปิดสมุดงานเงินเดือนไม่สำเร็จ</h2><p className="mt-2 text-sm text-red-900">ตรวจการเชื่อมต่อและสิทธิ์ของบัญชี แล้วลองอีกครั้ง</p><button className="mt-5 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white" onClick={retry}>ลองอีกครั้ง</button></div>;
}
