import { ApiClientError, localizeApiError } from "./client";

export const downloadApiFile = async (path: string, filename: string) => {
  const response = await fetch(`/api${path}`, { credentials: "same-origin" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const code = body?.error?.code ?? "INVALID_RESPONSE";
    throw new ApiClientError(code, localizeApiError(code, body?.error?.message ?? "ดาวน์โหลดไม่สำเร็จ"), response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
