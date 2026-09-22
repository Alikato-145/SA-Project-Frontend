export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-10" aria-label="กำลังโหลดข้อมูล">
      <div className="space-y-4 border-b border-[var(--line)] pb-10">
        <div className="h-4 w-20 rounded bg-[var(--line)]" />
        <div className="h-10 max-w-xl rounded-xl bg-[var(--line)]" />
        <div className="h-5 max-w-2xl rounded bg-[var(--line)]" />
      </div>
      <div className="space-y-4">
        <div className="h-7 w-52 rounded bg-[var(--line)]" />
        <div className="h-20 rounded-xl bg-[var(--line)]" />
        <div className="h-20 rounded-xl bg-[var(--line)]" />
      </div>
    </div>
  );
}
