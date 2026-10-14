import { defineConfig } from "@playwright/test";
const baseURL = process.env.PRODUCTION_REHEARSAL_URL ?? "https://localhost:18443";
const target = new URL(baseURL);
if (target.protocol !== "https:" || !["localhost", "127.0.0.1"].includes(target.hostname) || !target.port) throw new Error("Production rehearsal must use an isolated localhost TLS stack.");
export default defineConfig({ testDir: "./e2e", testMatch: "**/production-rehearsal.check.ts", workers: 1, retries: 0,
  outputDir: "test-results-production", reporter: [["list"], ["html", { outputFolder: "playwright-report-production", open: "never" }]],
  use: { baseURL, ignoreHTTPSErrors: true, screenshot: "only-on-failure", trace: "retain-on-failure" } });
