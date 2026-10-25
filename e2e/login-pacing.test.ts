import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { paceLogin } from "./login-pacing";

test("successful-login pacing is shared across callers and persists across helper instances", async () => {
  const directory = mkdtempSync(join(tmpdir(), "haris-login-"));
  const file = join(directory, "last-login");
  try {
    await paceLogin(file, 50);
    const started = Date.now();
    await paceLogin(file, 50);
    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
  } finally { rmSync(directory, { recursive: true }); }
});
