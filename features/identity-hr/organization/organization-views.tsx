"use client";

import { FormEvent, useMemo, useState } from "react";
import type { OrganizationItem } from "../contracts/types";
import { Field, StatusBadge, styles } from "../ui/primitives";
import { RequestState } from "../ui/request-states";

type OrganizationKind = OrganizationItem["kind"];

const kindLabel: Record<OrganizationKind, string> = {
  shop: "ร้าน",
  branch: "สาขา",
  department: "แผนก",
  position: "ตำแหน่ง",
};

const kindDescription: Record<OrganizationKind, string> = {
  shop: "หน่วยธุรกิจหลักที่รวมสาขาและตำแหน่งงาน",
  branch: "สถานที่ปฏิบัติงานและเขตเวลาที่ใช้บันทึกเวลา",
  department: "ทีมงานภายในสาขาที่ใช้กำหนดขอบเขตหัวหน้างาน",
  position: "ชื่อตำแหน่งมาตรฐานภายใต้ร้าน",
};

export function OrganizationView({
  items,
}: {
  items: readonly OrganizationItem[];
}) {
  const [records, setRecords] = useState<OrganizationItem[]>([...items]);
  const [kind, setKind] = useState<OrganizationKind>("shop");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [parentFilter, setParentFilter] = useState("all");
  const [selected, setSelected] = useState<OrganizationItem | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const parentOptions = useMemo(() => {
    const seen = new Set<string>();
    return records.filter(
      (item) =>
        item.parent_id && !seen.has(item.parent_id) && seen.add(item.parent_id),
    );
  }, [records]);

  const visibleItems = useMemo(
    () =>
      records.filter((item) => {
        if (item.kind !== kind) return false;
        if (activeFilter === "active" && !item.is_active) return false;
        if (activeFilter === "inactive" && item.is_active) return false;
        return parentFilter === "all" || item.parent_id === parentFilter;
      }),
    [activeFilter, kind, parentFilter, records],
  );

  const deactivate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !reason.trim()) return;
    setRecords((current) =>
      current.map((item) =>
        item.id === selected.id ? { ...item, is_active: false } : item,
      ),
    );
    setNotice(
      `เตรียมปิดใช้งาน ${kindLabel[selected.kind]} ${selected.name} แล้ว`,
    );
    setSelected(null);
    setReason("");
  };

  return (
    <div className={styles.grid}>
      <section
        className={`${styles.panel} ${styles.span8}`}
        aria-labelledby="organization-title"
      >
        <div className={styles.sectionHead}>
          <div>
            <h2 id="organization-title">โครงสร้างองค์กร</h2>
            <p className={styles.muted}>{kindDescription[kind]}</p>
          </div>
          <StatusBadge>
            {
              records.filter((item) => item.kind === kind && item.is_active)
                .length
            }{" "}
            ใช้งาน
          </StatusBadge>
        </div>

        <div
          className={styles.tabs}
          role="tablist"
          aria-label="ประเภทโครงสร้างองค์กร"
        >
          {(Object.keys(kindLabel) as OrganizationKind[]).map((itemKind) => (
            <button
              className={`${styles.button} ${kind === itemKind ? "" : styles.buttonSecondary}`}
              key={itemKind}
              type="button"
              role="tab"
              aria-selected={kind === itemKind}
              onClick={() => {
                setKind(itemKind);
                setParentFilter("all");
                setSelected(null);
              }}
            >
              {kindLabel[itemKind]}
            </button>
          ))}
        </div>

        <div className={styles.toolbar}>
          <Field label="สถานะ">
            <select
              className={styles.select}
              value={activeFilter}
              onChange={(event) =>
                setActiveFilter(event.target.value as typeof activeFilter)
              }
            >
              <option value="all">ทั้งหมด</option>
              <option value="active">ใช้งาน</option>
              <option value="inactive">ปิดใช้งาน</option>
            </select>
          </Field>
          {kind !== "shop" ? (
            <Field label="หน่วยงานแม่">
              <select
                className={styles.select}
                value={parentFilter}
                onChange={(event) => setParentFilter(event.target.value)}
              >
                <option value="all">ทั้งหมด</option>
                {parentOptions.map((item) => (
                  <option key={item.parent_id} value={item.parent_id ?? ""}>
                    {item.parent_name ?? item.parent_id}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>

        {visibleItems.length === 0 ? (
          <RequestState
            kind="empty"
            title={`ยังไม่มี${kindLabel[kind]}ในตัวกรองนี้`}
            detail="เปลี่ยนตัวกรอง หรือเพิ่มรายการใหม่จากแบบฟอร์มด้านข้าง"
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อ</th>
                  <th>หน่วยงานแม่</th>
                  <th>รายละเอียด</th>
                  <th>สถานะ</th>
                  <th>
                    <span className={styles.srOnly}>การทำงาน</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={`${item.kind}-${item.id}`}>
                    <td>
                      <strong>{item.code}</strong>
                    </td>
                    <td>{item.name}</td>
                    <td>{item.parent_name ?? "ระดับสูงสุด"}</td>
                    <td>{item.timezone ?? "—"}</td>
                    <td>
                      <StatusBadge tone={item.is_active ? "ok" : "danger"}>
                        {item.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                      </StatusBadge>
                    </td>
                    <td>
                      {item.is_active ? (
                        <button
                          className={`${styles.button} ${styles.buttonSecondary}`}
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
        )}
      </section>

      <section
        className={`${styles.panel} ${styles.span4}`}
        aria-labelledby="organization-form-title"
      >
        <h2 id="organization-form-title">เพิ่ม{kindLabel[kind]}</h2>
        <OrganizationForm
          kind={kind}
          onPrepared={(message) => setNotice(message)}
        />
      </section>

      {selected ? (
        <section
          className={`${styles.panel} ${styles.span6}`}
          aria-labelledby="deactivate-title"
        >
          <h2 id="deactivate-title">ยืนยันการปิดใช้งาน</h2>
          <p>
            รายการ{" "}
            <strong>
              {selected.code} · {selected.name}
            </strong>{" "}
            จะยังคงอยู่ในประวัติและข้อมูลเงินเดือนเดิม
          </p>
          <form onSubmit={deactivate}>
            <Field label="เหตุผล" hint="จำเป็นสำหรับการตรวจสอบย้อนหลัง">
              <textarea
                className={styles.textarea}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                autoFocus
                required
              />
            </Field>
            <div className={styles.actions}>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                type="button"
                onClick={() => {
                  setSelected(null);
                  setReason("");
                }}
              >
                ยกเลิก
              </button>
              <button
                className={`${styles.button} ${styles.buttonDanger}`}
                type="submit"
                disabled={!reason.trim()}
              >
                ยืนยันปิดใช้งาน
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className={`${styles.span12}`} aria-live="polite">
        {notice ? (
          <RequestState
            kind="success"
            title="อัปเดตเฉพาะหน้าพรีวิว"
            detail={`${notice} การบันทึกจริงและ audit log จะเกิดหลังเชื่อม shared API client`}
          />
        ) : null}
      </section>
    </div>
  );
}

function OrganizationForm({
  kind,
  onPrepared,
}: {
  kind: OrganizationKind;
  onPrepared: (message: string) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [timezone, setTimezone] = useState("Asia/Bangkok");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError("กรอกรหัสและชื่อให้ครบ");
      return;
    }
    if (kind !== "shop" && !parentId) {
      setError(`เลือกหน่วยงานแม่ของ${kindLabel[kind]}`);
      return;
    }
    setError(null);
    onPrepared(`เตรียมข้อมูล${kindLabel[kind]} ${name.trim()} แล้ว`);
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className={styles.formGrid}>
        <Field label="รหัส">
          <input
            className={styles.input}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.toLocaleUpperCase("en"))
            }
          />
        </Field>
        <Field label="ชื่อ">
          <input
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {kind !== "shop" ? (
          <Field
            label={
              kind === "position" ? "ร้าน" : kind === "branch" ? "ร้าน" : "สาขา"
            }
          >
            <select
              className={styles.select}
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">เลือกหน่วยงานแม่</option>
              {kind === "department" ? (
                <option value="11">สาขาสุขุมวิท</option>
              ) : (
                <option value="1">Haris Premium Buffet</option>
              )}
            </select>
          </Field>
        ) : null}
        {kind === "branch" ? (
          <Field label="เขตเวลา">
            <input
              className={styles.input}
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </Field>
        ) : null}
      </div>
      {error ? (
        <RequestState
          kind="error"
          title="ยังเพิ่มรายการไม่ได้"
          detail={error}
        />
      ) : null}
      <div className={styles.actions}>
        <button className={styles.button} type="submit">
          ตรวจข้อมูล{kindLabel[kind]}
        </button>
      </div>
    </form>
  );
}
