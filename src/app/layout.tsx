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
        {/*
          THESIS: Rashod is a command-strip duty desk. Counts first, people next. Refuses empty luxury space and ornamental glass.
          OWN-WORLD: Deep indigo night, opaque panels, hairline rules. Orchid only on selected total and primary action. Cyan on focus and active nav. Geist. 42px controls. Large mono counts on command chips.
          STORY: Duty officer scans location counts, filters the list, assigns a person without leaving the roster.
          FIRST VIEWPORT: 64px top bar, full-width location command strip, left sidebar, dense roster rows, search under the strip.
          FORM: Category canon, composition A command strip. Seed 1fe8e38b. Craft bar Linear / Stripe Dashboard / Height.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
        */}
        {children}
      </body>
    </html>
  );
}