"use client";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api/client";
import { downloadApiFile } from "@/lib/api/download";
import { Feedback, formatThaiDate } from "@/components/workspace-ui";
type Attachment = { id: string; file_name: string; file_size_bytes: number; uploaded_at: string };
export function AttachmentPanel({ path }: { path: string }) {
  const [rows, setRows] = useState<Attachment[]>([]), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Attachment[]>(path, { signal: controller.signal, credentials: "same-origin" }).then((items) => {
      if (!controller.signal.aborted) setRows(items);
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, reload]);
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form), file = data.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) { setError("เลือกไฟล์ไม่เกิน 5 MB ก่อนแนบเอกสาร"); return; }
    setBusy(true); setError(""); setNotice("");
    try { await apiRequest(path, { method: "POST", credentials: "same-origin", body: data }); form.reset(); setReload((value) => value + 1); setNotice("แนบเอกสารแล้ว"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "แนบไฟล์ไม่สำเร็จ"); } finally { setBusy(false); }
  };
  return <section className="mt-4 space-y-3">
    <h3 className="font-semibold">เอกสารประกอบ</h3>
    <p className="text-sm text-[var(--muted)]">PDF, PNG หรือ JPEG ไม่เกิน 5 MB เอกสารที่บันทึกจะเก็บไว้เป็นหลักฐาน</p>
    {error ? <Feedback kind="error" detail={error} /> : null}{notice ? <Feedback kind="success" detail={notice} /> : null}
    <form onSubmit={(event) => { void upload(event); }} className="flex flex-wrap items-end gap-3">
      <label className="block flex-1 text-sm">ไฟล์เอกสาร<input className="workspace-control" type="file" name="file" accept="application/pdf,image/png,image/jpeg" required disabled={busy} /></label>
      <button className="workspace-primary" disabled={busy}>{busy ? "กำลังแนบ…" : "แนบเอกสาร"}</button>
    </form>
    {loading ? <p role="status">กำลังโหลดเอกสาร…</p> : rows.length ? <ul className="divide-y divide-[var(--line)]">{rows.map((row) => <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={row.id}>
      <span>{row.file_name} · {Math.ceil(row.file_size_bytes / 1024)} KB · {formatThaiDate(row.uploaded_at)}</span>
      <button className="workspace-secondary" onClick={async () => {
        setError(""); try { await downloadApiFile(`/v1/attachments/${row.id}/download`, row.file_name); } catch (cause) { setError(cause instanceof Error ? cause.message : "ดาวน์โหลดไม่สำเร็จ"); }
      }}>ดาวน์โหลด</button></li>)}</ul> : <p className="text-sm text-[var(--muted)]">ยังไม่มีเอกสาร</p>}
  </section>;
}
