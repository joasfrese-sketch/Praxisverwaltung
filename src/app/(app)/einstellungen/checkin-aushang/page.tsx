import { headers } from "next/headers";
import { requireAdmin } from "@/lib/context";
import { qrSvg } from "@/lib/qr";
import { PrintButton } from "./print-button";

export const metadata = { title: "Aushang Selbst-Check-in" };

/** Druckvorlage (A4) für Eingang/Empfang: QR-Code zum Selbst-Anmelden. */
export default async function Aushang() {
  const { practice } = await requireAdmin();
  const h = await headers();
  const url = `${process.env.APP_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`}/checkin/${practice.checkin_token}`;
  const svg = await qrSvg(url);
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 print:hidden">
        <PrintButton />
        <span className="text-sm text-slate-500">Tipp: im Druckdialog „Kopf- und Fußzeilen“ ausschalten.</span>
      </div>
      <article className="mx-auto max-w-[180mm] rounded-lg bg-white p-10 text-center text-slate-900 shadow print:max-w-none print:p-0 print:shadow-none">
        <p className="text-xl text-slate-500">{practice.name}</p>
        <h1 className="mt-3 text-5xl font-semibold">Selbst anmelden</h1>
        <p className="mt-4 text-2xl">Sie haben heute einen Termin? Scannen Sie den Code mit Ihrem Handy.</p>
        <div className="mx-auto mt-8 w-[110mm] max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <ol className="mx-auto mt-8 max-w-md space-y-2 text-left text-xl">
          <li>1. Code scannen</li>
          <li>2. Nachname und Geburtsdatum eingeben</li>
          <li>3. Aufrufnummer merken und im Wartezimmer Platz nehmen</li>
        </ol>
        <p className="mt-8 text-lg text-slate-500">Kein Handy dabei? Bitte melden Sie sich am Empfang.</p>
      </article>
    </div>
  );
}
