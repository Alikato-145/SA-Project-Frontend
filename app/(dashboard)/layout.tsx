import { DashboardAccessGuard } from "@/components/dashboard-access-guard";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardAccessGuard>{children}</DashboardAccessGuard>;
}
