import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getContext } from "@/lib/context";
import { isAbsent, loadAbsences, loadAppointments, loadRooms, loadStaff } from "@/lib/data";
import { addDays, dayRange, fmtDay, fmtDayShort, hhmmToMinutes, startOfWeek, today, toZoned, weekday } from "@/lib/time";
import { ABSENCE, isProvider } from "@/lib/labels";
import { PageHeader, staffName } from "@/components/ui";
import { TimeGrid, type GridColumn } from "@/components/time-grid";

export const metadata = { title: "Kalender" };

export default async function CalendarPage({ searchParams }: PageProps<"/kalender">) {
  const sp = await searchParams;
  const { supabase, practice, me } = await getContext();
  const tz = practice.timezone;
  const day = typeof sp.tag === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.tag) ? sp.tag : today(tz);
  const view = sp.ansicht === "woche" ? "woche" : "tag";
  const by = sp.nach === "raum" ? "raum" : "behandler";

  const { staff, providers, byId } = await loadStaff(supabase, practice.id);
  const rooms = await loadRooms(supabase, practice.id);
  const { data: hours } = await supabase.from("opening_hours").select("*").eq("practice_id", practice.id);
  const person = typeof sp.person === "string" ? sp.person : isProvider(me.role) ? me.id : providers[0]?.id;

  const firstDay = view === "woche" ? startOfWeek(day) : day;
  const days = view === "woche" ? Array.from({ length: 7 }, (_, i) => addDays(firstDay, i)) : [day];
  const from = dayRange(days[0], tz).from;
  const to = dayRange(days[days.length - 1], tz).to;
  const [appts, absences] = await Promise.all([
    loadAppointments(supabase, practice.id, from, to, view === "woche" && person ? { doctorId: person } : {}),
    loadAbsences(supabase, practice.id, days[0], days[days.length - 1]),
  ]);

  const openFor = (d: string): [number, number][] =>
    (hours ?? []).filter((h) => h.weekday === weekday(d)).map((h) => [hhmmToMinutes(h.opens), hhmmToMinutes(h.closes)]);
  const allOpen = (hours ?? []).flatMap((h) => [hhmmToMinutes(h.opens), hhmmToMinutes(h.closes)]);
  const startMin = Math.max(0, Math.min(7 * 60, ...allOpen) - 60);
  const endMin = Math.min(24 * 60, Math.max(19 * 60, ...allOpen) + 60);

  const dayOf = (iso: string) => toZoned(iso, tz).date;
  let columns: GridColumn[];
  if (view === "woche") {
    columns = days.map((d) => {
      const ab = person ? isAbsent(absences, person, d) : undefined;
      return {
        key: d, label: fmtDayShort(d), day: d, appts: appts.filter((a) => dayOf(a.starts_at) === d),
        absent: ab ? ABSENCE[ab.kind] : undefined, open: openFor(d), newParams: (person ? { behandler: person } : {}) as Record<string, string>,
      };
    });
  } else if (by === "raum") {
    columns = [
      ...rooms.map((r) => ({ key: r.id, label: r.name, day, appts: appts.filter((a) => a.room_id === r.id), open: openFor(day), newParams: { raum: r.id } })),
      { key: "ohne", label: "Ohne Raum", sub: "Hausbesuch / Video / offen", day, appts: appts.filter((a) => !a.room_id), open: openFor(day), newParams: {} },
    ];
  } else {
    const cols = providers.length ? providers : staff;
    columns = cols.map((s) => {
      const ab = isAbsent(absences, s.id, day);
      return {
        key: s.id, label: staffName(s), sub: s.specialty ?? undefined, color: s.color, day,
        appts: appts.filter((a) => a.doctor_id === s.id), absent: ab ? ABSENCE[ab.kind] : undefined, open: openFor(day), newParams: { behandler: s.id },
      };
    });
  }

  const nowZ = toZoned(new Date(), tz);
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { tag: day, ansicht: view, nach: by, person, ...o };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    return `/kalender?${p}`;
  };
  const step = view === "woche" ? 7 : 1;

  return (
    <>
      <PageHeader
        title="Kalender"
        subtitle={view === "woche" ? `Woche ab ${fmtDay(days[0])}` : fmtDay(day)}
        actions={
          <>
            <div className="flex rounded-md border border-slate-300 bg-white">
              <Link href={q({ tag: addDays(day, -step) })} className="btn-ghost rounded-r-none" aria-label="Zurück"><ChevronLeft className="h-4 w-4" /></Link>
              <Link href={q({ tag: today(tz) })} className="btn-ghost rounded-none border-x border-slate-200">Heute</Link>
              <Link href={q({ tag: addDays(day, step) })} className="btn-ghost rounded-l-none" aria-label="Weiter"><ChevronRight className="h-4 w-4" /></Link>
            </div>
            <form action="/kalender" className="flex">
              <input type="hidden" name="ansicht" value={view} />
              <input type="hidden" name="nach" value={by} />
              {person && <input type="hidden" name="person" value={person} />}
              <input type="date" name="tag" defaultValue={day} className="input w-40" />
              <button className="btn-secondary ml-1">Los</button>
            </form>
            <div className="flex rounded-md border border-slate-300 bg-white text-sm">
              <Link href={q({ ansicht: "tag", nach: "behandler" })} className={`px-3 py-2 ${view === "tag" && by === "behandler" ? "bg-brand-600 text-white" : ""} rounded-l-md`}>Behandler</Link>
              <Link href={q({ ansicht: "tag", nach: "raum" })} className={`px-3 py-2 ${view === "tag" && by === "raum" ? "bg-brand-600 text-white" : ""}`}>Räume</Link>
              <Link href={q({ ansicht: "woche" })} className={`px-3 py-2 ${view === "woche" ? "bg-brand-600 text-white" : ""} rounded-r-md`}>Woche</Link>
            </div>
            {view === "woche" && (
              <form action="/kalender" className="flex">
                <input type="hidden" name="ansicht" value="woche" />
                <input type="hidden" name="tag" value={day} />
                <select name="person" defaultValue={person} className="input w-48">
                  {(providers.length ? providers : staff).map((s) => <option key={s.id} value={s.id}>{staffName(s)}</option>)}
                </select>
                <button className="btn-secondary ml-1">Zeigen</button>
              </form>
            )}
          </>
        }
      />
      <TimeGrid
        columns={columns}
        startMin={startMin}
        endMin={endMin}
        slot={practice.slot_minutes}
        tz={tz}
        nowMin={{ day: nowZ.date, min: nowZ.minutes }}
        colorFor={(a) => byId.get(a.doctor_id)?.color ?? "#64748b"}
      />
      <p className="mt-2 text-xs text-slate-500">Auf eine freie Zeit klicken, um einen Termin anzulegen. Weiße Flächen = Öffnungszeiten, schraffiert = abwesend.</p>
    </>
  );
}
