export type ApiSuccess<T> = { ok: true; data: T };
export type ApiEnvelope<T> = { data: T; request_id?: string };
export type ApiErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type RequestOptions = RequestInit & {
  baseUrl?: string;
  fetcher?: typeof fetch;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isErrorBody = (value: unknown): value is ApiErrorBody =>
  isRecord(value) &&
  value.ok === false &&
  isRecord(value.error) &&
  typeof value.error.code === "string" &&
  typeof value.error.message === "string";

const isErrorEnvelope = (value: unknown): value is { error: ApiErrorBody["error"] } =>
  isRecord(value) && isRecord(value.error) &&
  typeof value.error.code === "string" && typeof value.error.message === "string";

const isSuccessBody = <T>(value: unknown): value is ApiSuccess<T> =>
  isRecord(value) && value.ok === true && "data" in value;

const isEnvelopeBody = <T>(value: unknown): value is ApiEnvelope<T> =>
  isRecord(value) && "data" in value &&
  typeof value.request_id === "string";

export async function apiRequestEnvelope<T>(
  path: string,
  { baseUrl = "/api", fetcher = fetch, ...init }: RequestOptions = {},
): Promise<{ data: T; requestId: string | null }> {
  let response: Response;

  try {
    response = await fetcher(`${baseUrl}${path}`, init);
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError(
      error instanceof DOMException && error.name === "AbortError"
        ? "REQUEST_ABORTED"
        : "NETWORK_ERROR",
      "ไม่สามารถเชื่อมต่อกับระบบได้",
      0,
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(await response.text());
  } catch {
    throw new ApiClientError(
      "INVALID_RESPONSE",
      "ระบบตอบกลับในรูปแบบที่ไม่ถูกต้อง",
      response.status,
    );
  }

  if (response.ok && isSuccessBody<T>(body)) return { data: body.data, requestId: null };
  if (response.ok && isEnvelopeBody<T>(body)) {
    return { data: body.data, requestId: body.request_id ?? null };
  }

  if (isErrorBody(body) || isErrorEnvelope(body)) {
    throw new ApiClientError(
      body.error.code,
      body.error.message,
      response.status,
      body.error.details,
    );
  }

  throw new ApiClientError(
    "INVALID_RESPONSE",
    "ระบบตอบกลับในรูปแบบที่ไม่ถูกต้อง",
    response.status,
  );
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiRequestEnvelope<T>(path, options)).data;
}
