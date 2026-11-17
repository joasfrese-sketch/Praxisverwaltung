import Link from "next/link";
import { getContext } from "@/lib/context";
import { loadAbsences, loadAppointments, loadStaff } from "@/lib/data";
import { detectDelays } from "@/lib/delays";
import { dayRange, fmtDay, fmtDateTime, fmtTime, today } from "@/lib/time";
import { ACTIVE_STATUSES, ABSENCE, isProvider } from "@/lib/labels";
import { Card, Empty, Notice, PageHeader, staffName, patientName, Badge } from "@/components/ui";
import { AppointmentRow } from "@/components/appointment-row";
import { DelayCard } from "@/components/delay-card";
import { markNotificationsRead } from "@/app/actions/misc";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Mein Tag" };

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const { supabase, practice, me } = await getContext();
  const tz = practice.timezone;
  const day = today(tz);
  const { from, to } = dayRange(day, tz);
  const [appts, { byId }, absences, tasksRes, notesRes] = await Promise.all([
    loadAppointments(supabase, practice.id, from, to),
    loadStaff(supabase, practice.id),
    loadAbsences(supabase, practice.id, day, day),
    supabase.from("tasks").select("*, patient:patients(first_name,last_name)").eq("practice_id", practice.id).is("done_at", null)
      .or(`assignee_id.eq.${me.id},assignee_id.is.null`).order("due_date", { nullsFirst: false }).limit(8),
    supabase.from("notifications").select("*").eq("recipient_staff_id", me.id).eq("status", "neu").order("created_at", { ascending: false }).limit(6),
  ]);
  const provider = isProvider(me.role);
  const mine = provider ? appts.filter((a) => a.doctor_id === me.id) : appts;
  const delays = detectDelays(appts.filter((a) => ACTIVE_STATUSES.includes(a.status)));
  const waiting = appts.filter((a) => a.status === "eingecheckt");
  const affectedByAbsence = appts.filter((a) => ACTIVE_STATUSES.includes(a.status) && absences.some((ab) => ab.staff_id === a.doctor_id));
  const open = mine.filter((a) => ACTIVE_STATUSES.includes(a.status)).length;
  const done = mine.filter((a) => a.status === "abgeschlossen").length;

  return (
    <>
      <PageHeader
        title={`Guten ${new Date().getHours() < 11 ? "Morgen" : new Date().getHours() < 17 ? "Tag" : "Abend"}, ${me.title ? me.title + " " : ""}${me.last_name}`}
        subtitle={fmtDay(day)}
      />
      {sp.willkommen && (
        <Notice tone="success">
          Praxis angelegt! Nächste Schritte: <Link className="underline" href="/einstellungen">Öffnungszeiten & Regeln prüfen</Link>,{" "}
          <Link className="underline" href="/personal">Team ergänzen</Link>, <Link className="underline" href="/patienten/neu">ersten Patienten anlegen</Link>.
        </Notice>
      )}
      {typeof sp.fehler === "string" && <Notice tone="error">{sp.fehler}</Notice>}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: provider ? "Meine Termine heute" : "Termine heute", value: mine.length },
          { label: "Offen", value: open },
          { label: "Im Wartezimmer", value: waiting.length },
          { label: "Abgeschlossen", value: done },
        ].map((k) => (
          <div key={k.label} className="card px-4 py-3">
            <div className="text-2xl font-semibold text-brand-700 tabular-nums">{k.value}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {delays.length > 0 && (
        <div className="mb-4 space-y-3">
          {delays.map((d) => <DelayCard key={d.doctorId} d={d} doctor={byId.get(d.doctorId)} tz={tz} />)}
        </div>
      )}
      {affectedByAbsence.length > 0 && (
        <Notice tone="warning">
          {affectedByAbsence.length} Termin(e) heute bei abwesendem Personal. <Link href="/stoerungen" className="font-medium underline">Ersatz zuweisen →</Link>
        </Notice>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={provider ? "Meine Termine heute" : "Alle Termine heute"}
          actions={<Link href="/kalender" className="text-xs text-brand-700 hover:underline">Kalender →</Link>}
          bodyClass="px-4 py-1"
        >
          {mine.length ? (
            <ul className="divide-y divide-slate-100">
              {mine.map((a) => <AppointmentRow key={a.id} a={a} doctor={byId.get(a.doctor_id)} tz={tz} showDoctor={!provider} />)}
            </ul>
          ) : (
            <Empty>Heute keine Termine.</Empty>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Wartezimmer" actions={<Link href="/wartezimmer" className="text-xs text-brand-700 hover:underline">Öffnen →</Link>} bodyClass="px-4 py-2">
            {waiting.length ? (
              <ul className="space-y-1.5 text-sm">
                {waiting.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <Link href={`/termine/${a.id}`} className="truncate hover:underline">#{a.ticket_number} {patientName(a.patient)}</Link>
                    <span className="shrink-0 text-xs text-slate-500">seit {a.checked_in_at ? fmtTime(a.checked_in_at, tz) : "–"}</span>
                  </li>
                ))}
              </ul>
            ) : <Empty>Niemand wartet.</Empty>}
          </Card>

          <Card title="Benachrichtigungen" actions={notesRes.data?.length ? (
            <form action={markNotificationsRead}><SubmitButton size="sm" variant="ghost">Alle gelesen</SubmitButton></form>
          ) : null} bodyClass="px-4 py-2">
            {notesRes.data?.length ? (
              <ul className="space-y-2 text-sm">
                {notesRes.data.map((n) => (
                  <li key={n.id}>
                    <Link href={n.appointment_id ? `/termine/${n.appointment_id}` : "/benachrichtigungen"} className="font-medium hover:underline">{n.title}</Link>
                    <div className="text-xs text-slate-500">{n.body} · {fmtDateTime(n.created_at, tz)}</div>
                  </li>
                ))}
              </ul>
            ) : <Empty>Keine neuen Benachrichtigungen.</Empty>}
          </Card>

          <Card title="Meine Aufgaben" actions={<Link href="/aufgaben" className="text-xs text-brand-700 hover:underline">Alle →</Link>} bodyClass="px-4 py-2">
            {tasksRes.data?.length ? (
              <ul className="space-y-1.5 text-sm">
                {tasksRes.data.map((t) => (
                  <li key={t.id} className="flex justify-between gap-2">
                    <span className="truncate">{t.title}{t.patient ? ` – ${patientName(t.patient)}` : ""}</span>
                    {t.due_date && <Badge tone={t.due_date < day ? "rose" : "slate"}>{t.due_date.split("-").reverse().join(".")}</Badge>}
                  </li>
                ))}
              </ul>
            ) : <Empty>Keine offenen Aufgaben.</Empty>}
          </Card>

          {absences.length > 0 && (
            <Card title="Heute abwesend" bodyClass="px-4 py-2">
              <ul className="space-y-1 text-sm">
                {absences.map((a) => (
                  <li key={a.id}>{staffName(byId.get(a.staff_id))} <span className="text-xs text-slate-500">({ABSENCE[a.kind]})</span></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
