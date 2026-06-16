import type { Metadata, Viewport } from "next";
import "./globals.css";
import ZoomGuard from "@/components/ZoomGuard";

export const metadata: Metadata = {
  title: "PDF Просмотрщик",
  description: "Просмотр и хранение PDF-файлов с разделённым экраном",
};

export const viewport: Viewport = {
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="h-full bg-slate-50 text-slate-900 antialiased">
        <ZoomGuard />
        {children}
      </body>
    </html>
  );
}
