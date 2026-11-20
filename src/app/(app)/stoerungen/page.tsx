import Link from "next/link";
import { getContext } from "@/lib/context";
import { APPT_SELECT, isAbsent, loadAbsences, loadAppointments, loadStaff } from "@/lib/data";
import { detectDelays } from "@/lib/delays";
import { addAbsence, decideAbsence, deleteAbsence } from "@/app/actions/organisation";
import { reassign, setStatus } from "@/app/actions/appointments";
import { ABSENCE, ACTIVE_STATUSES } from "@/lib/labels";
import { addDays, dayRange, fmtDate, fmtDateTime, today, toZoned } from "@/lib/time";
import { Card, Empty, Notice, PageHeader, patientName, staffName } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { DelayCard } from "@/components/delay-card";
import type { Absence, AppointmentWithPatient, Staff } from "@/lib/types";

export const metadata = { title: "Störungen" };

export default async function Disruptions({ searchParams }: PageProps<"/stoerungen">) {
  const sp = await searchParams;
  const { supabase, practice, me, canManageAbsences } = await getContext();
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
  // offene Anträge: Admins sehen alle, andere nur die eigenen
  let reqQ = supabase.from("staff_absences").select("*").eq("practice_id", practice.id).eq("status", "beantragt").order("starts_on");
  if (!me.is_admin) reqQ = reqQ.or(`created_by.eq.${me.id},staff_id.eq.${me.id}`);
  const { data: reqData } = await reqQ;
  const requests = (reqData ?? []) as Absence[];
  const { data: cancelled } = await supabase.from("appointments").select(APPT_SELECT).eq("practice_id", practice.id).eq("status", "abgesagt")
    .gte("starts_at", new Date().toISOString()).order("starts_at").limit(20);

  const busy = (staffId: string, a: AppointmentWithPatient) =>
    affectedAll.some((b) => b.doctor_id === staffId && b.id !== a.id && ACTIVE_STATUSES.includes(b.status) && b.starts_at < a.ends_at && b.ends_at > a.starts_at);
  const available = (s: Staff, a: AppointmentWithPatient) => !isAbsent(absences, s.id, toZoned(a.starts_at, tz).date) && !busy(s.id, a);

  const delays = detectDelays(todayAppts.filter((a) => ACTIVE_STATUSES.includes(a.status)));

  return (
    <>
      <PageHeader title="Störungen und Ausfälle" subtitle="Verzögerungen, Ausfälle mit Ersatzpersonal und frei gewordene Termine." />
      {typeof sp.fehler === "string" && <Notice tone="error">{sp.fehler}</Notice>}

      <h2 className="mb-2 text-[0.9375rem] font-semibold">Verzögerungen heute</h2>
      <div className="mb-6 space-y-3">
        {delays.length ? delays.map((d) => <DelayCard key={d.doctorId} d={d} doctor={byId.get(d.doctorId)} tz={tz} />) : (
          <div className="card px-4 py-3 text-sm text-slate-500">Keine Verzögerungen erkannt. Die App prüft laufend, ob Behandlungen überziehen oder eingecheckte Patienten über ihre Zeit warten.</div>
        )}
      </div>

      <h2 className="mb-2 text-[0.9375rem] font-semibold">Ausfälle & Ersatz <span className="font-normal text-slate-500 text-sm">(genehmigte Abwesenheiten)</span></h2>
      {requests.length > 0 && (
        <Card title={me.is_admin ? `Offene Abwesenheitsanträge (${requests.length})` : "Meine offenen Anträge"} className="mb-4 border-amber-300" bodyClass="px-4 py-1">
          <ul className="divide-y divide-slate-100 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-52 flex-1">
                  <b>{staffName(byId.get(r.staff_id))}</b> · {ABSENCE[r.kind]} · {fmtDate(r.starts_on + "T12:00:00Z")}{r.ends_on !== r.starts_on && ` – ${fmtDate(r.ends_on + "T12:00:00Z")}`}
                  {r.note && <span className="text-slate-500"> · {r.note}</span>}
                  {r.created_by && r.created_by !== r.staff_id && <span className="text-xs text-slate-500"> (beantragt von {staffName(byId.get(r.created_by))})</span>}
                </span>
                {me.is_admin ? (
                  <form action={decideAbsence} className="flex flex-wrap gap-1">
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton size="sm" name="decision" value="genehmigt">Genehmigen</SubmitButton>
                    <SubmitButton size="sm" variant="secondary" name="decision" value="abgelehnt">Ablehnen</SubmitButton>
                  </form>
                ) : (
                  <>
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">wartet auf Admin</span>
                    {r.created_by === me.id && <form action={deleteAbsence}><input type="hidden" name="id" value={r.id} /><SubmitButton size="sm" variant="ghost">Zurückziehen</SubmitButton></form>}
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {(
        <div id="abwesenheit" className="scroll-mt-20"><Card title={me.is_admin ? "Abwesenheit eintragen" : "Abwesenheit beantragen"} className="mb-4">
          {!me.is_admin && <p className="mb-2 text-xs text-slate-500">Dein Antrag geht an die Admins. Erst nach der Genehmigung gilt die Abwesenheit im Kalender.</p>}
          <form action={addAbsence} className="grid gap-2 sm:grid-cols-6">
            <select name="staff_id" required className="input sm:col-span-2" defaultValue={me.id}>
              {(canManageAbsences ? staff : staff.filter((s) => s.id === me.id)).map((s) => <option key={s.id} value={s.id}>{staffName(s)}</option>)}
            </select>
            <select name="kind" className="input">
              {Object.entries(ABSENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" name="starts_on" required defaultValue={day} className="input" />
            <input type="date" name="ends_on" defaultValue={day} className="input" />
            <SubmitButton>{me.is_admin ? "Eintragen" : "Beantragen"}</SubmitButton>
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
              actions={me.is_admin && <form action={deleteAbsence}><input type="hidden" name="id" value={ab.id} /><SubmitButton size="sm" variant="ghost" confirm="Abwesenheit löschen?">Löschen</SubmitButton></form>}
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

      <h2 id="slots" className="mb-2 scroll-mt-20 text-[0.9375rem] font-semibold">Frei gewordene Termine</h2>
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
