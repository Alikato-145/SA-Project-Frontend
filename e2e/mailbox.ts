import type { APIRequestContext } from "@playwright/test";

export const createMailbox = (request: Pick<APIRequestContext, "get">) => {
  const base = `http://localhost:${process.env.VERIFY_MAIL_PORT || "18025"}`;
  return {
    messages: () => request.get(`${base}/api/v1/messages?limit=100`),
    message: (id: string) => request.get(`${base}/api/v1/message/${id}`),
    attachment: (id: string, part: string) => request.get(`${base}/api/v1/message/${id}/part/${part}`),
  };
};
