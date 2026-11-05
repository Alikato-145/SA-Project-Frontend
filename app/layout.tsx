import type { Metadata } from "next";
import { FormValidation } from "@/components/form-validation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haris Payroll",
  description: "ระบบจัดการพนักงานและเงินเดือน Haris",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full"><FormValidation>{children}</FormValidation></body>
    </html>
  );
}
