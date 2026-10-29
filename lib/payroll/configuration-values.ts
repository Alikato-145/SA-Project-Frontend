const trimDecimal = (value: string) => value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

/** Translate the percentage shown to people into the exact ratio stored by the API. */
export function fromConfigurationInput(key: string, input: string): string {
  if (key !== "SOCIAL_SECURITY_RATE") return input;
  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) throw new Error("กรอกเปอร์เซ็นต์ตั้งแต่ 0 ถึง 100 โดยมีทศนิยมไม่เกิน 2 ตำแหน่ง");
  const [whole, fraction = ""] = input.split(".");
  const hundredths = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (hundredths > 10000) throw new Error("เปอร์เซ็นต์ต้องอยู่ระหว่าง 0 ถึง 100");
  return trimDecimal(`${Math.floor(hundredths / 10000)}.${String(hundredths % 10000).padStart(4, "0")}`);
}

export function toConfigurationInput(key: string, value: string): string {
  if (key !== "SOCIAL_SECURITY_RATE") return trimDecimal(value);
  if (!/^\d+(?:\.\d{1,4})?$/.test(value)) return value;
  const [whole, fraction = ""] = value.split(".");
  const scaled = Number(whole) * 10000 + Number(fraction.padEnd(4, "0"));
  return trimDecimal(`${Math.floor(scaled / 100)}.${String(scaled % 100).padStart(2, "0")}`);
}
