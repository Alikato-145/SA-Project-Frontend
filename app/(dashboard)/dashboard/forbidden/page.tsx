import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <section className="workspace-section max-w-2xl sm:p-8">
      <h1 className="text-2xl font-semibold sm:text-3xl">คุณเปิดส่วนงานนี้ไม่ได้</h1>
      <p className="mt-4 leading-7 text-[var(--muted)]">บัญชีนี้ไม่มีสิทธิ์สำหรับส่วนงานที่เลือก หากคิดว่าเป็นข้อผิดพลาด ให้ติดต่อ HR หรือผู้ดูแลระบบ</p>
      <Link href="/dashboard" className="workspace-primary mt-6">กลับหน้าภาพรวม</Link>
    </section>
  );
}
