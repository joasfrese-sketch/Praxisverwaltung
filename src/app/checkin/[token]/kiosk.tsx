"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Clock, UserRoundX } from "lucide-react";
import { selfCheckIn, type CheckinResult } from "@/app/actions/checkin";

const RESET_SECONDS = 15;

/** Selbst-Check-in: große, berührungsfreundliche Eingabe für Tablet am Empfang oder Handy (QR-Code). */
export function Kiosk({ token, practice, enabled }: { token: string; practice: string; enabled: boolean }) {
  const [name, setName] = useState("");
  const [d, setD] = useState("");
  const [m, setM] = useState("");
  const [y, setY] = useState("");
  const [res, setRes] = useState<CheckinResult | null>(null);
  const [pending, start] = useTransition();
  const mRef = useRef<HTMLInputElement>(null);
  const yRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const reset = () => { setName(""); setD(""); setM(""); setY(""); setRes(null); nameRef.current?.focus(); };

  // Nach dem Ergebnis automatisch zurück zur Eingabe (für das nächste Familienmitglied / den nächsten Patienten)
  useEffect(() => {
    if (!res || res.result === "eingabe") return;
    const t = setTimeout(reset, RESET_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [res]);

  const digits = (v: string, n: number) => v.replace(/\D/g, "").slice(0, n);

  if (!enabled) {
    return (
      <Screen practice={practice}>
        <p className="text-center text-2xl">Die Selbst-Anmeldung ist gerade nicht aktiv.<br />Bitte melden Sie sich am Empfang.</p>
      </Screen>
    );
  }

  if (res && res.result !== "eingabe") {
    return (
      <Screen practice={practice}>
        <div className="mx-auto max-w-xl text-center">
          {res.result === "ok" || res.result === "bereits" ? (
            <>
              <CheckCircle2 className="mx-auto h-20 w-20 text-emerald-500" />
              <h2 className="mt-4 text-3xl font-semibold">{res.result === "ok" ? "Sie sind angemeldet." : "Sie sind bereits angemeldet."}</h2>
              <p className="mt-6 text-xl text-brand-200">Ihre Nummer</p>
              <p className="text-8xl font-bold tabular-nums">{res.ticket}</p>
              <p className="mt-6 text-xl">Bitte nehmen Sie im Wartezimmer Platz.<br />Ihre Nummer und Ihr Raum erscheinen auf dem Bildschirm.</p>
              <p className="mt-2 text-brand-300">Termin um {res.time} Uhr</p>
            </>
          ) : res.result === "zu_frueh" ? (
            <>
              <Clock className="mx-auto h-20 w-20 text-amber-400" />
              <h2 className="mt-4 text-3xl font-semibold">Ihr Termin ist erst um {res.time} Uhr.</h2>
              <p className="mt-4 text-xl">Sie können sich ab {res.ab} Uhr anmelden – oder gern am Empfang.</p>
            </>
          ) : (
            <>
              <UserRoundX className="mx-auto h-20 w-20 text-rose-300" />
              <h2 className="mt-4 text-3xl font-semibold">{res.result === "gesperrt" ? "Bitte melden Sie sich am Empfang." : "Wir haben keinen Termin für heute gefunden."}</h2>
              <p className="mt-4 text-xl">{res.result === "gesperrt" ? "Die Selbst-Anmeldung ist kurz pausiert." : "Bitte prüfen Sie die Eingabe oder melden Sie sich am Empfang."}</p>
            </>
          )}
          <button type="button" onClick={reset} className="mt-10 rounded-xl bg-white px-8 py-4 text-xl font-semibold text-brand-900">
            {res.result === "nicht_gefunden" ? "Nochmal versuchen" : "Fertig"}
          </button>
          <p className="mt-3 text-sm text-brand-300">Die Seite setzt sich nach {RESET_SECONDS} Sekunden zurück.</p>
        </div>
      </Screen>
    );
  }

  const field = "w-full rounded-xl border-2 border-white/30 bg-white px-4 py-4 text-2xl text-slate-900 outline-none focus:border-amber-400";
  return (
    <Screen practice={practice}>
      <form
        className="mx-auto w-full max-w-xl space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setRes(await selfCheckIn(token, name, { d, m, y })));
        }}
      >
        <div className="text-center">
          <h2 className="text-3xl font-semibold">Selbst anmelden</h2>
          <p className="mt-2 text-lg text-brand-200">Für Ihren heutigen Termin. Sie erhalten danach Ihre Aufrufnummer.</p>
        </div>
        <label className="block">
          <span className="mb-2 block text-lg">Nachname</span>
          <input ref={nameRef} className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="family-name" autoCapitalize="words" required />
        </label>
        <fieldset>
          <legend className="mb-2 text-lg">Geburtsdatum</legend>
          <div className="grid grid-cols-[1fr_1fr_1.6fr] gap-3">
            <input className={`${field} text-center`} inputMode="numeric" placeholder="TT" aria-label="Tag" value={d} required
              onChange={(e) => { const v = digits(e.target.value, 2); setD(v); if (v.length === 2) mRef.current?.focus(); }} />
            <input ref={mRef} className={`${field} text-center`} inputMode="numeric" placeholder="MM" aria-label="Monat" value={m} required
              onChange={(e) => { const v = digits(e.target.value, 2); setM(v); if (v.length === 2) yRef.current?.focus(); }} />
            <input ref={yRef} className={`${field} text-center`} inputMode="numeric" placeholder="JJJJ" aria-label="Jahr" value={y} required
              onChange={(e) => setY(digits(e.target.value, 4))} />
          </div>
        </fieldset>
        {res?.result === "eingabe" && <p className="rounded-lg bg-rose-500/20 px-4 py-3 text-lg">Bitte Nachnamen und ein gültiges Geburtsdatum eingeben.</p>}
        <button disabled={pending} className="w-full rounded-xl bg-amber-400 py-5 text-2xl font-semibold text-brand-900 disabled:opacity-60">
          {pending ? "Einen Moment …" : "Anmelden"}
        </button>
        <p className="text-center text-sm text-brand-300">Ihre Angaben werden nur zum Finden Ihres heutigen Termins verwendet.</p>
      </form>
    </Screen>
  );
}

function Screen({ practice, children }: { practice: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-brand-900 px-5 py-6 text-white sm:px-10">
      <header className="mb-8 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="h-10 w-10" />
        <span className="text-2xl font-semibold">{practice}</span>
      </header>
      <div className="flex flex-1 items-center justify-center">{children}</div>
    </main>
  );
}
