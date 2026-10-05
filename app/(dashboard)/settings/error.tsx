"use client";

export default function SettingsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <section className="max-w-xl rounded-lg border border-red-200 bg-red-50 p-6" role="alert"><h1 className="text-xl font-semibold text-red-950">เปิดการตั้งค่าไม่สำเร็จ</h1><p className="mt-2 text-sm leading-6 text-red-900">ตรวจสิทธิ์ Owner และการเชื่อมต่อ แล้วลองใหม่อีกครั้ง</p><button className="workspace-primary mt-5" onClick={retry}>ลองอีกครั้ง</button></section>;
}
