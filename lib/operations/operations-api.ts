import { apiRequest } from "../api/client";

export const operationsApi = {
  request<T>(path: string, init: RequestInit = {}) {
    return apiRequest<T>(`/v1/operations${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...init.headers },
    });
  },
};
