export const configurationOptions = {
  STANDARD_WORK_DAYS: { label: "จำนวนวันทำงานมาตรฐาน", unit: "days", unitLabel: "วัน", example: "เช่น 26 วัน ใช้หารเงินเดือนฐานเพื่อหาค่าแรงรายวัน", placeholder: "26", step: "0.01", min: "0.01", max: "31" },
  ABSENCE_RATE: { label: "อัตราหักเมื่อขาดงาน", unit: "multiplier", unitLabel: "เท่าของค่าแรงรายวัน", example: "เช่น 1 เท่า หมายถึงหักเท่ากับค่าแรงรายวัน", placeholder: "1", step: "0.0001", min: "0", max: undefined },
  LATE_RATE: { label: "อัตราหักเมื่อมาสาย", unit: "currency_per_minute", unitLabel: "บาทต่อนาที", example: "เช่น 2 บาทต่อนาที มาสาย 10 นาที หัก 20 บาท", placeholder: "2", step: "0.0001", min: "0", max: undefined },
  OT_HOURLY_RATE: { label: "อัตรา OT รายชั่วโมง", unit: "multiplier", unitLabel: "เท่าของค่าแรงรายชั่วโมง", example: "เช่น 1.5 เท่าของค่าแรงรายชั่วโมง", placeholder: "1.5", step: "0.0001", min: "0", max: undefined },
  OT_REST_DAY_RATE: { label: "อัตรา OT วันหยุดประจำสัปดาห์", unit: "multiplier", unitLabel: "เท่าของค่าแรงรายวัน", example: "เช่น 1 เท่าของค่าแรงรายวัน", placeholder: "1", step: "0.0001", min: "0", max: undefined },
  OT_PUBLIC_HOLIDAY_RATE: { label: "อัตรา OT วันหยุดนักขัตฤกษ์", unit: "multiplier", unitLabel: "เท่าของค่าแรงรายวัน", example: "เช่น 2 เท่าของค่าแรงรายวัน", placeholder: "2", step: "0.0001", min: "0", max: undefined },
  SOCIAL_SECURITY_RATE: { label: "อัตราประกันสังคม", unit: "ratio", unitLabel: "%", example: "เช่น กรอก 5 สำหรับอัตรา 5% ของฐานค่าจ้างที่ใช้คำนวณ", placeholder: "5", step: "0.01", min: "0", max: "100" },
  SOCIAL_SECURITY_CAP: { label: "เพดานหักประกันสังคม", unit: "currency", unitLabel: "บาท", example: "เช่น 750 บาท เป็นยอดหักสูงสุดต่อรอบ", placeholder: "750", step: "0.01", min: "0", max: undefined },
} as const;
export type ConfigurationKey = keyof typeof configurationOptions;
