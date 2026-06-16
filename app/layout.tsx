import type { Metadata, Viewport } from "next";
import "./globals.css";

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
      {/* Блокируем браузерный зум страницы до гидрации React */}
      <script dangerouslySetInnerHTML={{ __html: `
document.addEventListener('gesturestart',function(e){e.preventDefault();},{passive:false});
document.addEventListener('gesturechange',function(e){e.preventDefault();},{passive:false});
document.addEventListener('touchmove',function(e){if(e.touches.length>1)e.preventDefault();},{passive:false});
`.trim() }} />
      <body className="h-full bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
