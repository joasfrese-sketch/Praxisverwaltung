import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Praxisverwaltung", template: "%s · Praxisverwaltung" },
  description: "Terminplanung, Störungsmanagement und Patientenakte für Arztpraxen",
  applicationName: "Praxisverwaltung",
};

export const viewport: Viewport = { themeColor: "#3f5876" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
