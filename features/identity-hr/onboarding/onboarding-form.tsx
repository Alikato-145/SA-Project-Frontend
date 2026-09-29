"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiClientError } from "@/lib/api/client";
import { RequestState } from "../ui/request-states";
import { styles } from "../ui/primitives";
import {
  onboardingApi,
  type BranchChoice,
  type Choice,
  type DepartmentChoice,
  type OnboardingResult,
  type PositionChoice,
} from "./onboarding-api";

type Draft = {
  employee_code: string;
  hire_date: string;
  first_name: string;
  last_name: string;
  national_id: string;
  passport_id: string;
  shop_id: string;
  branch_id: string;
  department_id: string;
  position_id: string;
  employment_type: "full_time" | "part_time" | "temporary";
  base_salary: string;
  welfare_amount: string;
  bank: boolean;
  bank_code: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  account: boolean;
  username: string;
  weekdays: number[];
};
const blank: Draft = {
  employee_code: "",
  hire_date: "",
  first_name: "",
  last_name: "",
  national_id: "",
  passport_id: "",
  shop_id: "",
  branch_id: "",
  department_id: "",
  position_id: "",
  employment_type: "full_time",
  base_salary: "",
  welfare_amount: "0.00",
  bank: false,
  bank_code: "",
  bank_name: "",
  account_holder_name: "",
  account_number: "",
  account: false,
  username: "",
  weekdays: [],
};
const days = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];
const moneyPattern = /^\d+\.\d{2}$/;
const usernamePattern = /^[A-Za-z0-9._-]{3,100}$/;

function messageFor(cause: unknown): string {
  if (!(cause instanceof ApiClientError)) return "เกิดข้อผิดพลาด กรุณาลองใหม่";
  if (cause.code === "NETWORK_ERROR") return "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่";
  if (cause.status === 401 || cause.status === 403)
    return "ไม่มีสิทธิ์ดำเนินการ กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับสิทธิ์";
  if (cause.status === 409)
    return "ข้อมูลขัดแย้งกับรายการปัจจุบัน กรุณาตรวจสอบรหัสพนักงาน ช่วงวันที่ และรายการที่เลือก";
  if (cause.status === 400 || cause.status === 422)
    return "ข้อมูลไม่ผ่านการตรวจสอบ กรุณาตรวจสอบทุกช่องและลองใหม่";
  return "บันทึกไม่สำเร็จ กรุณาลองใหม่";
}

export function OnboardingForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<Draft>(blank);
  const [shops, setShops] = useState<Choice[]>([]);
  const [branches, setBranches] = useState<BranchChoice[]>([]);
  const [departments, setDepartments] = useState<DepartmentChoice[]>([]);
  const [positions, setPositions] = useState<PositionChoice[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choiceError, setChoiceError] = useState(false);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const loading = loadingShops || loadingOrg || loadingDepartments;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const controller = new AbortController();
    void onboardingApi
      .shops(controller.signal)
      .then(setShops)
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(messageFor(cause));
          setChoiceError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingShops(false);
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (!draft.shop_id) return;
    const controller = new AbortController();
    void Promise.all([
      onboardingApi.branches(draft.shop_id, controller.signal),
      onboardingApi.positions(draft.shop_id, controller.signal),
    ])
      .then(([branchRows, positionRows]) => {
        setBranches(branchRows);
        setPositions(positionRows);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(messageFor(cause));
          setChoiceError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingOrg(false);
      });
    return () => controller.abort();
  }, [draft.shop_id, retry]);
  useEffect(() => {
    if (!draft.branch_id) return;
    const controller = new AbortController();
    void onboardingApi
      .departments(draft.branch_id, controller.signal)
      .then(setDepartments)
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(messageFor(cause));
          setChoiceError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDepartments(false);
      });
    return () => controller.abort();
  }, [draft.branch_id, retry]);

  const next = () => {
    setError(null);
    setChoiceError(false);
    if (!formRef.current?.reportValidity()) return;
    if (!draft.national_id.trim() && !draft.passport_id.trim()) {
      setError(
        "กรุณากรอกเลขบัตรประชาชนหรือเลขหนังสือเดินทางอย่างน้อยหนึ่งรายการ",
      );
      return;
    }
    setStep(2);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || loading || !formRef.current?.reportValidity()) return;
    setError(null);
    setChoiceError(false);
    if (
      !moneyPattern.test(draft.base_salary) ||
      !moneyPattern.test(draft.welfare_amount)
    ) {
      setError("เงินเดือนฐานและสวัสดิการต้องเป็นเลขทศนิยม 2 ตำแหน่ง");
      return;
    }
    if (draft.account && !usernamePattern.test(draft.username)) {
      setError(
        "ชื่อผู้ใช้ต้องมี 3–100 ตัวอักษร ใช้ตัวอักษรอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง",
      );
      return;
    }
    setBusy(true);
    try {
      const created = await onboardingApi.onboard({
        employee: {
          employee_code: draft.employee_code.trim(),
          hire_date: draft.hire_date,
          first_name: draft.first_name.trim(),
          last_name: draft.last_name.trim(),
          national_id: draft.national_id.trim() || null,
          passport_id: draft.passport_id.trim() || null,
        },
        assignment: {
          branch_id: draft.branch_id,
          department_id: draft.department_id,
          position_id: draft.position_id,
          employment_type: draft.employment_type,
          base_salary: draft.base_salary,
          welfare_amount: draft.welfare_amount,
          effective_from: draft.hire_date,
        },
        ...(draft.bank
          ? {
              bank_account: {
                bank_code: draft.bank_code.trim(),
                bank_name: draft.bank_name.trim(),
                account_holder_name: draft.account_holder_name.trim(),
                account_number: draft.account_number.trim(),
                is_primary: true as const,
              },
            }
          : {}),
        ...(draft.weekdays.length
          ? {
              weekly_holidays: draft.weekdays.map((weekday) => ({
                weekday,
                effective_from: draft.hire_date,
              })),
            }
          : {}),
        ...(draft.account
          ? { account: { username: draft.username.trim() } }
          : {}),
      });
      setResult(created);
      setDraft(blank);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      // Full account numbers stay in browser memory only and are cleared after every request.
      setDraft((current) => ({ ...current, account_number: "" }));
      setBusy(false);
    }
  };

  if (result)
    return (
      <section className={styles.panel} role="status">
        <h2>สร้างพนักงานสำเร็จ</h2>
        <p>
          {result.employee.employee_code} · {result.employee.first_name}{" "}
          {result.employee.last_name}
        </p>
        {result.temporary_password ? (
          <p className={styles.notice}>
            รหัสผ่านชั่วคราว (แสดงครั้งนี้เท่านั้น):{" "}
            <strong>{result.temporary_password}</strong>
          </p>
        ) : null}
        <div className={styles.actions}>
          <Link
            className={styles.button}
            href={`/employees/${result.employee.id}`}
          >
            ดูข้อมูลพนักงาน
          </Link>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            type="button"
            onClick={() => {
              setResult(null);
              setStep(1);
              setError(null);
            }}
          >
            สร้างพนักงานอีกคน
          </button>
        </div>
      </section>
    );

  return (
    <form ref={formRef} onSubmit={submit}>
      <div className={styles.steps} aria-label="ขั้นตอนการรับพนักงาน">
        <div
          className={`${styles.step} ${step === 1 ? styles.stepActive : ""}`}
        >
          1 · ข้อมูลพนักงาน
        </div>
        <div
          className={`${styles.step} ${step === 2 ? styles.stepActive : ""}`}
        >
          2 · การจ้างและตัวเลือก
        </div>
      </div>
      {error ? (
        <RequestState kind="error" title="ดำเนินการไม่สำเร็จ" detail={error} />
      ) : null}
      {choiceError ? (
        <button
          type="button"
          className={`${styles.button} ${styles.buttonSecondary}`}
          onClick={() => {
            setError(null);
            setChoiceError(false);
            setLoadingShops(true);
            if (draft.shop_id) setLoadingOrg(true);
            if (draft.branch_id) setLoadingDepartments(true);
            setRetry((value) => value + 1);
          }}
        >
          โหลดตัวเลือกอีกครั้ง
        </button>
      ) : null}
      {step === 1 ? (
        <div className={styles.formGrid}>
          <label className={styles.field}>
            รหัสพนักงาน
            <input
              className={styles.input}
              value={draft.employee_code}
              onChange={(e) => set("employee_code", e.target.value)}
              required
              maxLength={30}
            />
          </label>
          <label className={styles.field}>
            วันที่เริ่มงาน
            <input
              className={styles.input}
              value={draft.hire_date}
              onChange={(e) => set("hire_date", e.target.value)}
              type="date"
              required
            />
          </label>
          <label className={styles.field}>
            ชื่อ
            <input
              className={styles.input}
              value={draft.first_name}
              onChange={(e) => set("first_name", e.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label className={styles.field}>
            นามสกุล
            <input
              className={styles.input}
              value={draft.last_name}
              onChange={(e) => set("last_name", e.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label className={styles.field}>
            เลขบัตรประชาชน
            <input
              className={styles.input}
              value={draft.national_id}
              onChange={(e) => set("national_id", e.target.value)}
              maxLength={20}
              autoComplete="off"
            />
          </label>
          <label className={styles.field}>
            เลขหนังสือเดินทาง
            <input
              className={styles.input}
              value={draft.passport_id}
              onChange={(e) => set("passport_id", e.target.value)}
              maxLength={30}
              autoComplete="off"
            />
          </label>
        </div>
      ) : (
        <>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              ร้าน
              <select
                className={styles.select}
                value={draft.shop_id}
                onChange={(e) => {
                  setDraft((current) => ({
                    ...current,
                    shop_id: e.target.value,
                    branch_id: "",
                    department_id: "",
                    position_id: "",
                  }));
                  setBranches([]);
                  setDepartments([]);
                  setPositions([]);
                  setLoadingOrg(Boolean(e.target.value));
                  setLoadingDepartments(false);
                  setError(null);
                }}
                required
                disabled={loadingShops}
              >
                <option value="">เลือกร้าน</option>
                {shops.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              สาขา
              <select
                className={styles.select}
                value={draft.branch_id}
                onChange={(e) => {
                  setDraft((current) => ({
                    ...current,
                    branch_id: e.target.value,
                    department_id: "",
                  }));
                  setDepartments([]);
                  setLoadingDepartments(Boolean(e.target.value));
                  setError(null);
                }}
                required
                disabled={!draft.shop_id || loadingOrg}
              >
                <option value="">เลือกสาขา</option>
                {branches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              แผนก
              <select
                className={styles.select}
                value={draft.department_id}
                onChange={(e) => set("department_id", e.target.value)}
                required
                disabled={!draft.branch_id || loadingDepartments}
              >
                <option value="">เลือกแผนก</option>
                {departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              ตำแหน่ง
              <select
                className={styles.select}
                value={draft.position_id}
                onChange={(e) => set("position_id", e.target.value)}
                required
                disabled={!draft.shop_id || loadingOrg}
              >
                <option value="">เลือกตำแหน่ง</option>
                {positions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              ประเภทการจ้าง
              <select
                className={styles.select}
                value={draft.employment_type}
                onChange={(e) =>
                  set(
                    "employment_type",
                    e.target.value as Draft["employment_type"],
                  )
                }
              >
                <option value="full_time">เต็มเวลา</option>
                <option value="part_time">ไม่เต็มเวลา</option>
                <option value="temporary">ชั่วคราว</option>
              </select>
            </label>
            <label className={styles.field}>
              เงินเดือนฐาน
              <input
                className={styles.input}
                value={draft.base_salary}
                onChange={(e) => set("base_salary", e.target.value)}
                inputMode="decimal"
                placeholder="18000.00"
                pattern="[0-9]+[.][0-9]{2}"
                required
              />
            </label>
            <label className={styles.field}>
              สวัสดิการ
              <input
                className={styles.input}
                value={draft.welfare_amount}
                onChange={(e) => set("welfare_amount", e.target.value)}
                inputMode="decimal"
                pattern="[0-9]+[.][0-9]{2}"
                required
              />
            </label>
          </div>
          {loading ? (
            <RequestState
              kind="loading"
              title="กำลังโหลดตัวเลือกองค์กร"
              detail="กรุณารอสักครู่"
            />
          ) : null}
          <section className={styles.panel} style={{ marginTop: 16 }}>
            <h2>วันหยุดประจำสัปดาห์</h2>
            <div className={styles.toolbar}>
              {days.map((day, weekday) => (
                <label className={styles.check} key={weekday}>
                  <input
                    type="checkbox"
                    checked={draft.weekdays.includes(weekday)}
                    onChange={(e) =>
                      set(
                        "weekdays",
                        e.target.checked
                          ? [...draft.weekdays, weekday]
                          : draft.weekdays.filter((value) => value !== weekday),
                      )
                    }
                  />
                  {day}
                </label>
              ))}
            </div>
          </section>
          <section className={styles.panel} style={{ marginTop: 16 }}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={draft.bank}
                onChange={(e) => {
                  set("bank", e.target.checked);
                  if (!e.target.checked)
                    setDraft((current) => ({
                      ...current,
                      bank: false,
                      bank_code: "",
                      bank_name: "",
                      account_holder_name: "",
                      account_number: "",
                    }));
                }}
              />
              <strong>เพิ่มบัญชีธนาคาร</strong>
            </label>
            {draft.bank ? (
              <div className={styles.formGrid} style={{ marginTop: 16 }}>
                <label className={styles.field}>
                  รหัสธนาคาร
                  <input
                    className={styles.input}
                    value={draft.bank_code}
                    onChange={(e) => set("bank_code", e.target.value)}
                    required
                    maxLength={20}
                  />
                </label>
                <label className={styles.field}>
                  ชื่อธนาคาร
                  <input
                    className={styles.input}
                    value={draft.bank_name}
                    onChange={(e) => set("bank_name", e.target.value)}
                    required
                    maxLength={100}
                  />
                </label>
                <label className={styles.field}>
                  ชื่อเจ้าของบัญชี
                  <input
                    className={styles.input}
                    value={draft.account_holder_name}
                    onChange={(e) => set("account_holder_name", e.target.value)}
                    required
                    maxLength={200}
                  />
                </label>
                <label className={styles.field}>
                  เลขบัญชี
                  <input
                    className={styles.input}
                    value={draft.account_number}
                    onChange={(e) => set("account_number", e.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    minLength={6}
                    maxLength={34}
                  />
                </label>
              </div>
            ) : null}
          </section>
          <section className={styles.panel} style={{ marginTop: 16 }}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={draft.account}
                onChange={(e) => {
                  set("account", e.target.checked);
                  if (!e.target.checked) set("username", "");
                }}
              />
              <strong>สร้างบัญชีเข้าใช้งาน</strong>
            </label>
            {draft.account ? (
              <label className={styles.field} style={{ marginTop: 16 }}>
                ชื่อผู้ใช้
                <input
                  className={styles.input}
                  value={draft.username}
                  onChange={(e) => set("username", e.target.value)}
                  required
                  minLength={3}
                  maxLength={100}
                  autoComplete="off"
                />
              </label>
            ) : null}
            <p className={styles.muted}>
              รหัสผ่านชั่วคราวจะแสดงครั้งเดียวหลังบันทึกสำเร็จ
            </p>
          </section>
        </>
      )}
      <div className={styles.actions}>
        {step === 2 ? (
          <button
            type="button"
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={() => {
              setStep(1);
              setError(null);
              set("account_number", "");
            }}
            disabled={busy}
          >
            ย้อนกลับ
          </button>
        ) : null}
        {step === 1 ? (
          <button type="button" className={styles.button} onClick={next}>
            ถัดไป
          </button>
        ) : (
          <button
            className={styles.button}
            type="submit"
            disabled={busy || loading || !shops.length}
          >
            {busy ? "กำลังบันทึก…" : "สร้างพนักงาน"}
          </button>
        )}
      </div>
    </form>
  );
}
