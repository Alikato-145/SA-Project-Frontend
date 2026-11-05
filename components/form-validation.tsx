"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const isField = (target: EventTarget | null): target is Field =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLSelectElement ||
  target instanceof HTMLTextAreaElement;

export const personName = {
  pattern: String.raw`\s*\p{L}[\p{L}\p{M} .'’\-]*`,
  title: "กรอกเฉพาะตัวอักษรสำหรับชื่อ ใช้เว้นวรรคหรือขีดกลางได้",
};

export const nationalId = {
  pattern: "[0-9]{13}",
  inputMode: "numeric",
  title: "กรอกเลขบัตรประชาชน 13 หลัก",
} as const;

export const passportId = {
  pattern: "[A-Za-z0-9]+",
  title: "กรอกเลขหนังสือเดินทางด้วยตัวอักษรอังกฤษหรือตัวเลข",
};

export const bankAccountNumber = {
  pattern: "[0-9]{6,34}",
  inputMode: "numeric",
  maxLength: 34,
  title: "กรอกเลขบัญชีเป็นตัวเลข 6–34 หลัก",
} as const;

export const usernameFormat = {
  pattern: String.raw`[A-Za-z0-9._\-]{3,100}`,
  title: "ใช้ตัวอักษรอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง 3–100 ตัว",
};

function check(field: Field): string {
  field.setCustomValidity("");
  if (!field.willValidate) return "";

  const { validity, value } = field;
  if (validity.badInput) return field.type === "number" ? "กรอกเป็นตัวเลข" : "กรอกข้อมูลให้ครบตามรูปแบบ";
  if (validity.valueMissing || (field.required && field.type === "text" && !value.trim()) ||
      (field instanceof HTMLTextAreaElement && field.required && !value.trim())) return "กรุณากรอกข้อมูลช่องนี้";
  if (validity.typeMismatch) return field.type === "email" ? "กรอกอีเมลในรูปแบบ name@example.com" : "รูปแบบข้อมูลไม่ถูกต้อง";
  if (validity.patternMismatch) return field.title || "กรอกข้อมูลให้ตรงตามรูปแบบของช่องนี้";

  if (field instanceof HTMLInputElement) {
    if (value && field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return "กรอกวันที่โดยใช้ปี ค.ศ. 4 หลัก";
    }
    if (field.type === "number" && value) {
      const decimals = field.step === "any" ? null : (field.step.split(".")[1]?.length ?? 0);
      if (!/^-?\d+(?:\.\d+)?$/.test(value)) return "กรอกเป็นตัวเลข เช่น 100 หรือ 100.50";
      if (decimals !== null && (value.split(".")[1]?.length ?? 0) > decimals) {
        return decimals ? `กรอกทศนิยมได้ไม่เกิน ${decimals} ตำแหน่ง` : "กรอกเป็นจำนวนเต็ม";
      }
    }
    if (validity.rangeUnderflow) return `ค่าต้องไม่น้อยกว่า ${field.min}`;
    if (validity.rangeOverflow) return `ค่าต้องไม่เกิน ${field.max}`;
    if (validity.stepMismatch) return "กรอกตัวเลขตามช่วงที่กำหนด";

    if (field.type === "file" && field.accept) {
      const file = field.files?.[0];
      if (file && !field.accept.split(",").includes(file.type)) return "เลือกไฟล์ PDF, PNG หรือ JPEG";
      if (file && (file.size === 0 || file.size > 5 * 1024 * 1024)) return "ไฟล์ต้องมีข้อมูลและขนาดไม่เกิน 5 MB";
    }
    const start = field.dataset.notBefore && field.form?.elements.namedItem(field.dataset.notBefore);
    if (start instanceof HTMLInputElement && start.value && value && value < start.value) {
      return "วันที่สิ้นสุดต้องตรงกับหรืออยู่หลังวันที่เริ่มต้น";
    }
  }
  if (validity.tooShort) return `กรอกอย่างน้อย ${(field as HTMLInputElement).minLength} ตัวอักษร`;
  if (validity.tooLong) return `กรอกได้ไม่เกิน ${(field as HTMLInputElement).maxLength} ตัวอักษร`;
  return "";
}

function fieldLabel(field: Field) {
  const label = field.labels?.[0];
  const text = Array.from(label?.childNodes ?? [])
    .find(node => node.nodeType === 3 && node.textContent?.trim())?.textContent;
  return field.getAttribute("aria-label") || text?.trim() || label?.querySelector(":scope > span")?.textContent?.trim();
}

export function FormValidation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [feedback, setFeedback] = useState<{ field: Field; pathname: string; message: string }>();

  const validate = (field: Field) => {
    const message = check(field);
    if (message && field.validity.valid) field.setCustomValidity(message);
    if (message) {
      field.setAttribute("aria-invalid", "true");
      const label = fieldLabel(field);
      setFeedback({ field, pathname, message: label ? `${label} — ${message}` : message });
    } else {
      field.removeAttribute("aria-invalid");
      setFeedback(current => current?.field === field ? undefined : current);
    }
    return message;
  };

  const submit = (event: FormEvent) => {
    if (!(event.target instanceof HTMLFormElement)) return;
    for (const field of Array.from(event.target.elements)) {
      if (isField(field) && validate(field)) {
        event.preventDefault();
        event.stopPropagation();
        field.reportValidity();
        return;
      }
    }
    setFeedback(undefined);
  };

  const visibleFeedback = feedback?.pathname === pathname && feedback.field.isConnected ? feedback : null;
  const inlineLabel = pathname === "/payroll" ? visibleFeedback?.field.labels?.[0] : null;

  return (
    <div
      className="contents"
      onInputCapture={event => {
        if (!isField(event.target)) return;
        const field = event.target;
        if (field.getAttribute("aria-invalid") === "true") validate(field);
        if (field.type === "date" && field.form) {
          for (const dependent of field.form.querySelectorAll<HTMLInputElement>("[data-not-before]")) {
            if (dependent.dataset.notBefore === field.name && dependent.getAttribute("aria-invalid") === "true") validate(dependent);
          }
        }
      }}
      onBlurCapture={event => {
        if (isField(event.target) && event.target.form && (event.target.value || event.target.validity.badInput)) validate(event.target);
      }}
      onInvalidCapture={event => {
        if (!isField(event.target)) return;
        const firstInvalid = event.target.form?.querySelector("input:invalid, select:invalid, textarea:invalid");
        if (!firstInvalid || firstInvalid === event.target) validate(event.target);
      }}
      onSubmitCapture={submit}
    >
      {children}
      {visibleFeedback && (inlineLabel ? <>
        {createPortal(<span aria-hidden="true" className="mt-2 block text-sm text-red-800">{visibleFeedback.message}</span>, inlineLabel)}
        <p role="alert" className="sr-only">{visibleFeedback.message}</p>
      </> : <p role="alert" className="fixed right-4 bottom-4 left-4 z-50 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900 shadow-md sm:left-auto">
        {visibleFeedback.message}
      </p>)}
    </div>
  );
}
