import Link from "next/link";
import type { AppointmentWithPatient } from "@/lib/types";
import { toZoned, minutesToHhmm } from "@/lib/time";
import { STATUS } from "@/lib/labels";

export interface GridColumn {
  key: string;
  label: string;
  sub?: string;
  color?: string;
  day: string;
  appts: AppointmentWithPatient[];
  absent?: string;            // Abwesenheitsgrund
  open: [number, number][];   // Öffnungszeiten in Minuten
  newParams: Record<string, string>;
}

const PX = 1.4; // Pixel pro Minute

function lanes(appts: AppointmentWithPatient[]) {
  const sorted = [...appts].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const ends: string[] = [];
  const res = new Map<string, { lane: number; of: number }>();
  const groups: string[][] = [];
  let group: string[] = [];
  let groupEnd = "";
  for (const a of sorted) {
    if (group.length && a.starts_at >= groupEnd) {
      groups.push(group);
      group = [];
      ends.length = 0;
    }
    let lane = ends.findIndex((e) => e <= a.starts_at);
    if (lane === -1) lane = ends.length;
    ends[lane] = a.ends_at;
    res.set(a.id, { lane, of: 0 });
    group.push(a.id);
    if (a.ends_at > groupEnd || group.length === 1) groupEnd = a.ends_at > groupEnd ? a.ends_at : groupEnd;
  }
  if (group.length) groups.push(group);
  for (const g of groups) {
    const of = Math.max(...g.map((id) => res.get(id)!.lane)) + 1;
    g.forEach((id) => (res.get(id)!.of = of));
  }
  return res;
}

export function TimeGrid({ columns, startMin, endMin, slot, tz, nowMin, colorFor }: {
  columns: GridColumn[]; startMin: number; endMin: number; slot: number; tz: string; nowMin?: { day: string; min: number };
  colorFor: (a: AppointmentWithPatient) => string;
}) {
  const height = (endMin - startMin) * PX;
  const hours: number[] = [];
  for (let m = Math.ceil(startMin / 60) * 60; m < endMin; m += 60) hours.push(m);
  const slotStep = Math.max(slot, 5);
  const slots: number[] = [];
  for (let m = startMin; m < endMin; m += slotStep) slots.push(m);

  return (
    <div className="card overflow-x-auto">
      <div className="flex min-w-fit">
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-slate-200 bg-white">
          <div className="h-12 border-b border-slate-200" />
          <div className="relative" style={{ height }}>
            {hours.map((m) => (
              <div key={m} className="absolute right-1 -translate-y-1/2 text-[11px] text-slate-400 tabular-nums" style={{ top: (m - startMin) * PX }}>
                {minutesToHhmm(m)}
              </div>
            ))}
          </div>
        </div>
        {columns.map((c) => {
          const lay = lanes(c.appts);
          return (
            <div key={c.key} className="min-w-40 flex-1 border-r border-slate-100 last:border-r-0">
              <div className="flex h-12 flex-col justify-center border-b border-slate-200 px-2">
                <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {c.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />}
                  {c.label}
                </div>
                <div className="truncate text-[11px] text-slate-500">{c.absent ? <span className="font-medium text-rose-700">Abwesend: {c.absent}</span> : c.sub}</div>
              </div>
              <div className={`relative ${c.absent ? "hatch" : "bg-slate-50"}`} style={{ height }}>
                {c.open.map(([o, e], i) => (
                  <div key={i} className={`absolute inset-x-0 ${c.absent ? "" : "bg-white"}`} style={{ top: (Math.max(o, startMin) - startMin) * PX, height: (Math.min(e, endMin) - Math.max(o, startMin)) * PX }} />
                ))}
                {hours.map((m) => <div key={m} className="absolute inset-x-0 border-t border-slate-200" style={{ top: (m - startMin) * PX }} />)}
                {slots.map((m) => (
                  <Link
                    key={m}
                    href={`/termine/neu?${new URLSearchParams({ ...c.newParams, datum: c.day, zeit: minutesToHhmm(m) })}`}
                    className="group absolute inset-x-0 hover:bg-brand-50"
                    style={{ top: (m - startMin) * PX, height: slotStep * PX }}
                    title={`Neuer Termin ${minutesToHhmm(m)}`}
                  >
                    <span className="hidden pl-1 text-[10px] text-brand-600 group-hover:inline">+ {minutesToHhmm(m)}</span>
                  </Link>
                ))}
                {nowMin && nowMin.day === c.day && nowMin.min > startMin && nowMin.min < endMin && (
                  <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-rose-500" style={{ top: (nowMin.min - startMin) * PX }} />
                )}
                {c.appts.map((a) => {
                  const s = toZoned(a.starts_at, tz).minutes;
                  const dur = (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000;
                  const l = lay.get(a.id)!;
                  const top = Math.max(0, (s - startMin) * PX);
                  const color = colorFor(a);
                  return (
                    <Link
                      key={a.id}
                      href={`/termine/${a.id}`}
                      className={`absolute z-10 overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-[11px] leading-tight shadow-xs ring-1 ring-inset hover:z-30 hover:shadow-md ${STATUS[a.status].cls}`}
                      style={{
                        top, height: Math.max(dur * PX - 2, 16), borderLeftColor: color,
                        left: `calc(${(l.lane / l.of) * 100}% + 2px)`, width: `calc(${100 / l.of}% - 4px)`,
                      }}
                      title={`${a.patient?.last_name}, ${a.patient?.first_name} – ${a.reason}`}
                    >
                      <div className="truncate font-semibold">
                        {toZoned(a.starts_at, tz).time} {a.patient?.last_name}, {a.patient?.first_name}
                        {a.is_emergency && " ⚠"}
                      </div>
                      <div className="truncate opacity-80">{a.reason}{a.delay_minutes ? ` · +${a.delay_minutes}′` : ""}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
