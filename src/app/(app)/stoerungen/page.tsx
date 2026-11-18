import Link from "next/link";
import { getContext } from "@/lib/context";
import { APPT_SELECT, isAbsent, loadAbsences, loadAppointments, loadStaff } from "@/lib/data";
import { detectDelays } from "@/lib/delays";
import { addAbsence, deleteAbsence } from "@/app/actions/organisation";
import { reassign, setStatus } from "@/app/actions/appointments";
import { ABSENCE, ACTIVE_STATUSES } from "@/lib/labels";
import { addDays, dayRange, fmtDate, fmtDateTime, today, toZoned } from "@/lib/time";
import { Card, Empty, Notice, PageHeader, patientName, staffName } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { DelayCard } from "@/components/delay-card";
import { PlanTabs } from "@/components/plan-tabs";
import type { AppointmentWithPatient, Staff } from "@/lib/types";

export const metadata = { title: "Störungen" };

export default async function Disruptions({ searchParams }: PageProps<"/stoerungen">) {
  const sp = await searchParams;
  const { supabase, practice, canManageAbsences } = await getContext();
  const tz = practice.timezone;
  const day = today(tz);
  const horizon = addDays(day, 60);
  const [{ staff, providers, byId }, absences, todayAppts] = await Promise.all([
    loadStaff(supabase, practice.id),
    loadAbsences(supabase, practice.id, day, horizon),
    loadAppointments(supabase, practice.id, dayRange(day, tz).from, dayRange(day, tz).to),
  ]);
  // alle aktiven Termine im Zeitraum der Abwesenheiten
  const affectedAll: AppointmentWithPatient[] = absences.length
    ? await loadAppointments(supabase, practice.id, dayRange(day, tz).from, dayRange(horizon, tz).to)
    : [];
  const { data: cancelled } = await supabase.from("appointments").select(APPT_SELECT).eq("practice_id", practice.id).eq("status", "abgesagt")
    .gte("starts_at", new Date().toISOString()).order("starts_at").limit(20);

  const busy = (staffId: string, a: AppointmentWithPatient) =>
    affectedAll.some((b) => b.doctor_id === staffId && b.id !== a.id && ACTIVE_STATUSES.includes(b.status) && b.starts_at < a.ends_at && b.ends_at > a.starts_at);
  const available = (s: Staff, a: AppointmentWithPatient) => !isAbsent(absences, s.id, toZoned(a.starts_at, tz).date) && !busy(s.id, a);

  const delays = detectDelays(todayAppts.filter((a) => ACTIVE_STATUSES.includes(a.status)));

  return (
    <>
      <PlanTabs active="stoerungen" />
      <PageHeader title="Störungen und Ausfälle" subtitle="Verzögerungen, Ausfälle mit Ersatzpersonal und frei gewordene Termine." />
      {typeof sp.fehler === "string" && <Notice tone="error">{sp.fehler}</Notice>}

      <h2 className="mb-2 text-[15px] font-semibold">Verzögerungen heute</h2>
      <div className="mb-6 space-y-3">
        {delays.length ? delays.map((d) => <DelayCard key={d.doctorId} d={d} doctor={byId.get(d.doctorId)} tz={tz} />) : (
          <div className="card px-4 py-3 text-sm text-slate-500">Keine Verzögerungen erkannt. Die App prüft laufend, ob Behandlungen überziehen oder eingecheckte Patienten über ihre Zeit warten.</div>
        )}
      </div>

      <h2 className="mb-2 text-[15px] font-semibold">Ausfälle & Ersatz</h2>
      {canManageAbsences && (
        <div id="abwesenheit" className="scroll-mt-20"><Card title="Abwesenheit eintragen" className="mb-4">
          <form action={addAbsence} className="grid gap-2 sm:grid-cols-6">
            <select name="staff_id" required className="input sm:col-span-2">
              {staff.map((s) => <option key={s.id} value={s.id}>{staffName(s)}</option>)}
            </select>
            <select name="kind" className="input">
              {Object.entries(ABSENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" name="starts_on" required defaultValue={day} className="input" />
            <input type="date" name="ends_on" defaultValue={day} className="input" />
            <SubmitButton>Eintragen</SubmitButton>
            <input name="note" className="input sm:col-span-6" placeholder="Notiz (optional)" />
          </form>
        </Card></div>
      )}

      <div className="mb-6 space-y-4">
        {absences.length ? absences.map((ab) => {
          const person = byId.get(ab.staff_id);
          const sub = person?.substitute_id ? byId.get(person.substitute_id) : undefined;
          const affected = affectedAll.filter((a) => a.doctor_id === ab.staff_id && ACTIVE_STATUSES.includes(a.status) && toZoned(a.starts_at, tz).date >= ab.starts_on && toZoned(a.starts_at, tz).date <= ab.ends_on);
          const subFree = sub ? affected.filter((a) => available(sub, a)) : [];
          return (
            <Card key={ab.id}
              title={<span>{staffName(person)} · {ABSENCE[ab.kind]} · {fmtDate(ab.starts_on + "T12:00:00Z")}{ab.ends_on !== ab.starts_on && ` – ${fmtDate(ab.ends_on + "T12:00:00Z")}`}</span>}
              actions={canManageAbsences && <form action={deleteAbsence}><input type="hidden" name="id" value={ab.id} /><SubmitButton size="sm" variant="ghost" confirm="Abwesenheit löschen?">Löschen</SubmitButton></form>}
            >
              {ab.note && <p className="mb-2 text-sm text-slate-600">{ab.note}</p>}
              {!affected.length ? <p className="text-sm text-emerald-700">Keine betroffenen Termine.</p> : (
                <>
                  <p className="mb-2 text-sm">
                    <b>{affected.length} betroffene Termine.</b> Vertretung laut Profil: {sub ? <b>{staffName(sub)}</b> : <Link href={`/personal/${ab.staff_id}`} className="text-brand-700 underline">nicht festgelegt</Link>}
                  </p>
                  {sub && subFree.length > 0 && (
                    <form action={reassign} className="mb-3">
                      <input type="hidden" name="doctor_id" value={sub.id} />
                      {subFree.map((a) => <input key={a.id} type="hidden" name="ids" value={a.id} />)}
                      <SubmitButton>Alle {subFree.length} freien an {staffName(sub)} übergeben & Patienten informieren</SubmitButton>
                    </form>
                  )}
                  <ul className="divide-y divide-slate-100 text-sm">
                    {affected.map((a) => {
                      const cands = providers.filter((s) => s.id !== ab.staff_id && available(s, a));
                      return (
                        <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                          <Link href={`/termine/${a.id}`} className="min-w-52 flex-1 hover:underline"><b className="tabular-nums">{fmtDateTime(a.starts_at, tz)}</b> {patientName(a.patient)} – {a.reason}</Link>
                          <form action={reassign} className="flex gap-1">
                            <input type="hidden" name="ids" value={a.id} />
                            <select name="doctor_id" className="input w-48 py-1 text-xs" defaultValue={sub && cands.includes(sub) ? sub.id : cands[0]?.id}>
                              {cands.length ? cands.map((s) => <option key={s.id} value={s.id}>{staffName(s)}{s.id === sub?.id ? " (Vertretung)" : ""}</option>) : <option value="">kein Ersatz frei</option>}
                            </select>
                            <SubmitButton size="sm" variant="secondary">Ersatz</SubmitButton>
                          </form>
                          <form action={setStatus}>
                            <input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="abgesagt" />
                            <input type="hidden" name="cancel_reason" value="Ausfall des Behandlers – bitte vereinbaren Sie einen neuen Termin." />
                            <input type="hidden" name="back" value="/stoerungen" />
                            <SubmitButton size="sm" variant="danger" confirm="Termin absagen und Patient informieren?">Absagen</SubmitButton>
                          </form>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Card>
          );
        }) : <div className="card px-4 py-3 text-sm text-slate-500">Keine Abwesenheiten in den nächsten 60 Tagen.</div>}
      </div>

      <h2 id="slots" className="mb-2 scroll-mt-20 text-[15px] font-semibold">Frei gewordene Termine</h2>
      <Card bodyClass="px-4 py-1">
        {(cancelled ?? []).length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {(cancelled as AppointmentWithPatient[]).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex-1"><b className="tabular-nums">{fmtDateTime(a.starts_at, tz)}</b> · {staffName(byId.get(a.doctor_id))} · war: {patientName(a.patient)} ({a.cancelled_by === "patient" ? "Absage Patient" : "Absage Praxis"})</span>
                <Link href={`/warteliste?frei=${a.id}`} className="btn-primary btn-sm">Slot aus Warteliste vergeben</Link>
              </li>
            ))}
          </ul>
        ) : <Empty>Keine abgesagten zukünftigen Termine.</Empty>}
      </Card>
    </>
  );
}
