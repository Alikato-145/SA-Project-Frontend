"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { apiRequestPage,type ApiPage } from "@/lib/api/client";
import { Feedback,formatThaiDate,formatThaiMoney,thaiLabel } from "./workspace-ui";
export type ReportKind="attendance"|"leave"|"overtime"|"debt"|"payroll";
type Row={id:string;employee_id:string;employee_code:string;employee_name:string;date:string;status:string;quantity:string|null;quantity_unit:string|null;amount:string|null};
export function ReportDetails({periodId,kind,branchId,departmentId,onClose}:{periodId:string;kind:ReportKind;branchId:string;departmentId:string;onClose():void}) {
  const [page,setPage]=useState(1);
  const [result,setResult]=useState<ApiPage<Row>|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    const abort=new AbortController();
    const query=new URLSearchParams({period_id:periodId,kind,page:String(page),page_size:"20",...(branchId?{branch_id:branchId}:{}),...(departmentId?{department_id:departmentId}:{})});
    void apiRequestPage<Row>(`/v1/reports/details?${query}`,{credentials:"same-origin",signal:abort.signal}).then(value=>{if(!abort.signal.aborted)setResult(value);}).catch(cause=>{if(!abort.signal.aborted)setError(cause.message);});
    return()=>abort.abort();
  },[periodId,kind,branchId,departmentId,page]);
  return <section className="workspace-section"><div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">รายการประกอบรายงาน ({result?.total??0})</h2><button className="workspace-secondary" type="button" onClick={onClose}>ปิดรายการ</button></div>
    {error?<Feedback kind="error" detail={error}/>:!result?<Feedback kind="loading" detail="กำลังโหลดรายการ…"/>:<><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr><th className="py-3">พนักงาน</th><th>วันที่</th><th>สถานะ</th><th>จำนวน</th><th className="text-right">ยอดเงิน</th></tr></thead><tbody>{result.data.map(row=><tr key={row.id} className="border-t border-[var(--line)]"><td className="py-3"><Link className="underline" href={`/employees/${row.employee_id}`}>{row.employee_code} · {row.employee_name}</Link></td><td>{formatThaiDate(row.date)}</td><td>{thaiLabel(row.status)}</td><td>{row.quantity??"—"} {row.quantity_unit==="hours"?"ชั่วโมง":row.quantity_unit==="days"?"วัน":""}</td><td className="text-right tabular-nums">{row.amount===null?"—":formatThaiMoney(row.amount)}</td></tr>)}{!result.data.length&&<tr><td colSpan={5} className="py-5">ไม่มีรายการในขอบเขตที่เลือก</td></tr>}</tbody></table></div><div className="mt-4 flex items-center justify-between gap-3"><button type="button" className="workspace-secondary" disabled={page<=1} onClick={()=>{setResult(null);setPage(value=>value-1);}}>ก่อนหน้า</button><span className="text-sm">หน้า {page} / {Math.max(1,Math.ceil(result.total/20))}</span><button type="button" className="workspace-secondary" disabled={page*20>=result.total} onClick={()=>{setResult(null);setPage(value=>value+1);}}>ถัดไป</button></div></>}
  </section>;
}
