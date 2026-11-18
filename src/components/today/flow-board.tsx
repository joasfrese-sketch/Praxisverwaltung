import Link from "next/link";
import { Check, DoorOpen, MapPin, TriangleAlert, UserX, Video } from "lucide-react";
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
          <span className="text-[15px] font-semibold tabular-nums">
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

function Column({ title, hint, color, count, order, empty, children }: {
  title: string; hint: string; color: string; count: number; order: string; empty: string; children: React.ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-lg bg-slate-200/50 ${order}`} aria-label={title}>
      <header className="flex items-baseline justify-between gap-2 rounded-t-lg border-t-[3px] px-3 pt-2 pb-1.5" style={{ borderTopColor: color }}>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <span className="text-sm font-semibold tabular-nums" style={{ color }}>{count}</span>
      </header>
      <p className="px-3 pb-2 text-xs text-slate-500">{hint}</p>
      <div className="space-y-2 px-2 pb-2">{count === 0 ? <p className="px-1 py-5 text-center text-sm text-slate-500">{empty}</p> : children}</div>
    </section>
  );
}

export function FlowBoard({ appts, nowIso, tz, back }: { appts: FlowAppt[]; nowIso: string; tz: string; back: string }) {
  const now = new Date(nowIso);
  const expected = appts.filter((a) => a.status === "geplant" || a.status === "bestaetigt");
  const waiting = appts.filter((a) => a.status === "eingecheckt").sort((a, b) => (a.checked_in_at ?? "").localeCompare(b.checked_in_at ?? ""));
  const active = appts.filter((a) => a.status === "in_behandlung");
  const done = appts.filter((a) => a.status === "abgeschlossen" || a.status === "nicht_erschienen").sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const shownDone = done.slice(0, 6);
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Column title="Erwartet" hint="Noch nicht angekommen" color="var(--color-st-expected)" count={expected.length} order="order-3 md:order-none" empty="Niemand mehr erwartet.">
        {expected.map((a) => <Card key={a.id} a={a} now={now} tz={tz} back={back} />)}
      </Column>
      <Column title="Im Wartezimmer" hint="Der Reihe nach aufrufen" color="var(--color-st-waiting)" count={waiting.length} order="order-2 md:order-none" empty="Das Wartezimmer ist leer.">
        {waiting.map((a) => <Card key={a.id} a={a} now={now} tz={tz} back={back} />)}
      </Column>
      <Column title="In Behandlung" hint="Läuft gerade" color="var(--color-st-active)" count={active.length} order="order-1 md:order-none" empty="Niemand in Behandlung.">
        {active.map((a) => <Card key={a.id} a={a} now={now} tz={tz} back={back} />)}
      </Column>
      <Column title="Erledigt" hint="Heute abgeschlossen" color="var(--color-st-done)" count={done.length} order="order-4 md:order-none" empty="Noch nichts erledigt.">
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {shownDone.map((a) => {
            const inf = info(a, now);
            return (
              <li key={a.id}>
                <Link href={`/termine/${a.id}`} className="flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-slate-50">
                  <span className="w-10 text-xs text-slate-500 tabular-nums">{fmtTime(a.starts_at, tz)}</span>
                  <span className="min-w-0 flex-1 truncate">{a.patientName}</span>
                  {a.status === "nicht_erschienen" ? <span className="text-xs font-medium text-warn">nicht erschienen</span> : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Check className="h-3.5 w-3.5 text-st-done" />{inf?.text}</span>
                  )}
                </Link>
              </li>
            );
          })}
          {done.length > shownDone.length && <li className="px-2.5 py-1.5 text-xs text-slate-500">und {done.length - shownDone.length} weitere im Kalender</li>}
        </ul>
      </Column>
    </div>
  );
}
