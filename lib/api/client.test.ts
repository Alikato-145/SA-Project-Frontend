import { describe, expect, test } from "bun:test";
import { ApiClientError, apiRequest } from "./client";

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
