import { describe, expect, test } from "bun:test";
import { ApiClientError, apiRequest, apiRequestEnvelope } from "./client";

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

  test("returns request correlation from the backend envelope", async () => {
    await expect(apiRequestEnvelope<{ id: string }>("/v1/payroll/periods/1", {
      fetcher: fetcher({ data: { id: "1" }, request_id: "request-1" }),
    })).resolves.toEqual({ data: { id: "1" }, requestId: "request-1" });
  });

  test("rejects malformed bodies", async () => {
    await expect(
      apiRequest("/broken", { fetcher: fetcher({ data: "missing discriminator" }) }),
    ).rejects.toBeInstanceOf(ApiClientError);
  });

  test("normalizes network failures", async () => {
    const failingFetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;

    await expect(
      apiRequest("/health", { fetcher: failingFetch }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });
});
