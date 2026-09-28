import { ApplicationShell } from "@/components/application-shell";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return <ApplicationShell>{children}</ApplicationShell>;
}
