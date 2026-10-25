import { existsSync, readFileSync, writeFileSync } from "node:fs";

// One worker, including API setup and additional contexts; keep nginx's 10/minute limit.
// A file also preserves pacing when Playwright replaces a worker after a failure.
export async function paceLogin(file = process.env.E2E_LOGIN_PACING_FILE ?? "/tmp/haris-e2e-last-login", interval = 6200) {
  const last = existsSync(file) ? Number(readFileSync(file, "utf8")) : 0;
  const delay = Math.max(0, last + interval - Date.now());
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  writeFileSync(file, String(Date.now()));
}
