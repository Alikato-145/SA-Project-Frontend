"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Field, styles } from "../ui/primitives";
import { employeeReadApi, type PaymentDestination } from "./employee-read-api";

export function EmployeePaymentDestinationControls({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const [destination, setDestination] = useState<PaymentDestination | null>(null);
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<PaymentDestination["payment_method"]>("cash");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    employeeReadApi.paymentDestination(employeeId, controller.signal).then(value => { setDestination(value); setPhone(value.promptpay_phone ?? ""); setMethod(value.payment_method); }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "โหลดช่องทางรับเงินไม่สำเร็จ");
    });
    return () => controller.abort();
  }, [employeeId]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await employeeReadApi.savePaymentDestination(employeeId, { payment_method: data.get("payment_method") as PaymentDestination["payment_method"], promptpay_phone: String(data.get("promptpay_phone") ?? "").trim() || null });
      setDestination(saved); setPhone(saved.promptpay_phone ?? ""); setMethod(saved.payment_method); setNotice("บันทึกช่องทางรับเงินแล้ว");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setBusy(false); }
  };
  return <section className={`${styles.panel} mt-6`} aria-labelledby="payment-destination-heading">
    <h3 id="payment-destination-heading">ช่องทางรับเงินเดือน</h3>
    <p className={styles.muted}>หมายเลขรับเงินพร้อมเพย์แยกจากโทรศัพท์ติดต่อ การบันทึกช่องทางยังไม่ใช่การชำระเงิน</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!destination ? <p>กำลังโหลดช่องทางรับเงิน</p> : canEdit ? <form className="mt-4 space-y-3" onSubmit={save}>
      <Field label="วิธีรับเงินเดือน"><select name="payment_method" className={styles.select} value={method} onChange={event => setMethod(event.target.value as PaymentDestination["payment_method"])}><option value="cash">เงินสด</option><option value="transfer">โอนเงิน</option></select></Field>
      <Field label="หมายเลขรับเงินพร้อมเพย์"><input name="promptpay_phone" type="tel" className={styles.input} value={phone} onChange={event => setPhone(event.target.value)} maxLength={40} /></Field>
      <p className={styles.muted}>เงินสดไม่ต้องระบุหมายเลข หากเลือกโอนเงิน สามารถลงทะเบียนหมายเลขก่อนเตรียมจ่ายได้</p>
      <button className={styles.button} disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกช่องทางรับเงิน"}</button>
    </form> : <dl className={styles.kv}><div><dt>วิธีรับเงินเดือน</dt><dd>{destination.payment_method === "cash" ? "เงินสด" : "โอนเงิน"}</dd></div><div><dt>หมายเลขรับเงินพร้อมเพย์</dt><dd>{destination.promptpay_phone ?? "ยังไม่ได้ลงทะเบียน"}</dd></div></dl>}
  </section>;
}
