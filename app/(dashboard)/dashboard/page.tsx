import Link from "next/link";

const upcomingAreas = [
  ["ข้อมูลพนักงาน", "รอเชื่อมต่อข้อมูลพนักงานและประวัติการทำงาน"],
  ["เวลาและการอนุมัติ", "รอเชื่อมต่อเวลาเข้างาน การลา และ OT"],
  ["รอบเงินเดือน", "รอเชื่อมต่อการคำนวณและล็อกรอบเงินเดือน"],
] as const;

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <section className="grid gap-6 border-b border-[var(--line)] pb-10 md:grid-cols-[minmax(0,1.5fr)_minmax(15rem,0.7fr)] md:items-end">
        <div>
          <p className="mb-3 text-sm font-semibold text-[var(--accent)]">ภาพรวม</p>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">โครงกลางพร้อมสำหรับเชื่อมแต่ละส่วนงาน</h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">หน้านี้เป็น mock สำหรับ C1 เท่านั้น ข้อมูลจริงและสิทธิ์การใช้งานจะเชื่อมจาก feature ที่เกี่ยวข้องภายหลัง</p>
        </div>
        <div className="rounded-2xl bg-[var(--accent-soft)] p-5">
          <p className="text-sm font-semibold text-[var(--accent)]">สถานะโครงระบบ</p>
          <p className="mt-2 text-lg font-semibold">พร้อมเชื่อมต่อ</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Navigation และ shared states ใช้งานได้แล้ว</p>
        </div>
      </section>

      <section aria-labelledby="upcoming-heading">
        <div className="max-w-2xl">
          <h2 id="upcoming-heading" className="text-xl font-semibold">ส่วนงานที่รอเชื่อมต่อ</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">เมนูเหล่านี้ยังไม่เปิดใช้งาน เพื่อไม่ให้ mock UI ดูเหมือนมี business flow จริง</p>
        </div>
        <div className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {upcomingAreas.map(([title, description]) => (
            <div key={title} className="grid gap-2 py-5 sm:grid-cols-[13rem_1fr]">
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <h2 className="font-semibold">ตรวจตัวอย่างหน้าสิทธิ์ไม่เพียงพอ</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">ใช้ตรวจรูปแบบ shared forbidden state ของ C1</p>
        </div>
        <Link href="/dashboard/forbidden" className="mt-4 inline-flex rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white transition-transform active:translate-y-px sm:mt-0">เปิดตัวอย่าง</Link>
      </section>
    </div>
  );
}
