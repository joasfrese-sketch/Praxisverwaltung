import Link from "next/link";
import { AlarmClock, CalendarX2, Check, ListTodo, type LucideIcon } from "lucide-react";
import { DelayCard } from "@/components/delay-card";
import type { DelaySuggestion } from "@/lib/delays";
import type { Staff } from "@/lib/types";

function Row({ icon: Icon, children, href, action }: { icon: LucideIcon; children: React.ReactNode; href: string; action: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-warn" />
      <div className="min-w-48 flex-1">{children}</div>
      <Link href={href} className="btn-secondary btn-sm">{action}</Link>
    </div>
  );
}

/** Eine einzige Stelle für alles, was jetzt Aufmerksamkeit braucht. Leer = alles im Plan. */
export function Attention({ delays, staffById, tz, absent, freed, waitlist, overdueTasks }: {
  delays: DelaySuggestion[];
  staffById: Map<string, Staff>;
  tz: string;
  absent: { name: string; count: number }[];
  freed: number;
  waitlist: number;
  overdueTasks: number;
}) {
  const nothing = !delays.length && !absent.length && !freed && !overdueTasks;
  if (nothing) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Check className="h-4 w-4 text-st-done" /> Alles im Plan. Keine Verzögerung, kein Ausfall, keine überfälligen Aufgaben.
      </p>
    );
  }
  return (
    <section aria-label="Handlungsbedarf" className="space-y-2">
      {delays.map((d) => <DelayCard key={d.doctorId} d={d} doctor={staffById.get(d.doctorId)} tz={tz} />)}
      {absent.map((a) => (
        <Row key={a.name} icon={AlarmClock} href="/stoerungen" action="Ersatz zuweisen">
          <b>{a.name}</b> ist heute abwesend: {a.count} {a.count === 1 ? "Termin braucht" : "Termine brauchen"} eine Vertretung.
        </Row>
      ))}
      {freed > 0 && (
        <Row icon={CalendarX2} href="/stoerungen" action="Neu vergeben">
          {freed} {freed === 1 ? "Termin ist" : "Termine sind"} frei geworden{waitlist > 0 ? `, ${waitlist} ${waitlist === 1 ? "Patient wartet" : "Patienten warten"} auf der Warteliste` : ""}.
        </Row>
      )}
      {overdueTasks > 0 && (
        <Row icon={ListTodo} href="/aufgaben" action="Aufgaben öffnen">
          {overdueTasks} {overdueTasks === 1 ? "Aufgabe ist" : "Aufgaben sind"} überfällig.
        </Row>
      )}
    </section>
  );
}
