import { expect, test } from "bun:test";
import type { APIRequestContext } from "@playwright/test";
import { createMailbox } from "./mailbox";

for (const [port, origin] of [[undefined, "http://localhost:18025"], ["18026", "http://localhost:18026"]] as const) {
  test(`actual mailbox consumers use ${port ?? "default 18025"}`, async () => {
    const previous = process.env.VERIFY_MAIL_PORT;
    const urls: string[] = [];
    try {
      if (port === undefined) delete process.env.VERIFY_MAIL_PORT;
      else process.env.VERIFY_MAIL_PORT = port;
      const mailbox = createMailbox({ get: async (url: string) => { urls.push(url); return {} as never; } } as Pick<APIRequestContext, "get">);
      await mailbox.messages();
      await mailbox.message("local-message");
      await mailbox.attachment("local-message", "1.2");
      expect(urls).toEqual([
        `${origin}/api/v1/messages?limit=100`,
        `${origin}/api/v1/message/local-message`,
        `${origin}/api/v1/message/local-message/part/1.2`,
      ]);
    } finally {
      if (previous === undefined) delete process.env.VERIFY_MAIL_PORT;
      else process.env.VERIFY_MAIL_PORT = previous;
    }
  });
}
