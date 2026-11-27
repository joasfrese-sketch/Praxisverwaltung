"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CalendarCheck, CalendarPlus, ChevronLeft, CreditCard } from "lucide-react";
import { bookOnline, loadOnlineSlots, type BookResult, type OnlineSlot } from "@/app/actions/booking";

export type BookingInfo = {
  practice: string; phone: string | null; enabled: boolean; lead_hours: number; horizon_days: number; today: string; timezone: string;
  types: { id: string; name: string; minutes: number }[];
  doctors: { id: string; name: string; specialty: string | null }[];
};

const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const addMonths = (d: string, n: number) => {
  const [y, m, day] = d.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  x.setUTCDate(Math.min(day, new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0, 12)).getUTCDate()));
  return x.toISOString().slice(0, 10);
};
const WINDOW = 14;
const WHEN = [
  { k: "next", label: "Nächstmöglich" }, { k: "2w", label: "in 2 Wochen" }, { k: "1m", label: "in 1 Monat" },
  { k: "3m", label: "in 3 Monaten" }, { k: "6m", label: "in 6 Monaten" }, { k: "date", label: "Wunschdatum" },
] as const;
type When = (typeof WHEN)[number]["k"];

/** Online-Terminbuchung in 4 Schritten: Leistung → Behandler → Zeit → Ihre Daten. */
export function Booking({ token, info }: { token: string; info: BookingInfo }) {
  const tz = info.timezone;
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("de-DE", { ...o, timeZone: tz }).format(new Date(iso));
  const dayOf = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(new Date(iso));

  const [typeId, setTypeId] = useState(info.types.length === 1 ? info.types[0].id : "");
  const [doctor, setDoctor] = useState<string | null | undefined>(info.doctors.length === 1 ? info.doctors[0].id : undefined); // null = egal
  const [when, setWhen] = useState<When>("next");
  const [wish, setWish] = useState(addMonths(info.today, 1));
  const [part, setPart] = useState<"egal" | "vor" | "nach">("egal");
  const [page, setPage] = useState(0);
  const [slots, setSlots] = useState<OnlineSlot[] | null>(null);
  const [pick, setPick] = useState<OnlineSlot | null>(null);
  const [done, setDone] = useState<BookResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);

  const type = info.types.find((t) => t.id === typeId);
  const docName = (id: string) => info.doctors.find((d) => d.id === id)?.name ?? "";
  const target = when === "next" ? info.today : when === "2w" ? addDays(info.today, 14) : when === "1m" ? addMonths(info.today, 1)
    : when === "3m" ? addMonths(info.today, 3) : when === "6m" ? addMonths(info.today, 6) : wish;
  const base = when === "next" ? info.today : addDays(target, -Math.floor(WINDOW / 2));
  const from = addDays(base < info.today ? info.today : base, page * WINDOW);
  const to = addDays(from, WINDOW - 1);
  const reload = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!typeId || doctor === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return;
    const id = ++reload.current;
    const h = setTimeout(async () => {
      setSlots(null);
      const r = await loadOnlineSlots(token, typeId, doctor, from, to).catch(() => []);
      if (id === reload.current) setSlots(r);
    }, 150);
    return () => clearTimeout(h);
  }, [token, typeId, doctor, from, to, tick]);

  // nach Tagen gruppieren; bei „egal“ jede Uhrzeit nur einmal (erster freier Behandler)
  const byDay = useMemo(() => {
    const m = new Map<string, OnlineSlot[]>();
    const seen = new Set<string>();
    for (const s of slots ?? []) {
      const hour = parseInt(new Intl.DateTimeFormat("sv-SE", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(s.t)), 10);
      if (part === "vor" && hour >= 12) continue;
      if (part === "nach" && hour < 12) continue;
      if (seen.has(s.t)) continue;
      seen.add(s.t);
      const d = dayOf(s.t);
      m.set(d, [...(m.get(d) ?? []), s]);
    }
    return [...m.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, part]);

  const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-[0.95rem] ${on ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`;
  const scrollTop = () => top.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (!info.enabled || !info.types.length || !info.doctors.length) {
    return (
      <Shell practice={info.practice}>
        <p className="text-lg">Die Online-Terminbuchung ist gerade nicht verfügbar.</p>
        <p className="mt-2 text-slate-600">Bitte rufen Sie uns an{info.phone ? <>: <a className="font-semibold text-brand-700" href={`tel:${info.phone}`}>{info.phone}</a></> : "."}</p>
      </Shell>
    );
  }

  if (done?.result === "ok") {
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Praxisverwaltung//DE", "BEGIN:VEVENT",
      `UID:${done.token}@praxis`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART:${new Date(done.starts_at).toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTEND:${new Date(done.ends_at).toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `SUMMARY:${done.type} – ${info.practice}`, `DESCRIPTION:${done.doctor}`, "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const link = `${window.location.origin}/t/${done.token}`;
    return (
      <Shell practice={info.practice}>
        <div className="text-center">
          <CalendarCheck className="mx-auto h-14 w-14 text-emerald-600" />
          <h2 className="mt-3 text-2xl font-semibold">Ihr Termin ist gebucht</h2>
          <p className="mt-4 text-xl font-semibold">{fmt(done.starts_at, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
          <p className="text-xl">{fmt(done.starts_at, { hour: "2-digit", minute: "2-digit" })} Uhr</p>
          <p className="mt-1 text-slate-600">{done.type} · {done.doctor}</p>
        </div>
        <div className="mt-6 space-y-3">
          <a className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 font-medium" download="termin.ics" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`}>
            <CalendarPlus className="h-5 w-5" /> In meinen Kalender eintragen
          </a>
          <div className="rounded-xl bg-slate-100 p-4 text-sm">
            <p className="font-medium">Ihr persönlicher Termin-Link – bitte speichern:</p>
            <a href={link} className="mt-1 block break-all text-brand-700 underline">{link}</a>
            <p className="mt-1 text-slate-600">Dort können Sie den Termin ansehen und bis zur Absagefrist selbst absagen.</p>
          </div>
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"><CreditCard className="h-5 w-5 shrink-0" /> Bitte bringen Sie Ihre Versichertenkarte mit.</p>
        </div>
      </Shell>
    );
  }

  const step = !typeId ? 1 : doctor === undefined ? 2 : !pick ? 3 : 4;

  return (
    <Shell practice={info.practice}>
      <div ref={top} className="scroll-mt-4" />
      <ol className="mb-5 flex gap-1 text-xs" aria-label="Schritte">
        {["Leistung", "Behandler", "Zeit", "Ihre Daten"].map((l, i) => (
          <li key={l} className={`flex-1 rounded-full py-1 text-center ${i + 1 === step ? "bg-brand-700 font-semibold text-white" : i + 1 < step ? "bg-brand-100 text-brand-900" : "bg-slate-100 text-slate-500"}`}>{i + 1}. {l}</li>
        ))}
      </ol>

      {step === 1 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Wofür möchten Sie einen Termin?</h2>
          <div className="grid gap-2">
            {info.types.map((t) => (
              <button key={t.id} type="button" onClick={() => setTypeId(t.id)} className="flex items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-4 text-left text-lg hover:border-brand-500">
                {t.name} <span className="text-sm text-slate-500">{t.minutes} min</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <Back onClick={() => setTypeId("")} />
          <h2 className="mb-3 text-xl font-semibold">Bei wem?</h2>
          <div className="grid gap-2">
            <button type="button" onClick={() => setDoctor(null)} className="rounded-xl border-2 border-brand-300 bg-brand-50 px-4 py-4 text-left text-lg hover:border-brand-500">
              Egal – erster freier Termin
            </button>
            {info.doctors.map((d) => (
              <button key={d.id} type="button" onClick={() => setDoctor(d.id)} className="rounded-xl border border-slate-300 bg-white px-4 py-4 text-left text-lg hover:border-brand-500">
                {d.name}{d.specialty && <span className="block text-sm text-slate-500">{d.specialty}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <Back onClick={() => (info.doctors.length > 1 ? setDoctor(undefined) : setTypeId(""))} />
          <h2 className="text-xl font-semibold">Wann passt es Ihnen?</h2>
          <p className="mb-3 text-sm text-slate-600">{type?.name} · {doctor ? docName(doctor) : "beliebiger Behandler"}</p>
          {msg && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-amber-950">{msg}</p>}
          <div className="mb-2 flex flex-wrap gap-2">
            {WHEN.filter((w) => w.k === "next" || w.k === "date" || (w.k === "2w" ? 14 : w.k === "1m" ? 31 : w.k === "3m" ? 92 : 183) <= info.horizon_days).map((w) => <button key={w.k} type="button" aria-pressed={when === w.k} className={chip(when === w.k)} onClick={() => { setWhen(w.k); setPage(0); }}>{w.label}</button>)}
          </div>
          {when === "date" && (
            <input type="date" className="mb-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-lg" min={info.today} max={addDays(info.today, info.horizon_days)}
              value={wish} onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) { setWish(e.target.value); setPage(0); } }} aria-label="Wunschdatum" />
          )}
          <div className="mb-4 flex flex-wrap gap-2">
            {([["egal", "ganztags"], ["vor", "vormittags"], ["nach", "nachmittags"]] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={part === k} className={chip(part === k)} onClick={() => setPart(k)}>{l}</button>
            ))}
          </div>
          <div className="mb-3 flex items-center justify-between text-sm text-slate-600">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg px-2 py-1 disabled:opacity-30">‹ früher</button>
            <span>{fmt(`${from}T12:00:00Z`, { day: "2-digit", month: "2-digit" })} – {fmt(`${to}T12:00:00Z`, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
            <button type="button" disabled={from > addDays(info.today, info.horizon_days)} onClick={() => setPage(page + 1)} className="rounded-lg px-2 py-1 disabled:opacity-30">später ›</button>
          </div>
          {slots === null ? <p className="py-8 text-center text-slate-500">Suche freie Termine …</p> : byDay.length === 0 ? (
            <div className="rounded-xl bg-slate-100 p-5 text-center">
              <p>In diesem Zeitraum ist leider nichts frei.</p>
              <button type="button" className="mt-3 rounded-xl bg-brand-700 px-5 py-2.5 font-medium text-white" onClick={() => setPage(page + 1)}>Spätere Termine zeigen</button>
            </div>
          ) : (
            <div className="space-y-4">
              {byDay.map(([d, list]) => (
                <div key={d}>
                  <h3 className="mb-1.5 font-semibold">{fmt(`${d}T12:00:00Z`, { weekday: "long", day: "2-digit", month: "2-digit" })}</h3>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {list.map((s) => (
                      <button key={s.t} type="button" onClick={() => { setPick(s); setMsg(null); scrollTop(); }}
                        className="rounded-lg border border-emerald-300 bg-emerald-50 py-2.5 text-center font-semibold tabular-nums text-emerald-950 hover:bg-emerald-100">
                        {fmt(s.t, { hour: "2-digit", minute: "2-digit" })}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 4 && pick && (
        <section>
          <Back onClick={() => setPick(null)} />
          <div className="mb-4 rounded-xl bg-brand-50 p-4 text-brand-950">
            <p className="text-lg font-semibold">{fmt(pick.t, { weekday: "long", day: "2-digit", month: "long" })}, {fmt(pick.t, { hour: "2-digit", minute: "2-digit" })} Uhr</p>
            <p className="text-sm">{type?.name} · {docName(pick.d)}</p>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const g = (k: string) => String(f.get(k) ?? "").trim();
              const birth = `${g("y").padStart(4, "0")}-${g("m").padStart(2, "0")}-${g("d").padStart(2, "0")}`;
              start(async () => {
                const r = await bookOnline({
                  token, typeId, doctorId: pick.d, startsAt: pick.t, first: g("first"), last: g("last"), birth, phone: g("phone"),
                  email: g("email"), insurance: g("insurance"), note: g("note"), consent: f.get("consent") === "on",
                });
                if (r.result === "ok") { setDone(r); scrollTop(); return; }
                if (r.result === "belegt") { setPick(null); setMsg("Dieser Termin wurde gerade vergeben. Bitte wählen Sie eine andere Zeit."); setTick((x) => x + 1); scrollTop(); return; }
                setMsg(r.result === "eingabe" ? "Bitte prüfen Sie Ihre Angaben (Name, Geburtsdatum, Telefon, Einwilligung)."
                  : r.result === "limit" ? "Online sind gerade keine weiteren Buchungen möglich. Bitte rufen Sie uns an."
                  : "Die Buchung hat nicht geklappt. Bitte versuchen Sie es erneut oder rufen Sie uns an.");
              });
            }}
          >
            {msg && <p className="rounded-xl bg-rose-50 p-3 text-rose-900">{msg}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="first" label="Vorname *" autoComplete="given-name" required />
              <Input name="last" label="Nachname *" autoComplete="family-name" required />
            </div>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Geburtsdatum *</legend>
              <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-2">
                <input name="d" inputMode="numeric" maxLength={2} placeholder="TT" aria-label="Tag" required className={field} />
                <input name="m" inputMode="numeric" maxLength={2} placeholder="MM" aria-label="Monat" required className={field} />
                <input name="y" inputMode="numeric" maxLength={4} placeholder="JJJJ" aria-label="Jahr" required className={field} />
              </div>
            </fieldset>
            <Input name="phone" label="Telefon (für Rückfragen) *" type="tel" autoComplete="tel" required />
            <Input name="email" label="E-Mail (optional)" type="email" autoComplete="email" />
            <label className="block"><span className="mb-1 block text-sm font-medium">Versicherung</span>
              <select name="insurance" className={field} defaultValue="gesetzlich">
                <option value="gesetzlich">gesetzlich versichert</option><option value="privat">privat versichert</option><option value="selbstzahler">Selbstzahler</option>
              </select>
            </label>
            <label className="block"><span className="mb-1 block text-sm font-medium">Hinweis an die Praxis (optional)</span>
              <textarea name="note" maxLength={500} rows={2} className={field} placeholder="z. B. Beschwerden, Barrierefreiheit" />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 accent-brand-600" />
              <span>Ich bin einverstanden, dass die Praxis meine Angaben zur Terminvergabe speichert und mich bei Rückfragen kontaktiert. *</span>
            </label>
            <button disabled={pending} className="w-full rounded-xl bg-brand-700 py-4 text-lg font-semibold text-white disabled:opacity-60">
              {pending ? "Wird gebucht …" : "Termin verbindlich buchen"}
            </button>
          </form>
        </section>
      )}
    </Shell>
  );
}

const field = "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-lg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function Input({ label, ...p }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block"><span className="mb-1 block text-sm font-medium">{label}</span><input {...p} className={field} /></label>;
}

function Back({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700"><ChevronLeft className="h-4 w-4" /> zurück</button>;
}

function Shell({ practice, children }: { practice: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#eef2f6] px-4 py-6">
      <div className="mx-auto max-w-xl">
        <header className="mb-4 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <div><div className="text-lg font-semibold leading-tight">{practice}</div><div className="text-sm text-slate-500">Termin online buchen</div></div>
        </header>
        <div className="rounded-2xl bg-white p-5 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
