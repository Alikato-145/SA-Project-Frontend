"use client";

export default function DashboardError({ retry }: { retry: () => void }) {
  return (
    <section className="max-w-2xl rounded-2xl border border-red-200 bg-white p-6" role="alert">
      <p className="text-sm font-semibold text-red-700">เกิดข้อผิดพลาด</p>
      <h1 className="mt-2 text-2xl font-semibold">โหลดข้อมูลส่วนนี้ไม่สำเร็จ</h1>
      <p className="mt-3 leading-7 text-[var(--muted)]">ลองโหลดอีกครั้ง หากยังเกิดปัญหาให้ติดต่อผู้ดูแลระบบ</p>
      <button type="button" onClick={() => retry()} className="mt-6 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white active:translate-y-px">ลองอีกครั้ง</button>
    </section>
  );
}
