"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { loadRangePlan, type RangePlan } from "@/app/actions/appointments";

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const addMonths = (d: string, n: number) => {
  const [y, m, day] = d.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0, 12)).getUTCDate();
  x.setUTCDate(Math.min(day, last));
  return x.toISOString().slice(0, 10);
};
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("de-DE", { ...o, timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
const short = (d: string) => fmt(d, { weekday: "short", day: "2-digit", month: "2-digit" });
const full = (d: string) => fmt(d, { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= "2000-01-01" && d <= "2199-12-31" && !Number.isNaN(Date.parse(`${d}T12:00:00Z`));

const WHEN = [
  { key: "next", label: "Nächstmöglich" },
  { key: "2w", label: "in 2 Wochen" },
  { key: "1m", label: "in 1 Monat" },
  { key: "3m", label: "in 3 Monaten" },
  { key: "6m", label: "in 6 Monaten" },
  { key: "1y", label: "in 1 Jahr" },
  { key: "date", label: "um Datum …" },
  { key: "range", label: "Wunschzeitraum" },
] as const;
type When = (typeof WHEN)[number]["key"];
const SPANS = [{ v: 7, label: "± 3 Tage" }, { v: 14, label: "± 1 Woche" }, { v: 28, label: "± 2 Wochen" }];
const PARTS = [{ v: "egal", label: "ganztags" }, { v: "vor", label: "vormittags" }, { v: "nach", label: "nachmittags" }] as const;

function target(when: When, today: string, anchor: string) {
  switch (when) {
    case "2w": return addDays(today, 14);
    case "1m": return addMonths(today, 1);
    case "3m": return addMonths(today, 3);
    case "6m": return addMonths(today, 6);
    case "1y": return addMonths(today, 12);
    case "date": return isDay(anchor) ? anchor : today;
    default: return today;
  }
}

/**
 * Hauptaufgabe der Terminvergabe am Empfang: „Termin in ca. einem halben Jahr, mit etwas Spielraum“.
 * Zeigt den Zeitraum als Kalender des Behandlers; grüne Felder sind buchbare Startzeiten.
 */
export type Wish = { from?: string; to?: string; part?: "vor" | "nach"; after?: number; note?: string };

export function SlotFinder({ today, doctorId, doctorColor, duration, slot, excludeId, date, time, initialWhen, wish, onPick }: {
  today: string; doctorId: string; doctorColor: string; duration: number; slot: number; excludeId?: string;
  date: string; time: string; initialWhen: "next" | "date"; wish?: Wish; onPick: (date: string, time: string) => void;
}) {
  const hasRange = !!(wish?.from || wish?.to);
  const [when, setWhen] = useState<When>(hasRange ? "range" : initialWhen);
  const [after, setAfter] = useState<number | null>(wish?.after ?? null);
  const [anchor, setAnchor] = useState(initialWhen === "date" && isDay(date) ? date : addMonths(today, 6));
  const [span, setSpan] = useState(14);
  const [part, setPart] = useState<"egal" | "vor" | "nach">(wish?.part ?? "egal");
  const [shift, setShift] = useState(0); // Zeitraum vor/zurück blättern
  const [plan, setPlan] = useState<RangePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0); // erster sichtbarer Tag, wenn nicht alle Tage auf den Bildschirm passen
  const req = useRef(0);

  // Bildschirm ausmessen: Breite des Kalenders und Höhe des Fensters (ändert sich bei Drehen/Größe ändern)
  const box = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 800, vw: 1280, above: 150 });
  useEffect(() => {
    const el = box.current;
    const measure = () => {
      // Platz über dem Raster innerhalb der Karte (Zeitraum-Zeile, Schnellwahl, Tageskopf)
      const above = el && grid.current ? grid.current.getBoundingClientRect().top - el.getBoundingClientRect().top : 150;
      setSize({ w: el?.clientWidth ?? 1000, h: window.innerHeight, vw: window.innerWidth, above });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (el) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  const t = target(when, today, anchor);
  // Wunschzeitraum (z. B. aus der Warteliste): frühestens … spätestens, höchstens 6 Wochen auf einmal
  const rFrom = wish?.from && isDay(wish.from) && wish.from > today ? wish.from : today;
  const rTo = wish?.to && isDay(wish.to) && wish.to >= rFrom ? wish.to : addDays(rFrom, 14);
  const win = when === "range" ? Math.min(42, Math.max(1, daysBetween(rFrom, rTo))) : span;
  const baseFrom = when === "range" ? rFrom : when === "next" ? today : addDays(t, -Math.floor(span / 2));
  const from = addDays(baseFrom < today ? today : baseFrom, shift * win);
  const to = addDays(from, win);

  useEffect(() => {
    if (!doctorId) return;
    const id = ++req.current;
    const h = setTimeout(async () => {
      setLoading(true);
      const p = await loadRangePlan(doctorId, from, to).catch(() => null);
      if (id === req.current) { setPlan(p); setLoading(false); }
    }, 200);
    return () => clearTimeout(h);
  }, [doctorId, from, to]);

  const step = Math.max(5, slot);
  const days = useMemo(() => (plan?.days ?? []).map((d) => {
    const free: number[] = [];
    if (!d.absent) {
      for (const [o, c] of d.open) {
        for (let m = o; m + duration <= c; m += step) {
          if (d.day === plan!.today && m < plan!.nowMin + 5) continue;
          if (part === "vor" && m >= 12 * 60) continue;
          if (part === "nach" && m < 12 * 60) continue;
          if (after !== null && m < after) continue;
          const b = plan!.buffer;
          if (d.appts.some((a) => a.id !== excludeId && a.start < m + duration + b && a.end > m - b)) continue;
          free.push(m);
        }
      }
    }
    return { ...d, free };
  }), [plan, duration, step, part, after, excludeId]);

  const all = days.flatMap((d) => d.open);
  const openStart = all.length ? Math.floor(Math.min(...all.map((o) => o[0])) / 60) * 60 : 8 * 60;
  const openEnd = all.length ? Math.ceil(Math.max(...all.map((o) => o[1])) / 60) * 60 : 18 * 60;
  // Nur den gewünschten Teil des Tages zeigen (ab-Uhrzeit, vor-/nachmittags)
  const startMin = Math.min(openEnd - 60, Math.max(openStart, after !== null ? Math.floor(after / 60) * 60 : part === "nach" ? 12 * 60 : openStart));
  const endMin = Math.max(startMin + 60, part === "vor" && after === null ? Math.min(openEnd, 13 * 60) : openEnd);
  // Höhe: der ganze Tag passt in die Fensterhöhe (abzüglich Kopfzeile, Tageskopf und Legende)
  // Fenster − App-Kopfzeile − alles über dem Raster − Legende − untere Leiste (Tablet/Handy)
  const bottomBar = size.vw < 1024 ? 64 : 0;
  const avail = Math.max(260, size.h - 64 - size.above - 40 - bottomBar - 12);
  // Handy: Felder groß genug zum Antippen (dann lieber senkrecht scrollen)
  const PX = Math.min(1.6, Math.max(size.vw < 640 ? 0.9 : 0.5, avail / (endMin - startMin)));
  const height = (endMin - startMin) * PX;
  const showLabels = Math.max(5, slot) * PX >= 12;
  // Breite: so viele Tage wie nebeneinander passen (mind. 58 px je Tag), der Rest per Pfeil
  const perView = Math.max(1, Math.floor((size.w - 44) / 58));
  const maxOffset = Math.max(0, days.length - perView);
  const first = Math.min(offset, maxOffset);
  const visible = days.slice(first, first + perView);
  const firstPerDay = visible.filter((d) => d.free.length).map((d) => ({ day: d.day, m: d.free[0] }));
  const back = () => {
    if (first > 0) setOffset(Math.max(0, first - perView));
    else if (from > today) { setShift(shift - 1); setOffset(1e6); }
  };
  const forward = () => {
    if (first < maxOffset) setOffset(first + perView);
    else { setShift(shift + 1); setOffset(0); }
  };
  const hours: number[] = [];
  for (let m = startMin; m <= endMin; m += 60) hours.push(m);
  const total = days.reduce((n, d) => n + d.free.length, 0);
  

  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`;

  return (
    <div className="space-y-3">
      {wish && (hasRange || wish.note || wish.after != null || wish.part) && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <b>Wunsch laut Warteliste:</b>{" "}
          {hasRange && <>{wish.from ? `frühestens ${full(wish.from)}` : ""}{wish.from && wish.to ? ", " : ""}{wish.to ? `spätestens ${full(wish.to)}` : ""}</>}
          {wish.note && <>{hasRange ? " · " : ""}„{wish.note}“</>}
          <span className="block text-xs text-amber-800">Zeitraum und Tageszeit sind schon eingestellt – nur noch ein grünes Feld antippen.</span>
        </div>
      )}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-24 text-xs font-medium text-slate-600">Wann?</span>
          {WHEN.filter((w) => w.key !== "range" || hasRange).map((w) => (
            <button key={w.key} type="button" aria-pressed={when === w.key} className={chip(when === w.key)} onClick={() => { setWhen(w.key); setShift(0); setOffset(0); }}>{w.label}</button>
          ))}
          {when === "date" && (
            <input type="date" className="input w-44" value={anchor} aria-label="Wunschdatum" onChange={(e) => { setAnchor(e.target.value); setShift(0); setOffset(0); }} />
          )}
        </div>
        {when !== "next" && when !== "range" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-24 text-xs font-medium text-slate-600">Spielraum</span>
            {SPANS.map((s) => <button key={s.v} type="button" aria-pressed={span === s.v} className={chip(span === s.v)} onClick={() => { setSpan(s.v); setShift(0); setOffset(0); }}>{s.label}</button>)}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-24 text-xs font-medium text-slate-600">Tageszeit</span>
          {PARTS.map((p) => <button key={p.v} type="button" aria-pressed={part === p.v && after === null} className={chip(part === p.v && after === null)} onClick={() => { setPart(p.v); setAfter(null); }}>{p.label}</button>)}
          {wish?.after != null && (
            <button type="button" aria-pressed={after !== null} className={chip(after !== null)} onClick={() => { setAfter(wish.after!); setPart("egal"); }}>ab {hhmm(wish.after)} Uhr</button>
          )}
        </div>
      </div>

      {!doctorId ? (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">Behandler wählen – dann erscheinen die freien Zeiten.</p>
      ) : (
        <div ref={box} className="rounded-lg border border-slate-200">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
            <button type="button" className="btn-secondary btn-sm px-2" aria-label="Frühere Tage" disabled={first === 0 && from <= today} onClick={back}><ChevronLeft className="h-4 w-4" /></button>
            <div className="min-w-0 flex-1 text-sm">
              <b>{full(from)} – {full(to)}</b>
              {when !== "next" && when !== "range" && shift === 0 && <span className="text-slate-500"> · rund um {full(t)}</span>}
              {visible.length < days.length && (
                <span className="block text-xs text-slate-500">Angezeigt: {short(visible[0].day)} – {short(visible[visible.length - 1].day)} · weitere Tage mit den Pfeilen</span>
              )}
              <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${total ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                {loading ? "suche …" : `${total} freie Zeiten`}
              </span>
            </div>
            <button type="button" className="btn-secondary btn-sm px-2" aria-label="Spätere Tage" onClick={forward}><ChevronRight className="h-4 w-4" /></button>
          </div>

          {firstPerDay.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-3 py-2">
              <span className="self-center text-xs text-slate-500">Schnellwahl:</span>
              {firstPerDay.map((f) => {
                const on = f.day === date && hhmm(f.m) === time;
                return (
                  <button key={f.day} type="button" aria-pressed={on} onClick={() => onPick(f.day, hhmm(f.m))}
                    className={`rounded-md border px-2 py-0.5 text-sm tabular-nums ${on ? "border-brand-700 bg-brand-700 text-white" : "border-emerald-300 bg-emerald-50 hover:bg-emerald-100"}`}>
                    {short(f.day)} <b>{hhmm(f.m)}</b>
                  </button>
                );
              })}
            </div>
          )}

          {days.length === 0 && !loading ? (
            <p className="p-6 text-center text-sm text-slate-500">In diesem Zeitraum hat die Praxis geschlossen. Mit dem Pfeil weiterblättern.</p>
          ) : (
            <div className={`p-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
              <div className="flex">
                <div className="w-10 shrink-0">
                  <div className="h-9" />
                  <div ref={grid} className="relative" style={{ height }}>
                    {hours.map((m) => <div key={m} className="absolute right-1 -translate-y-1/2 text-[0.6875rem] text-slate-400 tabular-nums" style={{ top: (m - startMin) * PX }}>{hhmm(m)}</div>)}
                  </div>
                </div>
                {visible.map((d) => (
                  <div key={d.day} className="min-w-0 flex-1 border-l border-slate-200">
                    <div className={`flex h-9 flex-col items-center justify-center text-xs leading-tight ${d.day === date ? "rounded-t bg-brand-100 font-semibold text-brand-900" : ""}`}>
                      <span>{fmt(d.day, { weekday: "short" })}</span>
                      <span className="tabular-nums">{fmt(d.day, { day: "2-digit", month: "2-digit" })}</span>
                    </div>
                    <div className={`relative ${d.absent ? "hatch" : "bg-slate-200"}`} style={{ height }}>
                      {!d.absent && d.open.map(([o, c], i) => {
                        const a = Math.max(o, startMin), b = Math.min(c, endMin);
                        return b > a ? <div key={i} className="absolute inset-x-0 bg-white" style={{ top: (a - startMin) * PX, height: (b - a) * PX }} /> : null;
                      })}
                      {hours.map((m) => <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-slate-200" style={{ top: (m - startMin) * PX }} />)}
                      {d.absent && <div className="absolute inset-x-0 top-2 text-center text-xs font-medium text-rose-700">{d.absent}</div>}
                      {d.appts.filter((a) => a.id !== excludeId && a.end > startMin && a.start < endMin).map((a) => (
                        <div key={a.id} title={`${hhmm(a.start)}–${hhmm(a.end)} ${a.label}: ${a.reason}`}
                          className="absolute inset-x-0.5 z-10 overflow-hidden rounded border border-l-[3px] px-1 text-[0.625rem] leading-tight whitespace-nowrap text-slate-800"
                          style={{ top: Math.max(0, a.start - startMin) * PX, height: Math.max((Math.min(a.end, endMin) - Math.max(a.start, startMin)) * PX - 1, 10), borderColor: `${doctorColor}88`, borderLeftColor: doctorColor, background: `${doctorColor}33` }}>
                          {hhmm(a.start)} {a.label}
                        </div>
                      ))}
                      {d.free.map((m) => {
                        const on = d.day === date && hhmm(m) === time;
                        return (
                          <button key={m} type="button" onClick={() => onPick(d.day, hhmm(m))} aria-pressed={on} title={`${short(d.day)} ${hhmm(m)} wählen`}
                            className={`absolute inset-x-1 z-10 rounded-sm text-center text-[0.625rem] leading-none tabular-nums ${on ? "z-20 bg-brand-700 font-semibold text-white ring-2 ring-brand-900" : "bg-emerald-100 text-emerald-900 hover:bg-emerald-300"}`}
                            style={{ top: (m - startMin) * PX + 1, height: (on ? duration : step) * PX - 2 }}>
                            {showLabels || on ? hhmm(m) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500">
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-100 align-middle ring-1 ring-emerald-300" /> frei (anklicken) ·
            <span className="mx-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: `${doctorColor}55` }} /> belegt ·
            <span className="mx-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-200 align-middle" /> geschlossen ·
            <span className="hatch mx-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" /> abwesend
          </p>
        </div>
      )}
    </div>
  );
}
