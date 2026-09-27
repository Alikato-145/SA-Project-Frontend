"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type {
  AccountStatus,
  AccountSummary,
  RoleGrant,
} from "../contracts/types";
import { Field, StatusBadge, styles } from "../ui/primitives";
import { RequestState } from "../ui/request-states";

const accountStatusLabel: Record<AccountStatus, string> = {
  active: "ใช้งาน",
  disabled: "ปิดใช้งาน",
  locked: "ล็อกชั่วคราว",
};

const roleLabel: Record<RoleGrant["role_code"], string> = {
  EMPLOYEE: "พนักงาน",
  SUPERVISOR: "หัวหน้าแผนก",
  BRANCH_MANAGER: "ผู้จัดการสาขา",
  HR: "ฝ่ายบุคคล",
  OWNER: "เจ้าของ",
};

const scopeLabel: Record<RoleGrant["scope"], string> = {
  self: "เฉพาะตนเอง",
  department: "เฉพาะแผนก",
  branch: "เฉพาะสาขา",
  all: "ทุกสาขา",
};

function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return (
    <StatusBadge
      tone={
        status === "active" ? "ok" : status === "locked" ? "warn" : "danger"
      }
    >
      {accountStatusLabel[status]}
    </StatusBadge>
  );
}

export function AccountListView({
  accounts,
}: {
  accounts: readonly AccountSummary[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | AccountStatus>("all");
  const visibleAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("th");
    return accounts.filter((account) => {
      const matchesQuery =
        !normalizedQuery ||
        account.username.toLocaleLowerCase("th").includes(normalizedQuery) ||
        account.employee_id?.includes(normalizedQuery);
      return matchesQuery && (status === "all" || account.status === status);
    });
  }, [accounts, query, status]);

  return (
    <section className={styles.panel} aria-labelledby="account-list-title">
      <div className={styles.sectionHead}>
        <div>
          <h2 id="account-list-title">ทะเบียนบัญชีผู้ใช้</h2>
          <p className={styles.muted}>
            ตรวจสอบสถานะและสิทธิ์ปัจจุบันก่อนเปิดรายละเอียด
          </p>
        </div>
        <Link className={styles.button} href="/accounts/new">
          สร้างบัญชี
        </Link>
      </div>

      <div
        className={styles.toolbar}
        role="search"
        aria-label="ค้นหาบัญชีผู้ใช้"
      >
        <Field label="ชื่อผู้ใช้หรือรหัสพนักงาน">
          <input
            className={styles.input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="เช่น hr.central หรือ 101"
          />
        </Field>
        <Field label="สถานะบัญชี">
          <select
            className={styles.select}
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "all" | AccountStatus)
            }
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">ใช้งาน</option>
            <option value="locked">ล็อกชั่วคราว</option>
            <option value="disabled">ปิดใช้งาน</option>
          </select>
        </Field>
      </div>

      {visibleAccounts.length === 0 ? (
        <RequestState
          kind="empty"
          title="ไม่พบบัญชีที่ตรงกับตัวกรอง"
          detail="ลองเปลี่ยนคำค้นหาหรือเลือกดูทุกสถานะ"
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ชื่อผู้ใช้</th>
                <th>พนักงานที่เชื่อม</th>
                <th>บทบาท</th>
                <th>สถานะ</th>
                <th>
                  <span className={styles.srOnly}>การทำงาน</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleAccounts.map((account) => (
                <tr key={account.id}>
                  <td>
                    <strong>{account.username}</strong>
                  </td>
                  <td>
                    {account.employee_id
                      ? `รหัส ${account.employee_id}`
                      : "ไม่เชื่อมพนักงาน"}
                  </td>
                  <td>
                    {account.grants
                      .map((grant) => roleLabel[grant.role_code])
                      .join(", ") || "ยังไม่มีสิทธิ์"}
                  </td>
                  <td>
                    <AccountStatusBadge status={account.status} />
                  </td>
                  <td>
                    <Link href={`/accounts/${account.id}`}>ดูรายละเอียด</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.muted} aria-live="polite">
        แสดง {visibleAccounts.length} จาก {accounts.length} บัญชี
      </p>
    </section>
  );
}

export function AccountDetailView({ account }: { account?: AccountSummary }) {
  const [status, setStatus] = useState<AccountStatus>(
    account?.status ?? "disabled",
  );
  const [notice, setNotice] = useState<string | null>(null);

  if (!account) {
    return (
      <RequestState
        kind="empty"
        title="ไม่พบบัญชีผู้ใช้"
        detail="รายการนี้อาจอยู่นอกขอบเขตสิทธิ์หรือไม่มีอยู่ ระบบจะไม่เปิดเผยรายละเอียดเพิ่มเติม"
      />
    );
  }

  const previewAction = (message: string) => {
    setNotice(message);
  };

  return (
    <div className={styles.grid}>
      <section
        className={`${styles.panel} ${styles.span4}`}
        aria-labelledby="account-summary-title"
      >
        <div className={styles.sectionHead}>
          <div>
            <h2 id="account-summary-title">{account.username}</h2>
            <p className={styles.muted}>บัญชี #{account.id}</p>
          </div>
          <AccountStatusBadge status={status} />
        </div>
        <dl className={styles.kv}>
          <div>
            <dt>พนักงานที่เชื่อม</dt>
            <dd>{account.employee_id ?? "ไม่ได้เชื่อม"}</dd>
          </div>
          <div>
            <dt>สิทธิ์ที่ใช้งาน</dt>
            <dd>{account.grants.length} รายการ</dd>
          </div>
        </dl>
        <p className={styles.muted}>
          การซ่อนปุ่มเป็นเพียงคำใบ้ในหน้าจอ เซิร์ฟเวอร์ยังตรวจสิทธิ์ทุกคำขอ
        </p>
      </section>

      <section
        className={`${styles.panel} ${styles.span8}`}
        aria-labelledby="grant-list-title"
      >
        <div className={styles.sectionHead}>
          <div>
            <h2 id="grant-list-title">บทบาทและขอบเขต</h2>
            <p className={styles.muted}>
              แต่ละสิทธิ์ระบุขอบเขตที่ใช้งานจริงอย่างชัดเจน
            </p>
          </div>
        </div>
        {account.grants.length === 0 ? (
          <RequestState
            kind="empty"
            title="บัญชียังไม่มีสิทธิ์"
            detail="เพิ่มบทบาทที่เหมาะสมก่อนให้ผู้ใช้นี้เริ่มงาน"
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>บทบาท</th>
                  <th>ขอบเขต</th>
                  <th>สาขา</th>
                  <th>แผนก</th>
                </tr>
              </thead>
              <tbody>
                {account.grants.map((grant) => (
                  <tr key={grant.id}>
                    <td>
                      <strong>{roleLabel[grant.role_code]}</strong>
                    </td>
                    <td>{scopeLabel[grant.scope]}</td>
                    <td>{grant.branch_id ?? "—"}</td>
                    <td>{grant.department_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className={`${styles.panel} ${styles.span6}`}
        aria-labelledby="security-actions-title"
      >
        <h2 id="security-actions-title">ความปลอดภัยบัญชี</h2>
        <p className={styles.muted}>
          รหัสผ่านชั่วคราวจะแสดงเพียงครั้งเดียวเมื่อ API จริงตอบกลับ
          และจะไม่เก็บในหน้าพรีวิว
        </p>
        <div className={styles.actions}>
          {status === "locked" ? (
            <button
              className={styles.button}
              type="button"
              onClick={() => {
                setStatus("active");
                previewAction("เตรียมคำขอปลดล็อกบัญชีแล้ว");
              }}
            >
              ปลดล็อกบัญชี
            </button>
          ) : null}
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            type="button"
            onClick={() => previewAction("เตรียมคำขอรีเซ็ตรหัสผ่านแล้ว")}
          >
            รีเซ็ตรหัสผ่าน
          </button>
          <button
            className={`${styles.button} ${status === "active" ? styles.buttonDanger : styles.buttonSecondary}`}
            type="button"
            onClick={() => {
              const nextStatus = status === "active" ? "disabled" : "active";
              setStatus(nextStatus);
              previewAction(
                nextStatus === "active"
                  ? "เตรียมคำขอเปิดใช้งานบัญชีแล้ว"
                  : "เตรียมคำขอปิดใช้งานบัญชีแล้ว",
              );
            }}
          >
            {status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </button>
        </div>
        {notice ? (
          <RequestState
            kind="success"
            title="อัปเดตเฉพาะหน้าพรีวิว"
            detail={`${notice} การเปลี่ยนแปลงจริงจะเกิดเมื่อเชื่อม shared API client`}
          />
        ) : null}
      </section>

      <section
        className={`${styles.panel} ${styles.span6}`}
        aria-labelledby="add-grant-title"
      >
        <h2 id="add-grant-title">เพิ่มบทบาท</h2>
        <RoleScopeForm onPrepared={(message) => setNotice(message)} />
      </section>
    </div>
  );
}

type RoleCode = RoleGrant["role_code"];
type Scope = RoleGrant["scope"];

const roleScope: Record<RoleCode, Scope> = {
  EMPLOYEE: "self",
  SUPERVISOR: "department",
  BRANCH_MANAGER: "branch",
  HR: "all",
  OWNER: "all",
};

export function RoleScopeForm({
  onPrepared,
}: {
  onPrepared?: (message: string) => void;
}) {
  const [role, setRole] = useState<RoleCode>("EMPLOYEE");
  const [scope, setScope] = useState<Scope>("self");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectRole = (nextRole: RoleCode) => {
    const nextScope = roleScope[nextRole];
    setRole(nextRole);
    setScope(nextScope);
    if (nextScope === "self" || nextScope === "all") {
      setBranchId("");
      setDepartmentId("");
    } else if (nextScope === "branch") {
      setDepartmentId("");
    }
    setError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((scope === "branch" || scope === "department") && !branchId) {
      setError("เลือกสาขาสำหรับขอบเขตสิทธิ์นี้");
      return;
    }
    if (scope === "department" && !departmentId) {
      setError("เลือกแผนกสำหรับสิทธิ์หัวหน้าแผนก");
      return;
    }
    if (!reason.trim()) {
      setError("ระบุเหตุผลเพื่อให้ตรวจสอบย้อนหลังได้");
      return;
    }
    setError(null);
    onPrepared?.(
      `เตรียมบทบาท ${roleLabel[role]} ขอบเขต${scopeLabel[scope]}แล้ว`,
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className={styles.formGrid}>
        <Field label="บทบาท">
          <select
            className={styles.select}
            value={role}
            onChange={(event) => selectRole(event.target.value as RoleCode)}
          >
            <option value="EMPLOYEE">พนักงาน</option>
            <option value="SUPERVISOR">หัวหน้าแผนก</option>
            <option value="BRANCH_MANAGER">ผู้จัดการสาขา</option>
            <option value="HR">ฝ่ายบุคคล</option>
            <option value="OWNER">เจ้าของ</option>
          </select>
        </Field>
        <Field label="ขอบเขต" hint="กำหนดจากบทบาทตามกฎระบบ">
          <input className={styles.input} value={scopeLabel[scope]} readOnly />
        </Field>
        {scope === "branch" || scope === "department" ? (
          <Field label="สาขา">
            <select
              className={styles.select}
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setDepartmentId("");
              }}
            >
              <option value="">เลือกสาขา</option>
              <option value="11">สาขาสุขุมวิท</option>
              <option value="12">สาขารามอินทรา</option>
            </select>
          </Field>
        ) : null}
        {scope === "department" ? (
          <Field label="แผนก">
            <select
              className={styles.select}
              value={departmentId}
              disabled={!branchId}
              onChange={(event) => setDepartmentId(event.target.value)}
            >
              <option value="">เลือกแผนก</option>
              <option value="21">ครัว</option>
              <option value="22">บริการ</option>
            </select>
          </Field>
        ) : null}
        <Field label="เหตุผล" hint="เหตุผลจะถูกส่งไปบันทึก audit log">
          <textarea
            className={styles.textarea}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="เช่น รับผิดชอบดูแลแผนกครัว"
          />
        </Field>
      </div>
      {error ? (
        <RequestState kind="error" title="ยังเพิ่มบทบาทไม่ได้" detail={error} />
      ) : null}
      <div className={styles.actions}>
        <button className={styles.button} type="submit">
          เตรียมเพิ่มบทบาท
        </button>
      </div>
    </form>
  );
}

export function AccountCreateView() {
  const [username, setUsername] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [prepared, setPrepared] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPrepared(Boolean(username.trim()));
  };

  return (
    <div className={styles.grid}>
      <section
        className={`${styles.panel} ${styles.span6}`}
        aria-labelledby="new-account-title"
      >
        <h2 id="new-account-title">ข้อมูลบัญชี</h2>
        <p className={styles.muted}>
          ชื่อผู้ใช้ใช้สำหรับเข้าสู่ระบบ
          ส่วนพนักงานที่เชื่อมเป็นข้อมูลบุคคลคนละรายการกับบัญชี
        </p>
        <form onSubmit={submit} noValidate>
          <div className={styles.formGrid}>
            <Field label="ชื่อผู้ใช้">
              <input
                className={styles.input}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoComplete="off"
              />
            </Field>
            <Field label="รหัสพนักงาน" hint="เว้นว่างได้สำหรับบัญชีเจ้าของ">
              <input
                className={styles.input}
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                inputMode="numeric"
              />
            </Field>
          </div>
          <div className={styles.actions}>
            <Link
              className={`${styles.button} ${styles.buttonSecondary}`}
              href="/accounts"
            >
              ยกเลิก
            </Link>
            <button
              className={styles.button}
              type="submit"
              disabled={!username.trim()}
            >
              ตรวจข้อมูลบัญชี
            </button>
          </div>
        </form>
        {prepared ? (
          <RequestState
            kind="success"
            title="ข้อมูลบัญชีพร้อม"
            detail="เลือกบทบาทและเหตุผลให้ครบก่อนส่งผ่าน API จริง รหัสผ่านชั่วคราวจะไม่ถูกเก็บในหน้านี้"
          />
        ) : null}
      </section>
      <section
        className={`${styles.panel} ${styles.span6}`}
        aria-labelledby="initial-grant-title"
      >
        <h2 id="initial-grant-title">บทบาทเริ่มต้น</h2>
        <RoleScopeForm
          onPrepared={() => setPrepared(Boolean(username.trim()))}
        />
      </section>
    </div>
  );
}
