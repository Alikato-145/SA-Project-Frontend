"use client";
import { useEffect,useState,type FormEvent } from "react";
import { operationsApi } from "@/lib/operations/operations-api";
import { Feedback } from "./workspace-ui";
type Type={id:string;code:string;nameTh:string;description:string|null;isActive:boolean};
export function DebtTypeAdministration({onChanged}:{onChanged():void}) {
  const [types,setTypes]=useState<Type[]>([]);
  const [editing,setEditing]=useState<Type|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{const abort=new AbortController();void operationsApi.request<Type[]>("/debt-types/manage",{signal:abort.signal}).then(setTypes).catch(cause=>{if(!abort.signal.aborted)setError(cause.message);});return()=>abort.abort();},[]);
  const save=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setError("");setNotice("");
    try {
      await operationsApi.request(`/debt-types${editing?`/${editing.id}`:""}`,{method:editing?"PATCH":"POST",body:JSON.stringify({code:form.get("code"),name_th:form.get("name_th"),description:String(form.get("description"))||null,is_active:form.get("is_active")==="on"})});
      setTypes(await operationsApi.request<Type[]>("/debt-types/manage"));setEditing(null);setNotice("บันทึกประเภทหนี้แล้ว");onChanged();
    }catch(cause){setError(cause instanceof Error?cause.message:"บันทึกไม่สำเร็จ");}finally{setBusy(false);}
  };
  return <details className="workspace-section"><summary className="cursor-pointer text-xl font-semibold">จัดการประเภทหนี้</summary><p className="mt-3 text-sm text-[var(--muted)]">ปิดการใช้งานเพื่อหยุดรับรายการใหม่ ประวัติเดิมและยอดหนี้จะยังอยู่ รหัสประเภทที่มีรายการแล้วเปลี่ยนไม่ได้</p>{error&&<Feedback kind="error" detail={error}/ >}{notice&&<Feedback kind="success" detail={notice}/>}
    <div className="mt-5 grid gap-6 lg:grid-cols-2"><form key={editing?.id??"new"} onSubmit={save} className="space-y-3"><h3 className="font-semibold">{editing?`แก้ไข ${editing.nameTh}`:"เพิ่มประเภทหนี้"}</h3>
      <label className="block text-sm">รหัสประเภท<input className="workspace-control" name="code" defaultValue={editing?.code} required pattern="[A-Z][A-Z0-9_]{0,29}" placeholder="FOOD"/></label>
      <label className="block text-sm">ชื่อประเภท<input className="workspace-control" name="name_th" defaultValue={editing?.nameTh} required maxLength={100}/></label>
      <label className="block text-sm">รายละเอียด<input className="workspace-control" name="description" defaultValue={editing?.description??""} maxLength={1000}/></label>
      <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={editing?.isActive??true}/>เปิดใช้งาน</label>
      <div className="flex gap-2"><button className="workspace-primary" disabled={busy}>บันทึกประเภทหนี้</button>{editing&&<button type="button" className="workspace-secondary" disabled={busy} onClick={()=>setEditing(null)}>เพิ่มประเภทใหม่</button>}</div>
    </form><ul className="space-y-3">{types.map(type=><li key={type.id} className="flex justify-between gap-3 border-b border-[var(--line)] pb-3"><span>{type.nameTh} · {type.isActive?"ใช้งาน":"ปิดใช้งาน"}</span><button type="button" className="workspace-secondary" disabled={busy} onClick={()=>setEditing(type)}>แก้ไข</button></li>)}</ul></div>
  </details>;
}
