"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import type { BankAccountSummary, WeeklyHolidayItem } from "../contracts/types";
import { Field, styles } from "../ui/primitives";
import { RequestState } from "../ui/request-states";
import {
  onboardingApi,
  type BranchChoice,
  type Choice,
  type DepartmentChoice,
  type PositionChoice,
} from "../onboarding/onboarding-api";
import {
  employeeReadApi,
  type EmployeeAssignment,
  type NewAssignment,
} from "./employee-read-api";

type View = "employment" | "bank" | "weekly-holidays";
type Props = {
  employeeId: string;
  view: View;
  related: EmployeeAssignment[] | BankAccountSummary[] | WeeklyHolidayItem[];
  onSuccess(message: string): void;
};
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
const issue = (error: unknown) =>
  error instanceof ApiClientError
    ? error.message
    : "ไม่สามารถบันทึกได้ กรุณาลองอีกครั้ง";
const weekdays = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];

export function EmployeeWriteControls({
  employeeId,
  view,
  related,
  onSuccess,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [deactivateBankId, setDeactivateBankId] = useState("");
  const [endHolidayId, setEndHolidayId] = useState("");
  const [shops, setShops] = useState<Choice[]>([]);
  const [branches, setBranches] = useState<BranchChoice[]>([]);
  const [departments, setDepartments] = useState<DepartmentChoice[]>([]);
  const [positions, setPositions] = useState<PositionChoice[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [orgLoading, setOrgLoading] = useState(view === "employment");
  const [orgRetry, setOrgRetry] = useState(0);
  const banks = view === "bank" ? (related as BankAccountSummary[]) : [];
  const activeBanks = banks.filter((item) => item.is_active);
  const assignments =
    view === "employment" ? (related as EmployeeAssignment[]) : [];
  const holidays =
    view === "weekly-holidays" ? (related as WeeklyHolidayItem[]) : [];
  const latestAssignment = assignments.reduce<EmployeeAssignment | null>(
    (current, item) =>
      !current || item.effective_from > current.effective_from ? item : current,
    null,
  );

  useEffect(() => {
    if (view !== "employment") return;
    const controller = new AbortController();
    void onboardingApi
      .shops(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setShops(items);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(issue(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setOrgLoading(false);
      });
    return () => controller.abort();
  }, [view, orgRetry]);

  useEffect(() => {
    if (!selectedShopId) return;
    const controller = new AbortController();
    void Promise.all([
      onboardingApi.branches(selectedShopId, controller.signal),
      onboardingApi.positions(selectedShopId, controller.signal),
    ])
      .then(([branchRows, positionRows]) => {
        if (!controller.signal.aborted) {
          setBranches(branchRows);
          setPositions(positionRows);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(issue(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setOrgLoading(false);
      });
    return () => controller.abort();
  }, [selectedShopId, orgRetry]);

  useEffect(() => {
    if (!selectedBranchId) return;
    const controller = new AbortController();
    void onboardingApi
      .departments(selectedBranchId, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setDepartments(items);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(issue(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setOrgLoading(false);
      });
    return () => controller.abort();
  }, [selectedBranchId, orgRetry]);

  const run = async (
    operation: () => Promise<unknown>,
    message: string,
    form?: HTMLFormElement,
  ) => {
    setBusy(true);
    setError("");
    try {
      await operation();
      form?.reset();
      setSelectedBankId("");
      setDeactivateBankId("");
      setEndHolidayId("");
      onSuccess(message);
    } catch (cause) {
      setError(issue(cause));
    } finally {
      setBusy(false);
    }
  };

  const submitAssignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input: NewAssignment = {
      branch_id: selectedBranchId,
      department_id: selectedDepartmentId,
      position_id: selectedPositionId,
      employment_type: field(
        data,
        "employment_type",
      ) as NewAssignment["employment_type"],
      base_salary: field(data, "base_salary"),
      welfare_amount: field(data, "welfare_amount"),
      effective_from: field(data, "effective_from"),
      effective_to: field(data, "effective_to") || null,
    };
    if (
      latestAssignment &&
      input.effective_from <=
        (latestAssignment.effective_to ?? latestAssignment.effective_from)
    ) {
      setError("วันเริ่มใหม่ต้องอยู่หลังช่วงการจ้างล่าสุด");
      return;
    }
    if (
      !selectedShopId ||
      !selectedBranchId ||
      !selectedDepartmentId ||
      !selectedPositionId
    ) {
      setError("เลือกโครงสร้างการจ้างให้ครบก่อนบันทึก");
      return;
    }
    void run(
      () => employeeReadApi.addAssignment(employeeId, input),
      "เพิ่มช่วงการจ้างใหม่แล้ว ประวัติเดิมยังคงอยู่",
      form,
    );
  };

  const submitBank = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const number = field(data, "account_number");
    if (!/^\d{6,34}$/.test(number.replace(/[ -]/g, ""))) {
      setError("เลขบัญชีต้องมีตัวเลข 6–34 หลัก");
      return;
    }
    const input = {
      bank_code: field(data, "bank_code"),
      bank_name: field(data, "bank_name"),
      account_holder_name: field(data, "account_holder_name"),
      account_number: number,
      is_primary: field(data, "is_primary") === "true",
    };
    void run(
      () => employeeReadApi.addBankAccount(employeeId, input),
      "เพิ่มบัญชีธนาคารแล้ว",
      form,
    ).finally(() => {
      const numberField = form.elements.namedItem("account_number");
      if (numberField instanceof HTMLInputElement) numberField.value = "";
    });
  };

  const submitBankUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBankId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      bank_code: field(data, "bank_code"),
      bank_name: field(data, "bank_name"),
      account_holder_name: field(data, "account_holder_name"),
      ...(field(data, "account_number")
        ? { account_number: field(data, "account_number") }
        : {}),
    };
    void run(
      () =>
        employeeReadApi.updateBankAccount(employeeId, selectedBankId, input),
      "แก้ข้อมูลบัญชีธนาคารแล้ว",
      form,
    ).finally(() => {
      const numberField = form.elements.namedItem("account_number");
      if (numberField instanceof HTMLInputElement) numberField.value = "";
    });
  };

  const submitDeactivate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deactivateBankId) return;
    const form = event.currentTarget;
    const replacement = field(
      new FormData(form),
      "replacement_bank_account_id",
    );
    void run(
      () =>
        employeeReadApi.deactivateBankAccount(
          employeeId,
          deactivateBankId,
          replacement
            ? { replacement_bank_account_id: replacement }
            : { allow_no_primary: true },
        ),
      "ปิดใช้งานบัญชีแล้ว โดยเก็บรายการเดิมไว้ตรวจสอบย้อนหลัง",
      form,
    );
  };

  const submitHoliday = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void run(
      () =>
        employeeReadApi.addWeeklyHoliday(employeeId, {
          weekday: Number(field(data, "weekday")),
          effective_from: field(data, "effective_from"),
          effective_to: field(data, "effective_to") || null,
        }),
      "เพิ่มช่วงวันหยุดแล้ว ประวัติเดิมยังคงอยู่",
      form,
    );
  };

  const submitEndHoliday = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!endHolidayId) return;
    const form = event.currentTarget;
    const to = field(new FormData(form), "effective_to");
    const item = holidays.find((holiday) => holiday.id === endHolidayId);
    if (item && to < item.effective_from) {
      setError("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
      return;
    }
    void run(
      () => employeeReadApi.endWeeklyHoliday(employeeId, endHolidayId, to),
      "สิ้นสุดช่วงวันหยุดแล้ว โดยเก็บรายการเดิมไว้ตรวจสอบย้อนหลัง",
      form,
    );
  };

  return (
    <section className={styles.panel} aria-labelledby="employee-write-heading">
      <h2 id="employee-write-heading">จัดการข้อมูล</h2>
      <p className={styles.muted}>
        การเปลี่ยนแปลงจะบันทึกพร้อม audit trail
        และตรวจสิทธิ์อีกครั้งที่เซิร์ฟเวอร์
      </p>
      {error && (
        <RequestState kind="error" title="บันทึกไม่สำเร็จ" detail={error} />
      )}
      {view === "employment" && (
        <form onSubmit={submitAssignment}>
          <h3>เพิ่มช่วงการจ้างใหม่</h3>
          <p className={styles.muted}>
            ระบบสิ้นสุดช่วงเดิมก่อนวันเริ่มใหม่หนึ่งวัน
          </p>
          {orgLoading ? (
            <RequestState
              kind="loading"
              title="กำลังโหลดโครงสร้างองค์กร"
              detail="กรุณารอสักครู่"
            />
          ) : null}
          {!orgLoading && shops.length === 0 ? (
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => {
                setOrgLoading(true);
                setError("");
                setOrgRetry((value) => value + 1);
              }}
            >
              โหลดตัวเลือกอีกครั้ง
            </button>
          ) : null}
          <div className={styles.formGrid}>
            <Field label="ร้าน">
              <select
                aria-label="ร้าน"
                className={styles.select}
                value={selectedShopId}
                onChange={(event) => {
                  setSelectedShopId(event.target.value);
                  setSelectedBranchId("");
                  setSelectedDepartmentId("");
                  setSelectedPositionId("");
                  setBranches([]);
                  setDepartments([]);
                  setPositions([]);
                  setOrgLoading(Boolean(event.target.value));
                }}
                required
              >
                <option value="">เลือกร้าน</option>
                {shops.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="สาขา">
              <select
                aria-label="สาขา"
                className={styles.select}
                value={selectedBranchId}
                onChange={(event) => {
                  setSelectedBranchId(event.target.value);
                  setSelectedDepartmentId("");
                  setDepartments([]);
                  setOrgLoading(Boolean(event.target.value));
                }}
                disabled={!selectedShopId || orgLoading}
                required
              >
                <option value="">เลือกสาขา</option>
                {branches.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="แผนก">
              <select
                aria-label="แผนก"
                className={styles.select}
                value={selectedDepartmentId}
                onChange={(event) =>
                  setSelectedDepartmentId(event.target.value)
                }
                disabled={!selectedBranchId || orgLoading}
                required
              >
                <option value="">เลือกแผนก</option>
                {departments.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ตำแหน่ง">
              <select
                aria-label="ตำแหน่ง"
                className={styles.select}
                value={selectedPositionId}
                onChange={(event) => setSelectedPositionId(event.target.value)}
                disabled={!selectedShopId || orgLoading}
                required
              >
                <option value="">เลือกตำแหน่ง</option>
                {positions.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ประเภทการจ้าง">
              <select
                aria-label="ประเภทการจ้าง"
                className={styles.select}
                name="employment_type"
                defaultValue={latestAssignment?.employment_type ?? "full_time"}
              >
                <option value="full_time">เต็มเวลา</option>
                <option value="part_time">พาร์ตไทม์</option>
                <option value="temporary">ชั่วคราว</option>
              </select>
            </Field>
            <Field label="เงินเดือนฐาน">
              <input
                aria-label="เงินเดือนฐาน"
                className={styles.input}
                name="base_salary"
                inputMode="decimal"
                pattern="(0|[1-9][0-9]{0,9})([.][0-9]{2})?"
                defaultValue={latestAssignment?.base_salary}
                required
              />
            </Field>
            <Field label="สวัสดิการ">
              <input
                aria-label="สวัสดิการ"
                className={styles.input}
                name="welfare_amount"
                inputMode="decimal"
                pattern="(0|[1-9][0-9]{0,9})([.][0-9]{2})?"
                defaultValue={latestAssignment?.welfare_amount}
                required
              />
            </Field>
            <Field label="มีผลตั้งแต่">
              <input
                aria-label="มีผลตั้งแต่"
                className={styles.input}
                name="effective_from"
                type="date"
                required
              />
            </Field>
            <Field label="สิ้นสุด (ถ้ามี)">
              <input
                aria-label="สิ้นสุดช่วงการจ้าง"
                className={styles.input}
                name="effective_to"
                type="date"
              />
            </Field>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} disabled={busy}>
              บันทึกช่วงใหม่
            </button>
          </div>
        </form>
      )}
      {view === "bank" && (
        <>
          <form onSubmit={submitBank}>
            <h3>เพิ่มบัญชีธนาคาร</h3>
            <div className={styles.formGrid}>
              <Field label="รหัสธนาคาร">
                <input
                  aria-label="รหัสธนาคาร"
                  className={styles.input}
                  name="bank_code"
                  maxLength={20}
                  required
                />
              </Field>
              <Field label="ชื่อธนาคาร">
                <input
                  aria-label="ชื่อธนาคาร"
                  className={styles.input}
                  name="bank_name"
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="ชื่อบัญชี">
                <input
                  aria-label="ชื่อบัญชี"
                  className={styles.input}
                  name="account_holder_name"
                  maxLength={200}
                  required
                />
              </Field>
              <Field label="เลขบัญชีเต็ม">
                <input
                  aria-label="เลขบัญชีเต็ม"
                  className={styles.input}
                  name="account_number"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label="บัญชีหลัก">
                <select
                  aria-label="ตั้งเป็นบัญชีหลัก"
                  className={styles.select}
                  name="is_primary"
                  defaultValue={
                    activeBanks.some((item) => item.is_primary)
                      ? "false"
                      : "true"
                  }
                >
                  <option value="false">ไม่ใช่</option>
                  <option value="true">ใช่</option>
                </select>
              </Field>
            </div>
            <div className={styles.actions}>
              <button className={styles.button} disabled={busy}>
                เพิ่มบัญชี
              </button>
            </div>
          </form>
          {activeBanks.length > 0 && (
            <form onSubmit={submitBankUpdate}>
              <h3>แก้ข้อมูลบัญชี</h3>
              <div className={styles.formGrid}>
                <Field label="บัญชี">
                  <select
                    aria-label="เลือกบัญชีที่จะแก้"
                    className={styles.select}
                    value={selectedBankId}
                    onChange={(event) => setSelectedBankId(event.target.value)}
                    required
                  >
                    <option value="">เลือกบัญชี</option>
                    {activeBanks.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.bank_name} {item.account_number_masked}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="รหัสธนาคาร">
                  <input
                    aria-label="รหัสธนาคารใหม่"
                    className={styles.input}
                    name="bank_code"
                    maxLength={20}
                    defaultValue={
                      activeBanks.find((item) => item.id === selectedBankId)
                        ?.bank_code ?? ""
                    }
                    required
                    key={selectedBankId + "-code"}
                  />
                </Field>
                <Field label="ชื่อธนาคาร">
                  <input
                    aria-label="ชื่อธนาคารใหม่"
                    className={styles.input}
                    name="bank_name"
                    maxLength={100}
                    defaultValue={
                      activeBanks.find((item) => item.id === selectedBankId)
                        ?.bank_name ?? ""
                    }
                    required
                    key={selectedBankId + "-name"}
                  />
                </Field>
                <Field label="ชื่อบัญชี">
                  <input
                    aria-label="ชื่อบัญชีใหม่"
                    className={styles.input}
                    name="account_holder_name"
                    maxLength={200}
                    defaultValue={
                      activeBanks.find((item) => item.id === selectedBankId)
                        ?.account_holder_name ?? ""
                    }
                    required
                    key={selectedBankId + "-holder"}
                  />
                </Field>
                <Field label="เลขบัญชีใหม่ (ถ้าเปลี่ยน)">
                  <input
                    aria-label="เลขบัญชีใหม่ ถ้าเปลี่ยน"
                    className={styles.input}
                    name="account_number"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </Field>
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.button}
                  disabled={busy || !selectedBankId}
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          )}
          {activeBanks
            .filter((item) => !item.is_primary)
            .map((item) => (
              <div className={styles.actions} key={item.id}>
                <span>
                  {item.bank_name} {item.account_number_masked}
                </span>
                <button
                  className={styles.buttonSecondary}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        employeeReadApi.makePrimaryBankAccount(
                          employeeId,
                          item.id,
                        ),
                      "ตั้งบัญชีหลักแล้ว",
                    )
                  }
                >
                  ตั้งเป็นบัญชีหลัก
                </button>
              </div>
            ))}
          {activeBanks.length > 0 && (
            <form onSubmit={submitDeactivate}>
              <h3>ปิดใช้งานบัญชี</h3>
              <p className={styles.muted}>
                กรุณายืนยันบัญชีที่ต้องการปิด หากเป็นบัญชีหลักให้เลือกบัญชีทดแทน
                หรือยืนยันว่าจะยังไม่มีบัญชีหลัก
              </p>
              <div className={styles.formGrid}>
                <Field label="บัญชีที่จะปิด">
                  <select
                    aria-label="บัญชีที่จะปิด"
                    className={styles.select}
                    value={deactivateBankId}
                    onChange={(event) =>
                      setDeactivateBankId(event.target.value)
                    }
                    required
                  >
                    <option value="">เลือกบัญชี</option>
                    {activeBanks.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.bank_name} {item.account_number_masked}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="บัญชีหลักทดแทน">
                  <select
                    aria-label="บัญชีหลักทดแทน"
                    className={styles.select}
                    name="replacement_bank_account_id"
                    defaultValue=""
                    key={deactivateBankId}
                  >
                    <option value="">ไม่มีบัญชีทดแทน</option>
                    {activeBanks
                      .filter((item) => item.id !== deactivateBankId)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.bank_name} {item.account_number_masked}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.button}
                  disabled={busy || !deactivateBankId}
                >
                  ยืนยันปิดใช้งาน
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {view === "weekly-holidays" && (
        <>
          <form onSubmit={submitHoliday}>
            <h3>เพิ่มช่วงวันหยุด</h3>
            <p className={styles.muted}>
              ช่วงเดิมของวันเดียวกันจะสิ้นสุดก่อนวันเริ่มใหม่
            </p>
            <div className={styles.formGrid}>
              <Field label="วันหยุด">
                <select
                  aria-label="วันหยุด"
                  className={styles.select}
                  name="weekday"
                >
                  {weekdays.map((label, index) => (
                    <option key={label} value={index}>
                      วัน{label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="มีผลตั้งแต่">
                <input
                  aria-label="วันเริ่มต้นวันหยุด"
                  className={styles.input}
                  name="effective_from"
                  type="date"
                  required
                />
              </Field>
              <Field label="สิ้นสุด (ถ้ามี)">
                <input
                  aria-label="วันสิ้นสุดวันหยุด"
                  className={styles.input}
                  name="effective_to"
                  type="date"
                />
              </Field>
            </div>
            <div className={styles.actions}>
              <button className={styles.button} disabled={busy}>
                บันทึกช่วงใหม่
              </button>
            </div>
          </form>
          {holidays.some((item) => item.effective_to === null) && (
            <form onSubmit={submitEndHoliday}>
              <h3>สิ้นสุดช่วงวันหยุด</h3>
              <div className={styles.formGrid}>
                <Field label="ช่วงที่ใช้อยู่">
                  <select
                    aria-label="ช่วงวันหยุดที่จะสิ้นสุด"
                    className={styles.select}
                    value={endHolidayId}
                    onChange={(event) => setEndHolidayId(event.target.value)}
                    required
                  >
                    <option value="">เลือกช่วง</option>
                    {holidays
                      .filter((item) => item.effective_to === null)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          วัน{weekdays[item.weekday]} เริ่ม{" "}
                          {item.effective_from}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="สิ้นสุดวันที่">
                  <input
                    aria-label="วันสิ้นสุดช่วงวันหยุด"
                    className={styles.input}
                    name="effective_to"
                    type="date"
                    required
                  />
                </Field>
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.button}
                  disabled={busy || !endHolidayId}
                >
                  ยืนยันสิ้นสุดช่วง
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
