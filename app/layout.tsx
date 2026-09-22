import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haris Payroll",
  description: "ระบบจัดการพนักงานและเงินเดือน Haris",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
