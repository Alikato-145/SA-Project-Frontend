"use client";

export default function DashboardError({ retry }: { retry: () => void }) {
  return (
    <section className="max-w-2xl rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
      <h1 className="text-2xl font-semibold text-red-950">โหลดข้อมูลส่วนนี้ไม่สำเร็จ</h1>
      <p className="mt-3 leading-7 text-[var(--muted)]">ลองโหลดอีกครั้ง หากยังเกิดปัญหาให้ติดต่อผู้ดูแลระบบ</p>
      <button type="button" onClick={() => retry()} className="workspace-primary mt-6">ลองอีกครั้ง</button>
    </section>
  );
}
