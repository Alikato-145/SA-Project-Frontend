import { ApplicationShell } from "@/components/application-shell";

export default function PayrollLayout({ children }: LayoutProps<"/payroll">) {
  return <ApplicationShell>{children}</ApplicationShell>;
}
