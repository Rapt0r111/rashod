import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Расход личного состава",
  description: "Оперативный учет местонахождения личного состава",
  applicationName: "Расход личного состава",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090814",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-full overflow-hidden bg-bg-base text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}