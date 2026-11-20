import Link from "next/link";
import { Check, DoorOpen, Maximize2, MapPin, Minimize2, TriangleAlert, UserX, Video } from "lucide-react";
import { setStatus } from "@/app/actions/appointments";
import { SubmitButton } from "@/components/submit-button";
import { fmtTime, minutesBetween } from "@/lib/time";

export interface FlowAppt {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  delay_minutes: number;
  ticket_number: number | null;
  is_emergency: boolean;
  reason: string;
  location_kind: "praxis" | "hausbesuch" | "video";
  checked_in_at: string | null;
  actual_start: string | null;
  actual_end: string | null;
  patientName: string;
  doctorColor: string;
  doctorName: string;
  roomName: string | null;
  warn: boolean;
}

type Tone = "muted" | "warn" | "bad";
const TONE: Record<Tone, string> = { muted: "text-slate-500", warn: "text-amber-700", bad: "text-warn" };

function info(a: FlowAppt, now: Date): { text: string; tone: Tone } | null {
  if (a.status === "geplant" || a.status === "bestaetigt") {
    const late = minutesBetween(a.starts_at, now);
    if (late >= 1) return { text: `fällig seit ${late} min`, tone: late >= 15 ? "bad" : "warn" };
    const soon = -late;
    return soon <= 45 ? { text: `in ${soon} min`, tone: "muted" } : null;
  }
  if (a.status === "eingecheckt" && a.checked_in_at) {
    const w = minutesBetween(a.checked_in_at, now);
    return { text: `wartet ${w} min`, tone: w >= 25 ? "bad" : w >= 10 ? "warn" : "muted" };
  }
  if (a.status === "in_behandlung" && a.actual_start) {
    const run = minutesBetween(a.actual_start, now);
    const plan = minutesBetween(a.starts_at, a.ends_at);
    return run > plan ? { text: `${run - plan} min über Plan`, tone: "bad" } : { text: `${run} von ${plan} min`, tone: "muted" };
  }
  if (a.status === "abgeschlossen" && a.actual_start && a.actual_end) return { text: `${minutesBetween(a.actual_start, a.actual_end)} min`, tone: "muted" };
  return null;
}

const ACTION: Record<string, { status: string; label: string; cls: string }> = {
  geplant: { status: "eingecheckt", label: "Check-in", cls: "bg-st-waiting-d" },
  bestaetigt: { status: "eingecheckt", label: "Check-in", cls: "bg-st-waiting-d" },
  eingecheckt: { status: "in_behandlung", label: "Aufrufen", cls: "bg-st-active-d" },
  in_behandlung: { status: "abgeschlossen", label: "Abschließen", cls: "bg-st-done-d" },
};

function Card({ a, now, tz, back }: { a: FlowAppt; now: Date; tz: string; back: string }) {
  const inf = info(a, now);
  const act = ACTION[a.status];
  const overdue = (a.status === "geplant" || a.status === "bestaetigt") && minutesBetween(a.starts_at, now) >= 15;
  const plan = minutesBetween(a.starts_at, a.ends_at);
  const run = a.status === "in_behandlung" && a.actual_start ? Math.min(100, (minutesBetween(a.actual_start, now) / plan) * 100) : null;
  return (
    <article className="overflow-hidden rounded-md border border-slate-200 border-l-4 bg-white" style={{ borderLeftColor: a.doctorColor }}>
      <Link href={`/termine/${a.id}`} className="block px-3 pt-2.5 pb-2 hover:bg-slate-50">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[0.9375rem] font-semibold tabular-nums">
            {a.ticket_number && a.status !== "geplant" && a.status !== "bestaetigt" ? <span className="mr-1.5 text-xs font-medium text-slate-500">#{a.ticket_number}</span> : null}
            {fmtTime(a.starts_at, tz)}
            {a.delay_minutes > 0 && <span className="ml-1 text-xs font-medium text-amber-700">+{a.delay_minutes}</span>}
          </span>
          {inf && <span className={`text-xs tabular-nums ${TONE[inf.tone]}`}>{inf.text}</span>}
        </div>
        <div className="mt-0.5 truncate font-medium">{a.patientName}</div>
        <div className="truncate text-xs text-slate-500">{a.reason}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 empty:hidden">
          {a.is_emergency && <span className="rounded bg-rose-100 px-1.5 font-medium text-rose-800">Akut</span>}
          {a.warn && <span className="inline-flex items-center gap-1 font-medium text-amber-800"><TriangleAlert className="h-3.5 w-3.5" />Warnhinweis</span>}
          {a.location_kind === "praxis" && a.roomName && <span className="inline-flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5" />{a.roomName}</span>}
          {a.location_kind === "hausbesuch" && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Hausbesuch</span>}
          {a.location_kind === "video" && <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" />Video</span>}
          <span className="ml-auto truncate text-slate-500">{a.doctorName}</span>
        </div>
        {run !== null && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200" aria-hidden>
            <div className={`h-full ${run >= 100 ? "bg-warn" : "bg-st-active"}`} style={{ width: `${run}%` }} />
          </div>
        )}
      </Link>
      {act && (
        <div className="flex gap-1.5 px-3 pb-2.5">
          <form action={setStatus} className="flex-1">
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="status" value={act.status} />
            <input type="hidden" name="back" value={back} />
            <SubmitButton className={`w-full text-white hover:brightness-95 ${act.cls}`}>{act.label}</SubmitButton>
          </form>
          {overdue && (
            <form action={setStatus}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="status" value="nicht_erschienen" />
              <input type="hidden" name="back" value={back} />
              <SubmitButton variant="secondary" className="border border-slate-300 bg-white px-2 text-slate-600 hover:bg-slate-50">
                <UserX className="h-4 w-4" /><span className="sr-only">Nicht erschienen</span>
              </SubmitButton>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

export type ColumnKey = "erwartet" | "wartezimmer" | "behandlung" | "erledigt";
const COMPACT = 3;

function Column({ id, title, hint, color, count, order, empty, href, full, children }: {
  id: ColumnKey; title: string; hint: string; color: string; count: number; order: string; empty: string; href: (spalte?: ColumnKey) => string; full: boolean; children: React.ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-lg bg-slate-200/50 ${full ? "" : order}`} aria-label={title}>
      <header className="flex items-center justify-between gap-2 rounded-t-lg border-t-[3px] px-3 pt-2 pb-1.5" style={{ borderTopColor: color }}>
        <h2 className={`${full ? "text-lg" : "text-[0.9375rem]"} font-semibold`}>{title} <span className="ml-1 tabular-nums" style={{ color }}>{count}</span></h2>
        {full ? (
          <Link href={href()} className="btn-secondary btn-sm"><Minimize2 className="h-4 w-4" /> Schließen</Link>
        ) : count > 0 && (
          <Link href={href(id)} className="btn-ghost btn-sm px-1.5" title={`${title} im Vollbild`} aria-label={`${title} im Vollbild öffnen`}><Maximize2 className="h-4 w-4" /></Link>
        )}
      </header>
      <p className="px-3 pb-2 text-xs text-slate-500">{hint}</p>
      <div className={full ? "grid gap-2 px-2 pb-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" : "space-y-2 px-2 pb-2"}>
        {count === 0 ? <p className="px-1 py-5 text-center text-sm text-slate-500">{empty}</p> : children}
      </div>
      {!full && count > COMPACT && (
        <Link href={href(id)} className="mx-2 mb-2 flex items-center justify-center gap-1 rounded-md border border-dashed border-slate-400 py-1.5 text-sm font-medium text-brand-700 hover:bg-white">
          Alle {count} anzeigen <Maximize2 className="h-3.5 w-3.5" />
        </Link>
      )}
    </section>
  );
}

function DoneList({ list, now, tz }: { list: FlowAppt[]; now: Date; tz: string }) {
  return (
    <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white sm:col-span-full">
      {list.map((a) => {
        const inf = info(a, now);
        return (
          <li key={a.id}>
            <Link href={`/termine/${a.id}`} className="flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-slate-50">
              <span className="w-10 text-xs text-slate-500 tabular-nums">{fmtTime(a.starts_at, tz)}</span>
              <span className="min-w-0 flex-1 truncate">{a.patientName}</span>
              {a.status === "nicht_erschienen" ? <span className="shrink-0 text-xs font-medium text-warn">nicht da</span> : (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Check className="h-3.5 w-3.5 text-st-done" />{inf?.text}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Patientenfluss: vier kompakte Spalten, je die nächsten drei Einträge. Jede Spalte lässt sich
 * mit „Alle anzeigen“ bzw. dem Vollbild-Symbol einzeln über den ganzen Bildschirm öffnen.
 */
export function FlowBoard({ appts, nowIso, tz, back, spalte }: { appts: FlowAppt[]; nowIso: string; tz: string; back: string; spalte?: ColumnKey }) {
  const now = new Date(nowIso);
  const expected = appts.filter((a) => a.status === "geplant" || a.status === "bestaetigt");
  const waiting = appts.filter((a) => a.status === "eingecheckt").sort((a, b) => (a.checked_in_at ?? "").localeCompare(b.checked_in_at ?? ""));
  const active = appts.filter((a) => a.status === "in_behandlung");
  const done = appts.filter((a) => a.status === "abgeschlossen" || a.status === "nicht_erschienen").sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const href = (k?: ColumnKey) => (k ? `${back}${back.includes("?") ? "&" : "?"}spalte=${k}` : back);
  const backHere = spalte ? href(spalte) : back;
  const cards = (list: FlowAppt[]) => (spalte ? list : list.slice(0, COMPACT)).map((a) => <Card key={a.id} a={a} now={now} tz={tz} back={backHere} />);

  const cols = [
    { id: "erwartet" as const, title: "Erwartet", hint: "Noch nicht angekommen", color: "var(--color-st-expected)", list: expected, order: "order-3 md:order-none", empty: "Niemand mehr erwartet." },
    { id: "wartezimmer" as const, title: "Im Wartezimmer", hint: "Der Reihe nach aufrufen", color: "var(--color-st-waiting)", list: waiting, order: "order-2 md:order-none", empty: "Das Wartezimmer ist leer." },
    { id: "behandlung" as const, title: "In Behandlung", hint: "Läuft gerade", color: "var(--color-st-active)", list: active, order: "order-1 md:order-none", empty: "Niemand in Behandlung." },
    { id: "erledigt" as const, title: "Erledigt", hint: "Heute abgeschlossen", color: "var(--color-st-done)", list: done, order: "order-4 md:order-none", empty: "Noch nichts erledigt." },
  ];
  const render = (c: (typeof cols)[number], full: boolean) => (
    <Column key={c.id} id={c.id} title={c.title} hint={c.hint} color={c.color} count={c.list.length} order={c.order} empty={c.empty} href={href} full={full}>
      {c.id === "erledigt" ? <DoneList list={full ? c.list : c.list.slice(0, COMPACT)} now={now} tz={tz} /> : cards(c.list)}
    </Column>
  );

  const open = spalte ? cols.find((c) => c.id === spalte) : undefined;
  if (open) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#eef2f6] p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={`${open.title} – Vollbild`}>
        <nav className="mb-3 flex gap-1 overflow-x-auto" aria-label="Spalte wechseln">
          {cols.map((c) => (
            <Link key={c.id} href={href(c.id)} aria-current={c.id === open.id ? "page" : undefined}
              className={`shrink-0 rounded-full border px-3 py-1 text-sm ${c.id === open.id ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
              {c.title} <span className="tabular-nums opacity-80">{c.list.length}</span>
            </Link>
          ))}
        </nav>
        {render(open, true)}
      </div>
    );
  }
  return <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">{cols.map((c) => render(c, false))}</div>;
}
