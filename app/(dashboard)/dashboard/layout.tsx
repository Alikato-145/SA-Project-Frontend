import { ApplicationShell } from "@/components/application-shell";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <ApplicationShell>{children}</ApplicationShell>;
}
