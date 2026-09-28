"use client";

export default function SettingsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <section className="max-w-xl border border-red-200 bg-red-50 p-6"><h1 className="text-xl font-semibold text-red-950">เปิดการตั้งค่าไม่สำเร็จ</h1><p className="mt-2 text-sm leading-6 text-red-900">ตรวจสิทธิ์ Owner และการเชื่อมต่อ แล้วลองใหม่อีกครั้ง</p><button className="mt-5 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white" onClick={retry}>ลองอีกครั้ง</button></section>;
}
