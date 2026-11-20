import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
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

const SCALES = [90, 100, 112, 125, 140];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Persönliche Schriftgröße (Mein Konto) – skaliert alle rem-Größen der Oberfläche
  const raw = Number((await cookies()).get("schrift")?.value);
  const scale = SCALES.includes(raw) ? raw : 100;
  return (
    <html lang="de" className={`${plex.variable} h-full antialiased`} style={scale !== 100 ? { fontSize: `${scale}%` } : undefined}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
