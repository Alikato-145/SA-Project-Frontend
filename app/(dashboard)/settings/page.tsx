"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AccountCreateLive, RoleScopeForm } from "@/features/identity-hr/accounts/account-live";
import { Feedback, PageHeader } from "@/components/workspace-ui";
import { ApiClientError } from "@/lib/api/client";
import { authApi } from "@/lib/auth/auth-api";
import { organizationApi, type AccountSummary, type Branch, type Shop } from "@/lib/organization/organization-api";

const field = "workspace-control";
const button = "workspace-primary";
const messageFor = (cause: unknown) => cause instanceof ApiClientError ? `${cause.message} (${cause.code})` : "ไม่สามารถทำรายการได้";

export default function SettingsPage() {
  const [shops, setShops] = useState<Shop[]>([]); const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [shopId, setShopId] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [ready, setReady] = useState(false); const [owner, setOwner] = useState(false);


  const reload = useCallback(async (selectedShopId = "") => {
    setError("");
    try {
      const actor = await authApi.current();
      const isOwner = actor.grants.some((grant) => grant.role_code === "OWNER" && grant.scope === "all");
      setOwner(isOwner);
      if (!isOwner) return;
      const [shopRows, accountRows] = await Promise.all([
        organizationApi.listActiveShops(), organizationApi.listAllAccounts(),
      ]);
      const currentShopId = shopRows.some((shop) => shop.id === selectedShopId) ? selectedShopId : shopRows[0]?.id || "";
      setShops(shopRows); setAccounts(accountRows); setShopId(currentShopId);
      setBranches(currentShopId ? await organizationApi.listActiveBranches(currentShopId) : []);
    } catch (cause) { setError(messageFor(cause)); } finally { setReady(true); }
  }, []);
  useEffect(() => { void Promise.resolve().then(() => reload()); }, [reload]);
  useEffect(() => {
    if (!owner || !shopId) return;
    let current = true;
    void organizationApi.listActiveBranches(shopId).then((rows) => {
      if (current) setBranches(rows);
    }).catch((cause) => {
      if (current) { setBranches([]); setError(messageFor(cause)); }
    });
    return () => { current = false; };
  }, [owner, shopId]);

  const submit = <T,>(work: (form: FormData) => Promise<T>, success: string, onSuccess?: (result: T) => void) => async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setNotice("");
    try { const result = await work(new FormData(event.currentTarget)); onSuccess?.(result); setNotice(success); await reload(shopId); } catch (cause) { setError(messageFor(cause)); }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("current_password"));
    const newPassword = String(data.get("new_password"));
    const confirmation = String(data.get("confirm_password"));
    setError(""); setNotice("");
    if (newPassword !== confirmation) {
      setError("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    setChangingPassword(true);
    try {
      await authApi.changePassword({ current_password: currentPassword, new_password: newPassword });
      form.reset();
      setNotice("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว ใช้รหัสผ่านใหม่ในการเข้าสู่ระบบครั้งถัดไป");
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setChangingPassword(false);
    }
  };

  if (!ready) return null;

  return <div className="space-y-7">
    <PageHeader title="การตั้งค่า" description={owner ? "จัดการรหัสผ่าน ร้าน สาขา บัญชี และขอบเขตบทบาทของระบบ" : "จัดการข้อมูลความปลอดภัยของบัญชีที่กำลังใช้งาน"} />
    {notice ? <Feedback kind="success" detail={notice} /> : null}
    {error ? <Feedback kind="error" title="ทำรายการไม่สำเร็จ" detail={error} /> : null}
    <form className="workspace-section max-w-2xl" onSubmit={changePassword}>
      <h2 className="text-xl font-semibold">รหัสผ่านของฉัน</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">บัญชีที่ได้รับรหัสชั่วคราวควรเปลี่ยนรหัสผ่านหลังเข้าสู่ระบบครั้งแรก</p>
      <label className="mt-5 block text-sm">รหัสผ่านปัจจุบัน<input className={field} type="password" name="current_password" autoComplete="current-password" required /></label>
      <label className="mt-4 block text-sm">รหัสผ่านใหม่<input className={field} type="password" name="new_password" autoComplete="new-password" required minLength={8} maxLength={1024} aria-describedby="password-help" /></label>
      <p id="password-help" className="mt-2 text-xs leading-5 text-[var(--muted)]">อย่างน้อย 8 ตัวอักษร และต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน</p>
      <label className="mt-4 block text-sm">ยืนยันรหัสผ่านใหม่<input className={field} type="password" name="confirm_password" autoComplete="new-password" required minLength={8} maxLength={1024} /></label>
      <button className={`${button} mt-5`} disabled={changingPassword}>{changingPassword ? "กำลังเปลี่ยนรหัสผ่าน…" : "เปลี่ยนรหัสผ่าน"}</button>
    </form>
    {owner ? <>
    <div className="border-t border-[var(--line)] pt-7"><h2 className="text-xl font-semibold">ตั้งค่าองค์กร</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">เตรียมร้าน สาขา บัญชี และขอบเขตบทบาทก่อนเริ่มรอบเงินเดือน</p></div>
    <section className="grid gap-6 xl:grid-cols-2"><form className="workspace-section min-w-0" onSubmit={submit((form) => organizationApi.createShop({ code: String(form.get("code")), name: String(form.get("name")) }), "เพิ่มร้านแล้ว")}><h2 className="text-xl font-semibold">1. ร้าน</h2><label className="mt-5 block text-sm">รหัสร้าน<input className={field} name="code" required maxLength={30} /></label><label className="mt-4 block text-sm">ชื่อร้าน<input className={field} name="name" required maxLength={150} /></label><button className={`${button} mt-5`}>เพิ่มร้าน</button></form>
      <form className="workspace-section" onSubmit={submit((form) => organizationApi.createBranch({ shop_id: String(form.get("shop_id")), code: String(form.get("code")), name: String(form.get("name")) }), "เพิ่มสาขาแล้ว")}><h2 className="text-xl font-semibold">2. สาขา</h2><label className="mt-5 block text-sm">ร้าน<select className={field} name="shop_id" value={shopId} onChange={(event) => setShopId(event.target.value)} required><option value="">เลือกร้าน</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.code} · {shop.name}</option>)}</select></label><label className="mt-4 block text-sm">รหัสสาขา<input className={field} name="code" required maxLength={30} /></label><label className="mt-4 block text-sm">ชื่อสาขา<input className={field} name="name" required maxLength={150} /></label><button className={`${button} mt-5`} disabled={!shopId}>เพิ่มสาขา</button></form></section>
    <section className="grid gap-6 border-t border-[var(--line)] pt-7 xl:grid-cols-2">
      <AccountCreateLive onCreated={() => { void reload(shopId); }} />
      <section className="workspace-section"><h2 className="text-xl font-semibold">บทบาทและขอบเขต</h2>
        <label className="mt-5 block text-sm">บัญชี<select className={field} required value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}><option value="">เลือกบัญชี</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.username} · {account.employee?.display_name ?? "บัญชีส่วนกลาง"}</option>)}</select></label>
        {selectedAccountId ? <RoleScopeForm key={selectedAccountId} busy={grantBusy} hasEmployee={Boolean(accounts.find((row) => row.id === selectedAccountId)?.employee)} onSubmit={async (input) => {
          setGrantBusy(true); setError(""); setNotice("");
          try { await organizationApi.grantRole(selectedAccountId, input); setNotice("กำหนดบทบาทแล้ว"); await reload(shopId); }
          catch (cause) { setError(messageFor(cause)); }
          finally { setGrantBusy(false); }
        }} /> : <p className="mt-4 text-sm text-[var(--muted)]">เลือกบัญชีเพื่อกำหนดบทบาทและขอบเขต</p>}
      </section>
    </section>
    <section className="border-t border-[var(--line)] pt-6"><h2 className="font-semibold">สถานะการเตรียมข้อมูล</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">ร้าน {shops.length} รายการ · สาขาในร้านที่เลือก {branches.length} รายการ · บัญชี {accounts.length} รายการ จากนั้นไปที่ Payroll เพื่อกำหนดค่าคำนวณและเปิดรอบ</p></section>
    </> : null}
  </div>;
}
