import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// Sachliche, gut lesbare Schrift mit gleich breiten Ziffern (Uhrzeiten, Nummern)
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "Praxisverwaltung", template: "%s · Praxisverwaltung" },
  description: "Terminplanung, Störungsmanagement und Patientenakte für Arztpraxen",
  applicationName: "Praxisverwaltung",
};

export const viewport: Viewport = { themeColor: "#34495f" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${plex.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
