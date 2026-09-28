"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { authApi } from "@/lib/auth/auth-api";
import { organizationApi, type AccountSummary, type Branch, type Role, type Shop } from "@/lib/organization/organization-api";

const field = "mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-sm";
const button = "rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45";
const messageFor = (cause: unknown) => cause instanceof ApiClientError ? `${cause.message} (${cause.code})` : "ไม่สามารถทำรายการได้";

export default function SettingsPage() {
  const [shops, setShops] = useState<Shop[]>([]); const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]); const [roles, setRoles] = useState<Role[]>([]);
  const [shopId, setShopId] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [ready, setReady] = useState(false); const [owner, setOwner] = useState(false);
  const activeRoles = useMemo(() => roles.filter((role) => role.is_active), [roles]);

  const reload = async () => {
    setError("");
    try {
      const [actor, shopRows, roleRows, accountPage] = await Promise.all([
        authApi.current(), organizationApi.listActiveShops(), organizationApi.listRoles(), organizationApi.listAccounts(),
      ]);
      setOwner(actor.grants.some((grant) => grant.role_code === "OWNER" && grant.scope === "all"));
      setShops(shopRows); setRoles(roleRows); setAccounts(accountPage.data.items); setShopId((current) => current || shopRows[0]?.id || "");
    } catch (cause) { setError(messageFor(cause)); } finally { setReady(true); }
  };
  useEffect(() => { void Promise.resolve().then(reload); }, []);
  useEffect(() => { if (shopId) void organizationApi.listActiveBranches(shopId).then(setBranches).catch((cause) => setError(messageFor(cause))); }, [shopId]);

  const submit = <T,>(work: (form: FormData) => Promise<T>, success: string, onSuccess?: (result: T) => void) => async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setNotice("");
    try { const result = await work(new FormData(event.currentTarget)); onSuccess?.(result); setNotice(success); await reload(); } catch (cause) { setError(messageFor(cause)); }
  };

  if (!ready) return null;
  if (!owner) return <section className="max-w-xl border border-[var(--line)] bg-[var(--surface)] p-6"><h1 className="text-2xl font-semibold">การตั้งค่าองค์กร</h1><p className="mt-3 leading-7 text-[var(--muted)]">หน้านี้สำหรับ Owner เท่านั้น บัญชีปัจจุบันไม่มีสิทธิ์จัดการร้าน บัญชี หรือบทบาท</p></section>;

  return <div className="space-y-8">
    <header className="border-b border-[var(--line)] pb-7"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">ตั้งค่าพร้อมใช้งาน</h1><p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">เตรียมร้าน สาขา บัญชี และขอบเขตบทบาทก่อนเริ่มรอบเงินเดือน ข้อมูลสำคัญถูกตรวจสิทธิ์โดย server ทุกครั้ง</p></header>
    {notice ? <p role="status" className="bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink)]">{notice}</p> : null}
    {error ? <p role="alert" className="bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p> : null}
    <section className="grid gap-6 lg:grid-cols-2"><form className="border border-[var(--line)] bg-[var(--surface)] p-5" onSubmit={submit((form) => organizationApi.createShop({ code: String(form.get("code")), name: String(form.get("name")) }), "เพิ่มร้านแล้ว")}><h2 className="text-xl font-semibold">1. ร้าน</h2><label className="mt-5 block text-sm">รหัสร้าน<input className={field} name="code" required maxLength={30} /></label><label className="mt-4 block text-sm">ชื่อร้าน<input className={field} name="name" required maxLength={150} /></label><button className={`${button} mt-5`}>เพิ่มร้าน</button></form>
      <form className="border border-[var(--line)] bg-[var(--surface)] p-5" onSubmit={submit((form) => organizationApi.createBranch({ shop_id: String(form.get("shop_id")), code: String(form.get("code")), name: String(form.get("name")) }), "เพิ่มสาขาแล้ว")}><h2 className="text-xl font-semibold">2. สาขา</h2><label className="mt-5 block text-sm">ร้าน<select className={field} name="shop_id" value={shopId} onChange={(event) => setShopId(event.target.value)} required><option value="">เลือกร้าน</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.code} · {shop.name}</option>)}</select></label><label className="mt-4 block text-sm">รหัสสาขา<input className={field} name="code" required maxLength={30} /></label><label className="mt-4 block text-sm">ชื่อสาขา<input className={field} name="name" required maxLength={150} /></label><button className={`${button} mt-5`} disabled={!shopId}>เพิ่มสาขา</button></form></section>
    <section className="grid gap-6 border-t border-[var(--line)] pt-7 lg:grid-cols-2"><form className="border border-[var(--line)] bg-[var(--surface)] p-5" onSubmit={submit((form) => organizationApi.createAccount({ username: String(form.get("username")) }), "สร้างบัญชีแล้ว จดรหัสชั่วคราวก่อนออกจากหน้านี้", (result) => setTemporaryPassword(result.temporary_password))}><h2 className="text-xl font-semibold">3. บัญชี</h2><label className="mt-5 block text-sm">ชื่อผู้ใช้<input className={field} name="username" required minLength={3} maxLength={100} /></label><button className={`${button} mt-5`}>สร้างบัญชี</button>{temporaryPassword ? <output className="mt-4 block border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">รหัสชั่วคราว (แสดงครั้งนี้เท่านั้น): <strong>{temporaryPassword}</strong></output> : <p className="mt-4 text-xs leading-5 text-[var(--muted)]">รหัสชั่วคราวจะแสดงครั้งเดียวหลังสร้างบัญชี</p>}</form>
      <form className="border border-[var(--line)] bg-[var(--surface)] p-5" onSubmit={submit((form) => organizationApi.grantRole(String(form.get("account_id")), { role_code: String(form.get("role_code")) as Role["code"], branch_id: String(form.get("branch_id")) || null, department_id: null, reason: String(form.get("reason")) }), "กำหนดบทบาทแล้ว")}><h2 className="text-xl font-semibold">4. บทบาทและขอบเขต</h2><label className="mt-5 block text-sm">บัญชี<select className={field} name="account_id" required><option value="">เลือกบัญชี</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.username} · {account.status}</option>)}</select></label><label className="mt-4 block text-sm">บทบาท<select className={field} name="role_code" required>{activeRoles.filter((role) => role.code !== "OWNER").map((role) => <option key={role.id} value={role.code}>{role.name} · {role.scope}</option>)}</select></label><label className="mt-4 block text-sm">สาขา <span className="text-[var(--muted)]">(เฉพาะ branch scope)</span><select className={field} name="branch_id"><option value="">ไม่ระบุ</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}</select></label><label className="mt-4 block text-sm">เหตุผล<input className={field} name="reason" required maxLength={500} /></label><button className={`${button} mt-5`}>กำหนดบทบาท</button></form></section>
    <section className="border-t border-[var(--line)] pt-6"><h2 className="font-semibold">สถานะการเตรียมข้อมูล</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">ร้าน {shops.length} รายการ · สาขาในร้านที่เลือก {branches.length} รายการ · บัญชี {accounts.length} รายการ — จากนั้นไปที่ Payroll เพื่อกำหนดค่าคำนวณและเปิดรอบ</p></section>
  </div>;
}
