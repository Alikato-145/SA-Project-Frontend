import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <section className="max-w-2xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
      <p className="text-sm font-semibold text-[var(--accent)]">สิทธิ์ไม่เพียงพอ</p>
      <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">คุณเปิดส่วนงานนี้ไม่ได้</h1>
      <p className="mt-4 leading-7 text-[var(--muted)]">บัญชีนี้ไม่มีสิทธิ์สำหรับส่วนงานที่เลือก หากคิดว่าเป็นข้อผิดพลาด ให้ติดต่อ HR หรือผู้ดูแลระบบ</p>
      <Link href="/dashboard" className="mt-6 inline-flex rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white active:translate-y-px">กลับหน้าภาพรวม</Link>
    </section>
  );
}
