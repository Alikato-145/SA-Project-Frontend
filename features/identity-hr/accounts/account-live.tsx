"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest, ApiClientError } from "@/lib/api/client";
import type { AccountStatus, RoleGrant } from "../contracts/types";
import { Field, StatusBadge, styles } from "../ui/primitives";
import { RequestState } from "../ui/request-states";

type Account = {
  id: string;
  username: string;
  status: AccountStatus;
  employee: { id: string; employee_code: string; display_name: string } | null;
};
type Detail = { account: Account; grants: RoleGrant[] };
type Page = {
  items: Account[];
  page: number;
  page_size: number;
  total: number;
};
type RoleCode = RoleGrant["role_code"];
type Notice = {
  kind: "success" | "error" | "forbidden" | "conflict";
  message: string;
};

const roles: Record<RoleCode, string> = {
  EMPLOYEE: "พนักงาน",
  SUPERVISOR: "หัวหน้าแผนก",
  BRANCH_MANAGER: "ผู้จัดการสาขา",
  HR: "ฝ่ายบุคคล",
  OWNER: "เจ้าของ",
};
const scopes: Record<RoleGrant["scope"], string> = {
  self: "เฉพาะตนเอง",
  department: "เฉพาะแผนก",
  branch: "เฉพาะสาขา",
  all: "ทุกสาขา",
};
const roleScopes: Record<RoleCode, RoleGrant["scope"]> = {
  EMPLOYEE: "self",
  SUPERVISOR: "department",
  BRANCH_MANAGER: "branch",
  HR: "all",
  OWNER: "all",
};
const statuses: Record<AccountStatus, string> = {
  active: "ใช้งาน",
  disabled: "ปิดใช้งาน",
  locked: "ล็อกชั่วคราว",
};
const id = (value: string) => /^[1-9][0-9]*$/.test(value);
const body = (value: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});
const failure = (error: unknown): Notice =>
  error instanceof ApiClientError
    ? {
        kind:
          error.status === 403
            ? "forbidden"
            : error.status === 409
              ? "conflict"
              : "error",
        message: error.message,
      }
    : { kind: "error", message: "ไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง" };

function Feedback({ notice }: { notice: Notice | null }) {
  return notice ? (
    <RequestState
      kind={notice.kind}
      title={notice.kind === "success" ? "บันทึกสำเร็จ" : "ดำเนินการไม่สำเร็จ"}
      detail={notice.message}
    />
  ) : null;
}

export function AccountListLive() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    apiRequest<Page>(`/v1/accounts/?${params}`)
      .then((data) => {
        if (active) {
          setResult(data);
          setNotice(null);
        }
      })
      .catch((error) => {
        if (active) {
          setResult(null);
          setNotice(failure(error));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, status, search, refresh]);
  return (
    <section className={styles.panel} aria-labelledby="account-list-title">
      <div className={styles.sectionHead}>
        <div>
          <h2 id="account-list-title">ทะเบียนบัญชีผู้ใช้</h2>
          <p className={styles.muted}>ข้อมูลบัญชีตามสิทธิ์ของคุณ</p>
        </div>
        <Link className={styles.button} href="/accounts/new">
          สร้างบัญชี
        </Link>
      </div>
      <form
        className={styles.toolbar}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setLoading(true);
          setPage(1);
          setSearch(query.trim());
          setRefresh((value) => value + 1);
        }}
      >
        <Field label="ชื่อผู้ใช้">
          <input
            className={styles.input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <Field label="สถานะ">
          <select
            className={styles.select}
            value={status}
            onChange={(event) => {
              setLoading(true);
              setPage(1);
              setStatus(event.target.value);
            }}
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">ใช้งาน</option>
            <option value="locked">ล็อกชั่วคราว</option>
            <option value="disabled">ปิดใช้งาน</option>
          </select>
        </Field>
        <button className={styles.button} type="submit">
          ค้นหา
        </button>
      </form>
      {loading ? (
        <RequestState
          kind="loading"
          title="กำลังโหลดบัญชี"
          detail="กำลังตรวจข้อมูลล่าสุด"
        />
      ) : notice ? (
        <Feedback notice={notice} />
      ) : result?.items.length ? (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ชื่อผู้ใช้</th>
                  <th>พนักงานที่เชื่อม</th>
                  <th>สถานะ</th>
                  <th>
                    <span className={styles.srOnly}>การทำงาน</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <strong>{account.username}</strong>
                    </td>
                    <td>
                      {account.employee
                        ? `${account.employee.display_name} (${account.employee.employee_code})`
                        : "ไม่เชื่อมพนักงาน"}
                    </td>
                    <td>
                      <StatusBadge
                        tone={
                          account.status === "active"
                            ? "ok"
                            : account.status === "locked"
                              ? "warn"
                              : "danger"
                        }
                      >
                        {statuses[account.status]}
                      </StatusBadge>
                    </td>
                    <td>
                      <Link href={`/accounts/${account.id}`}>ดูรายละเอียด</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.muted}>
            หน้า {result.page} · ทั้งหมด {result.total} บัญชี
          </p>
          <div className={styles.actions}>
            <button
              className={styles.button}
              type="button"
              disabled={page <= 1}
              onClick={() => {
                setLoading(true);
                setPage(page - 1);
              }}
            >
              ก่อนหน้า
            </button>
            <button
              className={styles.button}
              type="button"
              disabled={page * result.page_size >= result.total}
              onClick={() => {
                setLoading(true);
                setPage(page + 1);
              }}
            >
              ถัดไป
            </button>
          </div>
        </>
      ) : (
        <RequestState
          kind="empty"
          title="ไม่พบบัญชี"
          detail="ลองเปลี่ยนตัวกรองหรือคำค้นหา"
        />
      )}
    </section>
  );
}

export function AccountDetailLive({ accountId }: { accountId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );
  const load = useCallback(
    async () =>
      setDetail(await apiRequest<Detail>(`/v1/accounts/${accountId}`)),
    [accountId],
  );
  useEffect(() => {
    let active = true;
    if (!id(accountId)) return;
    apiRequest<Detail>(`/v1/accounts/${accountId}`)
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((error) => {
        if (active) setNotice(failure(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountId]);
  const act = async (
    path: string,
    method: "POST" | "PATCH",
    payload: unknown,
    success: string,
    password = false,
  ) => {
    if (!reason.trim()) {
      setNotice({ kind: "error", message: "ระบุเหตุผลก่อนดำเนินการ" });
      return;
    }
    setBusy(true);
    setNotice(null);
    setTemporaryPassword(null);
    try {
      const response = await apiRequest<
        Detail & { temporary_password?: string }
      >(path, { ...body(payload), method });
      await load();
      if (password) setTemporaryPassword(response.temporary_password ?? null);
      setReason("");
      setNotice({ kind: "success", message: success });
    } catch (error) {
      setNotice(failure(error));
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (grantId: string) => {
    if (!reason.trim()) {
      setNotice({ kind: "error", message: "ระบุเหตุผลก่อนถอนบทบาท" });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await apiRequest(`/v1/accounts/${accountId}/roles/${grantId}`, {
        ...body({ reason: reason.trim() }),
        method: "DELETE",
      });
      await load();
      setReason("");
      setNotice({ kind: "success", message: "ถอนบทบาทแล้ว" });
    } catch (error) {
      setNotice(failure(error));
    } finally {
      setBusy(false);
    }
  };
  if (!id(accountId))
    return (
      <RequestState
        kind="error"
        title="รหัสบัญชีไม่ถูกต้อง"
        detail="ไม่สามารถเปิดรายละเอียดบัญชีนี้"
      />
    );
  if (loading)
    return (
      <RequestState
        kind="loading"
        title="กำลังโหลดบัญชี"
        detail="กำลังตรวจสิทธิ์และสถานะล่าสุด"
      />
    );
  if (!detail) return <Feedback notice={notice} />;
  const account = detail.account;
  return (
    <div className={styles.grid}>
      <section className={`${styles.panel} ${styles.span4}`}>
        <h2>{account.username}</h2>
        <p className={styles.muted}>บัญชี #{account.id}</p>
        <p>{account.employee?.display_name ?? "ไม่เชื่อมพนักงาน"}</p>
        <StatusBadge
          tone={
            account.status === "active"
              ? "ok"
              : account.status === "locked"
                ? "warn"
                : "danger"
          }
        >
          {statuses[account.status]}
        </StatusBadge>
      </section>
      <section className={`${styles.panel} ${styles.span8}`}>
        <h2>บทบาทและขอบเขต</h2>
        {detail.grants.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>บทบาท</th>
                  <th>ขอบเขต</th>
                  <th>สาขา</th>
                  <th>แผนก</th>
                  <th>
                    <span className={styles.srOnly}>การทำงาน</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {detail.grants.map((grant) => (
                  <tr key={grant.id}>
                    <td>{roles[grant.role_code]}</td>
                    <td>{scopes[grant.scope]}</td>
                    <td>{grant.branch_id ?? "—"}</td>
                    <td>{grant.department_id ?? "—"}</td>
                    <td>
                      <button
                        className={styles.buttonSecondary}
                        type="button"
                        disabled={busy}
                        onClick={() => void revoke(grant.id)}
                      >
                        ถอนบทบาท
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <RequestState
            kind="empty"
            title="ยังไม่มีบทบาท"
            detail="เพิ่มบทบาทตามหน้าที่ของบัญชีนี้"
          />
        )}
      </section>
      <section className={`${styles.panel} ${styles.span6}`}>
        <h2>ความปลอดภัยบัญชี</h2>
        <Field label="เหตุผล" hint="ระบบจะบันทึกการดำเนินการเพื่อ audit">
          <textarea
            className={styles.textarea}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
          />
        </Field>
        <div className={styles.actions}>
          {account.status === "locked" ? (
            <button
              className={styles.button}
              type="button"
              disabled={busy}
              onClick={() =>
                void act(
                  `/v1/accounts/${accountId}/unlock`,
                  "POST",
                  { reason: reason.trim() },
                  "ปลดล็อกบัญชีแล้ว",
                )
              }
            >
              ปลดล็อก
            </button>
          ) : null}
          <button
            className={styles.button}
            type="button"
            disabled={busy}
            onClick={() =>
              void act(
                `/v1/accounts/${accountId}/reset-password`,
                "POST",
                { reason: reason.trim() },
                "รีเซ็ตรหัสผ่านแล้ว",
                true,
              )
            }
          >
            รีเซ็ตรหัสผ่าน
          </button>
          {account.status !== "locked" ? (
            <button
              className={styles.button}
              type="button"
              disabled={busy}
              onClick={() =>
                void act(
                  `/v1/accounts/${accountId}/status`,
                  "PATCH",
                  {
                    status: account.status === "active" ? "disabled" : "active",
                    reason: reason.trim(),
                  },
                  "เปลี่ยนสถานะบัญชีแล้ว",
                )
              }
            >
              {account.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </button>
          ) : null}
        </div>
        {temporaryPassword ? (
          <div role="status">
            <strong>รหัสผ่านชั่วคราว (แสดงครั้งเดียว)</strong>
            <code>{temporaryPassword}</code>
            <button type="button" onClick={() => setTemporaryPassword(null)}>
              ปิด
            </button>
          </div>
        ) : null}
        <Feedback notice={notice} />
      </section>
      <section className={`${styles.panel} ${styles.span6}`}>
        <h2>เพิ่มบทบาท</h2>
        <RoleScopeForm
          onSubmit={async (input) => {
            setBusy(true);
            setNotice(null);
            try {
              await apiRequest(`/v1/accounts/${accountId}/roles`, body(input));
              await load();
              setNotice({ kind: "success", message: "เพิ่มบทบาทแล้ว" });
            } catch (error) {
              setNotice(failure(error));
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      </section>
    </div>
  );
}

function RoleScopeForm({
  onSubmit,
  busy,
}: {
  onSubmit: (value: {
    role_code: RoleCode;
    branch_id: string | null;
    department_id: string | null;
    reason: string;
  }) => Promise<void>;
  busy: boolean;
}) {
  const [role, setRole] = useState<RoleCode>("EMPLOYEE");
  const [branch, setBranch] = useState("");
  const [department, setDepartment] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<
    { id: string; name: string }[]
  >([]);
  useEffect(() => {
    apiRequest<{ id: string; name: string }[]>("/v1/branches?page_size=100")
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);
  useEffect(() => {
    if (!branch) return;
    let current = true;
    apiRequest<{ id: string; name: string }[]>(
      `/v1/departments?page_size=100&branch_id=${branch}`,
    )
      .then((items) => {
        if (current) setDepartments(items);
      })
      .catch(() => {
        if (current) setDepartments([]);
      });
    return () => {
      current = false;
    };
  }, [branch]);
  const scope = roleScopes[role];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (
      ((scope === "branch" || scope === "department") && !id(branch)) ||
      (scope === "department" && !id(department)) ||
      !reason.trim()
    ) {
      setError("เลือกขอบเขตและกรอกเหตุผลให้ครบ");
      return;
    }
    setError("");
    void onSubmit({
      role_code: role,
      branch_id: scope === "branch" || scope === "department" ? branch : null,
      department_id: scope === "department" ? department : null,
      reason: reason.trim(),
    }).then(() => setReason(""));
  };
  return (
    <form onSubmit={submit}>
      <div className={styles.formGrid}>
        <Field label="บทบาท">
          <select
            className={styles.select}
            value={role}
            onChange={(event) => {
              setRole(event.target.value as RoleCode);
              setBranch("");
              setDepartment("");
              setDepartments([]);
            }}
          >
            {Object.entries(roles).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ขอบเขต">
          <input className={styles.input} value={scopes[scope]} readOnly />
        </Field>
        {scope === "branch" || scope === "department" ? (
          <Field label="สาขา">
            <select
              className={styles.select}
              value={branch}
              onChange={(event) => {
                setBranch(event.target.value);
                setDepartment("");
                setDepartments([]);
              }}
            >
              <option value="">เลือกสาขา</option>
              {branches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {scope === "department" ? (
          <Field label="แผนก">
            <select
              className={styles.select}
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              disabled={!branch}
            >
              <option value="">เลือกแผนก</option>
              {departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="เหตุผล">
          <textarea
            className={styles.textarea}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
          />
        </Field>
      </div>
      {error ? (
        <RequestState kind="error" title="ยังเพิ่มบทบาทไม่ได้" detail={error} />
      ) : null}
      <button className={styles.button} type="submit" disabled={busy}>
        เพิ่มบทบาท
      </button>
    </form>
  );
}

export function AccountCreateLive() {
  const [username, setUsername] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [created, setCreated] = useState<
    (Detail & { temporary_password: string }) | null
  >(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (username.trim().length < 3 || (employeeId && !id(employeeId))) {
      setNotice({
        kind: "error",
        message: "กรอกชื่อผู้ใช้อย่างน้อย 3 ตัวอักษรและรหัสพนักงานที่ถูกต้อง",
      });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      setCreated(
        await apiRequest<Detail & { temporary_password: string }>(
          "/v1/accounts/",
          body({ username: username.trim(), employee_id: employeeId || null }),
        ),
      );
      setNotice({
        kind: "success",
        message:
          "สร้างบัญชีแล้ว โปรดกำหนดบทบาทและส่งรหัสผ่านชั่วคราวผ่านช่องทางที่ปลอดภัย",
      });
    } catch (error) {
      setNotice(failure(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={styles.panel}>
      <h2>ข้อมูลบัญชี</h2>
      <form onSubmit={(event) => void submit(event)}>
        <div className={styles.formGrid}>
          <Field label="ชื่อผู้ใช้">
            <input
              className={styles.input}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              maxLength={100}
              required
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
        <button
          className={styles.button}
          type="submit"
          disabled={busy || Boolean(created)}
        >
          สร้างบัญชี
        </button>
      </form>
      <Feedback notice={notice} />
      {created ? (
        <div role="status">
          <p>บัญชี {created.account.username} ถูกสร้างแล้ว</p>
          {created.temporary_password ? (
            <p>
              รหัสผ่านชั่วคราว (แสดงครั้งเดียว):{" "}
              <code>{created.temporary_password}</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setCreated({ ...created, temporary_password: "" })}
          >
            ปิดรหัสผ่าน
          </button>
          <p>
            <Link href={`/accounts/${created.account.id}`}>
              กำหนดบทบาทบัญชีนี้
            </Link>
          </p>
        </div>
      ) : null}
    </section>
  );
}
