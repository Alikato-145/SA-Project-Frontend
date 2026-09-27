export default function PayrollLoading() {
  return <div aria-busy="true" className="space-y-6"><div className="h-24 animate-pulse bg-[var(--accent-soft)]" /><div className="grid gap-4 lg:grid-cols-[17rem_1fr]"><div className="h-72 animate-pulse bg-white" /><div className="h-72 animate-pulse bg-white" /></div><p className="sr-only">กำลังโหลดสมุดงานเงินเดือน</p></div>;
}
