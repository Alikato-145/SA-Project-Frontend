"use client";

import { type FormEvent, useState } from "react";

import type { BankAccountSummary, EmployeeSummary } from "../contracts/types";
import { previewBanks } from "../fixtures/preview-data";
import { EmployeeTabs, Field, StatusBadge, styles } from "../ui/primitives";
import { RequestState } from "../ui/request-states";

export function BankAccounts({
  employee,
  accounts = previewBanks,
}: {
  employee: EmployeeSummary;
  accounts?: BankAccountSummary[];
}) {
  const [accountNumber, setAccountNumber] = useState("");
  const [prepared, setPrepared] = useState(false);

  const prepareAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPrepared(true);
    setAccountNumber("");
    event.currentTarget.reset();
  };

  return (
    <section aria-labelledby="bank-heading">
      <div className={styles.sectionHead}>
        <div>
          <h2 id="bank-heading">บัญชีธนาคารของ {employee.first_name}</h2>
          <p className={styles.muted}>แสดงเฉพาะข้อมูลปกปิดจาก API</p>
        </div>
        <StatusBadge tone="warn">ไม่เก็บเลขเต็มใน cache</StatusBadge>
      </div>
      <EmployeeTabs id={employee.id} />

      <div className={styles.grid}>
        <section
          className={`${styles.panel} ${styles.span8}`}
          aria-labelledby="bank-list-heading"
        >
          <h3 id="bank-list-heading">บัญชีที่บันทึกไว้</h3>
          {accounts.length === 0 ? (
            <RequestState
              kind="empty"
              title="ยังไม่มีบัญชีธนาคาร"
              detail="เพิ่มบัญชีได้เมื่อมีสิทธิ์จัดการพนักงาน เลขบัญชีเต็มจะใช้เฉพาะขอบเขตคำขอเท่านั้น"
            />
          ) : (
            <ul className={styles.grid}>
              {accounts.map((account) => (
                <li className={styles.span6} key={account.id}>
                  <article className={styles.panel}>
                    <div className={styles.sectionHead}>
                      <div>
                        <h3>{account.bank_name}</h3>
                        <p className={styles.muted}>{account.bank_code}</p>
                      </div>
                      <div>
                        {account.is_primary ? (
                          <StatusBadge>บัญชีหลัก</StatusBadge>
                        ) : null}{" "}
                        {!account.is_active ? (
                          <StatusBadge tone="danger">ยุติการใช้</StatusBadge>
                        ) : null}
                      </div>
                    </div>
                    <dl className={styles.kv}>
                      <div>
                        <dt>ชื่อบัญชี</dt>
                        <dd>{account.account_holder_name}</dd>
                      </div>
                      <div>
                        <dt>เลขบัญชี</dt>
                        <dd
                          aria-label={`เลขบัญชีลงท้าย ${account.account_number_last4}`}
                        >
                          {account.account_number_masked}
                        </dd>
                      </div>
                    </dl>
                    <p className={styles.muted}>
                      {account.is_active
                        ? "การเปลี่ยนบัญชีหลักหรือยุติการใช้ต้องเป็นคำสั่งที่บันทึกประวัติ"
                        : "รายการเดิมยังคงแสดงเพื่อการตรวจสอบย้อนหลัง"}
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside
          className={`${styles.panel} ${styles.span4}`}
          aria-labelledby="bank-add-heading"
        >
          <h3 id="bank-add-heading">เตรียมเพิ่มบัญชี</h3>
          <p className={styles.muted}>
            เลขบัญชีเต็มอยู่ในฟอร์มชั่วคราวและจะถูกล้างทันทีเมื่อเตรียมคำขอสำเร็จหรือออกจากหน้านี้
          </p>
          <form onSubmit={prepareAccount} autoComplete="off">
            <div className={styles.formGrid}>
              <Field label="รหัสธนาคาร">
                <input className={styles.input} name="bank_code" required />
              </Field>
              <Field label="ชื่อธนาคาร">
                <input className={styles.input} name="bank_name" required />
              </Field>
              <Field label="ชื่อเจ้าของบัญชี">
                <input
                  className={styles.input}
                  name="account_holder_name"
                  required
                />
              </Field>
              <Field label="เลขบัญชี">
                <input
                  className={styles.input}
                  name="account_number"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(event) => {
                    setPrepared(false);
                    setAccountNumber(event.target.value);
                  }}
                  required
                />
              </Field>
              <label className={styles.check}>
                <input type="checkbox" name="is_primary" />
                ใช้เป็นบัญชีหลัก
              </label>
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="submit">
                เตรียมคำขอและล้างเลขบัญชี
              </button>
            </div>
          </form>
          {prepared ? (
            <RequestState
              kind="success"
              title="ล้างเลขบัญชีเต็มแล้ว"
              detail="preview ยังไม่ได้บันทึกข้อมูล การเชื่อมจริงจะส่งผ่าน shared API client และรับกลับเฉพาะเลขปกปิด"
            />
          ) : null}
        </aside>
      </div>
    </section>
  );
}
