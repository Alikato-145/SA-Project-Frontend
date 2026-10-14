import { defineConfig } from "@playwright/test";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:18083";
const target = new URL(baseURL);
if (!["localhost", "127.0.0.1"].includes(target.hostname) || !target.port || ["80", "3000"].includes(target.port)) throw new Error("E2E must target an isolated localhost verification stack.");
export default defineConfig({ testDir: "./e2e", testMatch: process.env.PENDING_DELIVERY_FIXTURE_FILE ? "**/operator.check.ts" : process.env.RESTORED_PAYSLIP_ID ? "**/restore.check.ts" : "**/*.e2e.ts", globalSetup: "./e2e/global-setup.ts", workers: 1, retries: 0,
  timeout: 60000, expect: { timeout: 15000 }, reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, browserName: "chromium", viewport: { width: 1280, height: 900 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
});
