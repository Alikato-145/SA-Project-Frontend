"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  apiRequest,
  apiRequestPage,
  ApiClientError,
  type ApiPage,
} from "@/lib/api/client";
import type { OrganizationItem } from "../contracts/types";
import { Field, StatusBadge, styles } from "../ui/primitives";
import { RequestState } from "../ui/request-states";

type Kind = OrganizationItem["kind"];
type Item = OrganizationItem;
type BackendItem = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  shop_id?: string;
  branch_id?: string;
  timezone?: string;
};
type Notice = {
  kind: "success" | "error" | "forbidden" | "conflict";
  message: string;
};
const names: Record<Kind, string> = {
  shop: "ร้าน",
  branch: "สาขา",
  department: "แผนก",
  position: "ตำแหน่ง",
};
const plural: Record<Kind, string> = {
  shop: "shops",
  branch: "branches",
  department: "departments",
  position: "positions",
};
const parentField: Record<Kind, string | null> = {
  shop: null,
  branch: "shop_id",
  department: "branch_id",
  position: "shop_id",
};
const itemId = (item: Item) => item.id;
const normalize = (value: BackendItem, kind: Kind): Item => ({
  id: value.id,
  kind,
  code: value.code,
  name: value.name,
  is_active: value.is_active,
  parent_id: value.shop_id ?? value.branch_id ?? null,
  timezone: value.timezone ?? null,
});
const fail = (error: unknown): Notice =>
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
    : { kind: "error", message: "ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองอีกครั้ง" };

async function allParents(kind: "shop" | "branch"): Promise<Item[]> {
  const records: Item[] = [];
  for (const active of [true, false]) {
    let nextPage = 1;
    while (true) {
      const result = await apiRequestPage<BackendItem>(
        `/v1/${plural[kind]}?page=${nextPage}&page_size=100&is_active=${active}`,
      );
      records.push(...result.data.map((item) => normalize(item, kind)));
      if (result.page * result.page_size >= result.total) break;
      nextPage = result.page + 1;
    }
  }
  return [...new Map(records.map(item => [item.id, item])).values()];
}

export function OrganizationLive() {
  const [kind, setKind] = useState<Kind>("shop");
  const [active, setActive] = useState(true);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [list, setList] = useState<ApiPage<Item> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [parents, setParents] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [filterParent, setFilterParent] = useState("");
  const [search, setSearch] = useState("");
  const [timezone, setTimezone] = useState("Asia/Bangkok");
  const [selected, setSelected] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let current = true;
    const params = new URLSearchParams({
      page: String(page),
      page_size: "20",
      is_active: String(active),
    });
    if (filterParent && parentField[kind]) {
      params.set(parentField[kind], filterParent);
    }
    if (search.trim()) params.set("search", search.trim());
    apiRequestPage<BackendItem>(`/v1/${plural[kind]}?${params}`)
      .then((result) => {
        if (current) {
          setList({
            ...result,
            data: result.data.map((item) => normalize(item, kind)),
          });
          setNotice((previous) =>
            previous?.kind === "success" ? previous : null,
          );
        }
      })
      .catch((error) => {
        if (current) {
          setList(null);
          setNotice(fail(error));
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [kind, active, page, filterParent, search, version]);

  useEffect(() => {
    const parentKind: "shop" | "branch" | null =
      kind === "department" ? "branch" : kind === "shop" ? null : "shop";
    if (!parentKind) return;
    let current = true;
    allParents(parentKind)
      .then((items) => {
        if (current) setParents(items);
      })
      .catch(() => {
        if (current) setParents([]);
      });
    return () => {
      current = false;
    };
  }, [kind, version]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || (!editing && parentField[kind] && !parent)) {
      setNotice({
        kind: "error",
        message: "กรอกชื่อและหน่วยงานแม่ให้ครบ",
      });
      return;
    }
    setBusy(true);
    setNotice(null);
    const payload: Record<string, string> = {
      name: name.trim(),
    };
    if (!editing && parentField[kind]) payload[parentField[kind]] = parent;
    if (kind === "branch") payload.timezone = timezone.trim();
    try {
      await apiRequest(`/v1/${plural[kind]}${editing ? `/${encodeURIComponent(editing.id)}` : ""}`, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setName("");
      setParent("");
      setNotice({ kind: "success", message: `${editing ? "แก้ไข" : "เพิ่ม"}${names[kind]}แล้ว` });
      setEditing(null);
      setActive(true);
      setPage(1);
      setVersion((value) => value + 1);
    } catch (error) {
      setNotice(fail(error));
    } finally {
      setBusy(false);
    }
  };
  const deactivate = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !reason.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const pathId = encodeURIComponent(itemId(selected));
      await apiRequest(`/v1/${plural[selected.kind]}/${pathId}/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setNotice({
        kind: "success",
        message: `ปิดใช้งาน${names[selected.kind]}แล้ว ข้อมูลเดิมยังคงอยู่ในประวัติ`,
      });
      setSelected(null);
      setReason("");
      setPage(1);
      setVersion((value) => value + 1);
    } catch (error) {
      setNotice(fail(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.grid}>
      <section
        className={`${styles.panel} ${styles.span8}`}
        aria-labelledby="org-title"
      >
        <div className={styles.sectionHead}>
          <div>
            <h2 id="org-title">โครงสร้างองค์กร</h2>
            <p className={styles.muted}>ข้อมูลจริงตามขอบเขตสิทธิ์ของคุณ</p>
          </div>
          {list ? <StatusBadge>{list.total} รายการทั้งหมด</StatusBadge> : null}
        </div>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="ประเภทโครงสร้างองค์กร"
        >
          {(Object.keys(names) as Kind[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={kind === value}
              disabled={busy}
              className={`${styles.button} ${kind === value ? "" : styles.buttonSecondary}`}
              onClick={() => {
                if (value === kind) { setLoading(true); setVersion(current => current + 1); return; }
                setKind(value);
                setPage(1);
                setParent("");
                setFilterParent("");
                setSearch("");
                setParents([]);
                setLoading(true);
                setNotice(null);
                setSelected(null);
                setEditing(null);
                setName("");
              }}
            >
              {names[value]}
            </button>
          ))}
        </div>
        <div className={styles.toolbar}>
          <Field label="ค้นหารหัสหรือชื่อ"><input className={styles.input} value={search} onChange={event => {
            setSearch(event.target.value); setPage(1); setLoading(true);
          }} /></Field>
          <Field label="สถานะ">
            <select
              className={styles.select}
              value={String(active)}
              onChange={(event) => {
                setActive(event.target.value === "true");
                setPage(1);
                setLoading(true);
              }}
            >
              <option value="true">ใช้งาน</option>
              <option value="false">ปิดใช้งาน</option>
            </select>
          </Field>
          {parentField[kind] ? (
            <Field label={kind === "department" ? "สาขา" : "ร้าน"}>
              <select
                className={styles.select}
                value={filterParent}
                onChange={(event) => {
                  setFilterParent(event.target.value);
                  setPage(1);
                  setLoading(true);
                }}
              >
                <option value="">
                  ทุก{kind === "department" ? "สาขา" : "ร้าน"}
                </option>
                {parents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}{item.is_active ? "" : " · ปิดใช้งาน"}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>
        {loading ? (
          <RequestState
            kind="loading"
            title="กำลังโหลดข้อมูล"
            detail="กำลังตรวจข้อมูลล่าสุด"
          />
        ) : notice && notice.kind !== "success" ? (
          <RequestState
            kind={notice.kind}
            title="โหลดข้อมูลไม่สำเร็จ"
            detail={notice.message}
          />
        ) : list?.data.length ? (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>รหัส</th>
                    <th>ชื่อ</th>
                    <th>หน่วยงานแม่</th>
                    <th>สถานะ</th>
                    <th>
                      <span className={styles.srOnly}>การทำงาน</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.code}</strong>
                      </td>
                      <td>{item.name}</td>
                      <td>
                        {item.parent_id
                          ? (parents.find(
                              (parentItem) => parentItem.id === item.parent_id,
                            )?.name ?? item.parent_id)
                          : "ไม่ระบุ"}
                      </td>
                      <td>
                        <StatusBadge tone={item.is_active ? "ok" : "danger"}>
                          {item.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                        </StatusBadge>
                      </td>
                      <td>
                        <button className={styles.buttonSecondary} type="button" disabled={busy} onClick={() => {
                          setEditing(item); setName(item.name);
                          setParent(item.parent_id ?? ""); setTimezone(item.timezone ?? "Asia/Bangkok");
                          setSelected(null); setNotice(null);
                        }}>แก้ไข</button>
                        {item.is_active ? (
                          <button
                            className={styles.buttonSecondary}
                            type="button"
                            onClick={() => {
                              setSelected(item);
                              setNotice(null);
                            }}
                          >
                            ปิดใช้งาน
                          </button>
                        ) : (
                          "เก็บเป็นประวัติ"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.button}
                type="button"
                disabled={list.page === 1}
                onClick={() => {
                  setPage(page - 1);
                  setLoading(true);
                }}
              >
                ก่อนหน้า
              </button>
              <span>
                หน้า {list.page} · รวม {list.total} รายการ
              </span>
              <button
                className={styles.button}
                type="button"
                disabled={list.page * list.page_size >= list.total}
                onClick={() => {
                  setPage(page + 1);
                  setLoading(true);
                }}
              >
                ถัดไป
              </button>
            </div>
          </>
        ) : (
          <RequestState
            kind="empty"
            title={`ไม่พบ${names[kind]}`}
            detail="ลองสลับสถานะหรือเพิ่มรายการใหม่"
          />
        )}
      </section>
      <section className={`${styles.panel} ${styles.span4}`}>
        <h2>{editing ? "แก้ไข" : "เพิ่ม"}{names[kind]}</h2>
        <form onSubmit={(event) => void create(event)}>
          <div className={styles.formGrid}>
            <Field label="ชื่อ">
              <input
                className={styles.input}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={kind === "department" || kind === "position" ? 100 : 150}
                required
              />
            </Field>
            {parentField[kind] ? (
              <Field label={kind === "department" ? "สาขา" : "ร้าน"}>
                <select
                  className={styles.select}
                  value={parent}
                  disabled={!!editing}
                  onChange={(event) => setParent(event.target.value)}
                  required
                >
                  <option value="">เลือกหน่วยงานแม่</option>
                  {parents.filter(item => item.is_active || editing?.parent_id === item.id).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {kind === "branch" ? (
              <Field label="เขตเวลา">
                <input
                  className={styles.input}
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  maxLength={50}
                />
              </Field>
            ) : null}
          </div>
          <button className={styles.button} type="submit" disabled={busy}>
            {editing ? "บันทึกการแก้ไข" : `เพิ่ม${names[kind]}`}
          </button>
          {editing && <button className={styles.buttonSecondary} type="button" disabled={busy} onClick={() => {
            setEditing(null); setName(""); setParent(""); setTimezone("Asia/Bangkok");
          }}>ยกเลิกการแก้ไข</button>}
        </form>
      </section>
      {selected ? (
        <section className={`${styles.panel} ${styles.span6}`}>
          <h2>ยืนยันการปิดใช้งาน</h2>
          <p>
            {selected.code} · {selected.name}
          </p>
          <form onSubmit={(event) => void deactivate(event)}>
            <Field label="เหตุผล" hint="ระบบบันทึกไว้สำหรับการตรวจสอบย้อนหลัง">
              <textarea
                className={styles.textarea}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                required
              />
            </Field>
            <div className={styles.actions}>
              <button
                className={styles.buttonSecondary}
                type="button"
                onClick={() => setSelected(null)}
              >
                ยกเลิก
              </button>
              <button
                className={styles.button}
                type="submit"
                disabled={busy || !reason.trim()}
              >
                ยืนยันปิดใช้งาน
              </button>
            </div>
          </form>
        </section>
      ) : null}
      {notice?.kind === "success" ? (
        <section className={styles.span12}>
          <RequestState
            kind="success"
            title="บันทึกสำเร็จ"
            detail={notice.message}
          />
        </section>
      ) : null}
    </div>
  );
}
