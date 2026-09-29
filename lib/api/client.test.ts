import { describe, expect, test } from "bun:test";
import {
  ApiClientError,
  apiRequest,
  apiRequestEnvelope,
  apiRequestPage,
} from "./client";

const fetcher = (body: unknown, status = 200) =>
  (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    )) as typeof fetch;

describe("apiRequest", () => {
  test("returns data from a success envelope", async () => {
    await expect(
      apiRequest<{ id: number }>("/employees/7", {
        fetcher: fetcher({ ok: true, data: { id: 7 } }),
      }),
    ).resolves.toEqual({ id: 7 });
  });

  test("raises the public API error", async () => {
    const request = apiRequest("/payroll", {
      fetcher: fetcher(
        { ok: false, error: { code: "FORBIDDEN", message: "ไม่อนุญาต" } },
        403,
      ),
    });

    await expect(request).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "ไม่อนุญาต",
      status: 403,
    });
  });

  test("translates known API error codes for the interface", async () => {
    await expect(
      apiRequest("/operations/leave-requests", {
        fetcher: fetcher(
          { ok: false, error: { code: "PAYROLL_PERIOD_LOCKED", message: "The payroll period is locked." } },
          409,
        ),
      }),
    ).rejects.toMatchObject({
      code: "PAYROLL_PERIOD_LOCKED",
      message: "รอบเงินเดือนถูกล็อกแล้ว จึงแก้ไขไม่ได้",
    });
  });

  test("keeps a safe Thai detail for a known API error code", async () => {
    await expect(
      apiRequest("/operations/leave-requests", {
        fetcher: fetcher(
          { ok: false, error: { code: "STATE_CONFLICT", message: "ช่วงวันที่ลาซ้อนกับคำขอเดิม" } },
          409,
        ),
      }),
    ).rejects.toMatchObject({
      code: "STATE_CONFLICT",
      message: "ช่วงวันที่ลาซ้อนกับคำขอเดิม",
    });
  });

  test("does not expose an unknown English API error", async () => {
    await expect(
      apiRequest("/operations/unknown", {
        fetcher: fetcher({ ok: false, error: { code: "UNEXPECTED", message: "Internal implementation detail" } }, 500),
      }),
    ).rejects.toMatchObject({ message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง" });
  });

  test("returns request correlation from the backend envelope", async () => {
    await expect(
      apiRequestEnvelope<{ id: string }>("/v1/payroll/periods/1", {
        fetcher: fetcher({ data: { id: "1" }, request_id: "request-1" }),
      }),
    ).resolves.toEqual({ data: { id: "1" }, requestId: "request-1" });
  });

  test("preserves backend pagination metadata for scoped lists", async () => {
    await expect(
      apiRequestPage<{ id: string }>("/v1/employees?page=2", {
        fetcher: fetcher({
          data: [{ id: "21" }],
          page: 2,
          page_size: 20,
          total: 21,
          request_id: "request-2",
        }),
      }),
    ).resolves.toEqual({
      data: [{ id: "21" }],
      page: 2,
      page_size: 20,
      total: 21,
      request_id: "request-2",
    });
  });

  test("rejects a list response without pagination metadata", async () => {
    await expect(
      apiRequestPage("/v1/employees", {
        fetcher: fetcher({ data: [], request_id: "request-3" }),
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  test("rejects malformed bodies", async () => {
    await expect(
      apiRequest("/broken", {
        fetcher: fetcher({ data: "missing discriminator" }),
      }),
    ).rejects.toBeInstanceOf(ApiClientError);
  });

  test("normalizes network failures", async () => {
    const failingFetch = (() =>
      Promise.reject(new Error("offline"))) as typeof fetch;

    await expect(
      apiRequest("/health", { fetcher: failingFetch }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });
});
