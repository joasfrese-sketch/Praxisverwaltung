"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { loadDayPlan, type DayPlan as Plan } from "@/app/actions/appointments";

const PX = 1.1; // Pixel pro Minute
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const shift = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
/** Nur vollständige, plausible Daten – beim Eintippen ist das Feld kurz leer oder z. B. „0002-03-30“. */
const isValidDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= "2000-01-01" && d <= "2199-12-31" && !Number.isNaN(Date.parse(`${d}T12:00:00Z`));
const longDay = (d: string) => new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

/**
 * Tageskalender in der Terminvergabe: alle Behandler nebeneinander, belegte Zeiten als Blöcke.
 * Klick in eine freie Stelle übernimmt Behandler, Datum und Uhrzeit ins Formular.
 */
export function DayPlan({ date, onDate, doctorId, time, duration, slot, excludeId, onPick }: {
  date: string; onDate: (d: string) => void; doctorId: string; time: string; duration: number; slot: number; excludeId?: string;
  onPick: (doctorId: string, time: string) => void;
}) {
  // Letztes gültiges Datum anzeigen, solange im Datumsfeld noch getippt wird
  const [good, setGood] = useState(() => (isValidDay(date) ? date : new Date().toISOString().slice(0, 10)));
  if (isValidDay(date) && date !== good) setGood(date);
  const day = good;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const req = useRef(0);
  useEffect(() => {
    const id = ++req.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const p = await loadDayPlan(day).catch(() => null);
      if (id === req.current) { setPlan(p); setLoading(false); }
    }, 150);
    return () => clearTimeout(t);
  }, [day]);

  const step = Math.max(5, slot);
  const open = plan?.open ?? [];
  const startMin = open.length ? Math.floor(Math.min(...open.map((o) => o[0])) / 60) * 60 : 8 * 60;
  const endMin = open.length ? Math.ceil(Math.max(...open.map((o) => o[1])) / 60) * 60 : 18 * 60;
  const height = (endMin - startMin) * PX;
  const hours: number[] = [];
  for (let m = startMin; m <= endMin; m += 60) hours.push(m);
  const sel = toMin(time || "00:00");
  const isOpen = (m: number, e: number) => open.some(([o, c]) => o <= m && e <= c);

  return (
    <section className="card flex min-w-0 flex-col" aria-label="Tageskalender">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-semibold">Kalender</h2>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className="btn-ghost btn-sm px-1.5" aria-label="Vorheriger Tag" onClick={() => onDate(shift(day, -1))}><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-44 text-center text-sm font-medium">{longDay(day)}</span>
          <button type="button" className="btn-ghost btn-sm px-1.5" aria-label="Nächster Tag" onClick={() => onDate(shift(day, 1))}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </header>
      <p className="px-3 pt-2 text-xs text-slate-500">
        Alle Termine des Tages. <b>Klick in eine freie (weiße) Stelle</b> übernimmt Behandler und Uhrzeit. Farbige Blöcke = belegt, grau = geschlossen, schraffiert = abwesend.
      </p>
      {loading && !plan ? <p className="p-6 text-center text-sm text-slate-500">Lade Kalender …</p> : !plan?.providers.length ? (
        <p className="p-6 text-center text-sm text-slate-500">Keine Behandler angelegt.</p>
      ) : (
        <div className={`overflow-auto p-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {!open.length && <p className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">Die Praxis ist an diesem Tag geschlossen.</p>}
          <div className="flex min-w-fit">
            <div className="w-11 shrink-0">
              <div className="h-8" />
              <div className="relative" style={{ height }}>
                {hours.map((m) => <div key={m} className="absolute right-1 -translate-y-1/2 text-[0.6875rem] text-slate-400 tabular-nums" style={{ top: (m - startMin) * PX }}>{hhmm(m)}</div>)}
              </div>
            </div>
            {plan.providers.map((p) => {
              const mine = p.id === doctorId;
              const preview = mine && date === plan.day ? { s: sel, e: sel + duration } : null;
              const clash = preview && p.appts.some((a) => a.id !== excludeId && a.start < preview.e && a.end > preview.s);
              return (
                <div key={p.id} className="min-w-28 flex-1 border-l border-slate-200">
                  <div className={`flex h-8 items-center gap-1.5 truncate px-1.5 text-xs font-medium ${mine ? "rounded-t bg-brand-100 text-brand-900" : ""}`}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />{p.name}
                  </div>
                  <div
                    className={`relative cursor-pointer ${p.absent ? "hatch" : "bg-slate-200"}`}
                    style={{ height }}
                    title={p.absent ? `Abwesend (${p.absent})` : undefined}
                    onClick={(e) => {
                      if (p.absent) return;
                      const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                      const m = startMin + Math.floor(y / PX / step) * step;
                      onPick(p.id, hhmm(Math.max(startMin, Math.min(m, endMin - step))));
                    }}
                  >
                    {!p.absent && open.map(([o, c], i) => <div key={i} className="absolute inset-x-0 bg-white" style={{ top: (o - startMin) * PX, height: (c - o) * PX }} />)}
                    {hours.map((m) => <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-slate-200" style={{ top: (m - startMin) * PX }} />)}
                    {p.absent && <div className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs font-medium text-rose-700">{p.absent}</div>}
                    {p.appts.filter((a) => a.id !== excludeId).map((a) => (
                      <div key={a.id} onClick={(e) => e.stopPropagation()}
                        className={`absolute inset-x-0.5 z-10 cursor-default overflow-hidden rounded border border-l-[3px] px-1 text-[0.6875rem] leading-tight text-slate-900 ${a.status === "abgeschlossen" ? "opacity-55" : ""}`}
                        style={{ top: Math.max(0, a.start - startMin) * PX, height: Math.max((a.end - a.start) * PX - 1, 12), borderColor: `${p.color}88`, borderLeftColor: p.color, background: `${p.color}33` }}
                        title={`${hhmm(a.start)}–${hhmm(a.end)} ${a.label}: ${a.reason}`}>
                        <span className="font-semibold tabular-nums">{hhmm(a.start)}</span> {a.label}{a.emergency ? " ⚠" : ""}
                      </div>
                    ))}
                    {preview && (
                      <div className={`pointer-events-none absolute inset-x-0.5 z-20 rounded border-2 border-dashed px-1 text-[0.6875rem] font-semibold ${clash || !isOpen(preview.s, preview.e) ? "border-warn bg-rose-50/80 text-warn" : "border-brand-700 bg-brand-100/80 text-brand-900"}`}
                        style={{ top: (preview.s - startMin) * PX, height: Math.max(duration * PX, 14) }}>
                        Neu {hhmm(preview.s)}{clash ? " · belegt!" : !isOpen(preview.s, preview.e) ? " · geschlossen" : ""}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
