import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "スマイル勤怠",
  description: "中小企業向け勤怠管理アプリ"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
