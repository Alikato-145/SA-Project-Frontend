import type { FullConfig } from "@playwright/test";
export default async function setup(config: FullConfig) {
  const base = config.projects[0]!.use.baseURL!;
  const response = await fetch(`${base}/api/v1/auth/me`);
  if (response.status !== 401) throw new Error(`Verification backend is not ready: auth endpoint HTTP ${response.status}. Run sh scripts/verify.sh first.`);
}
