import Link from "next/link";
import { getContext } from "@/lib/context";
import { loadStaff, loadTypes } from "@/lib/data";
import { addWaitlist, resolveWaitlist } from "@/app/actions/organisation";
import { Badge, Card, Empty, PageHeader, patientName, staffName } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PlanTabs } from "@/components/plan-tabs";
import { fmtDate, fmtDateTime, minutesBetween, toZoned } from "@/lib/time";
import type { Appointment } from "@/lib/types";

export const metadata = { title: "Warteliste" };

type Entry = {
  id: string; patient_id: string; doctor_id: string | null; type_id: string | null; note: string | null; earliest_date: string | null;
  latest_date: string | null; priority: number; created_at: string;
  patient: { id: string; first_name: string; last_name: string; phone: string | null } | null;
};

export default async function Waitlist({ searchParams }: PageProps<"/warteliste">) {
  const sp = await searchParams;
  const { supabase, practice } = await getContext();
  const tz = practice.timezone;
  const [{ providers, byId }, types, { data }, { data: patients }] = await Promise.all([
    loadStaff(supabase, practice.id),
    loadTypes(supabase, practice.id),
    supabase.from("waitlist_entries").select("*, patient:patients(id, first_name, last_name, phone)").eq("practice_id", practice.id)
      .is("resolved_at", null).order("priority", { ascending: false }).order("created_at"),
    supabase.from("patients").select("id, first_name, last_name, birth_date").eq("practice_id", practice.id).order("last_name").limit(5000),
  ]);
  const entries = (data ?? []) as Entry[];
  const typeName = new Map(types.map((t) => [t.id, t.name]));

  let slot: Appointment | null = null;
  if (typeof sp.frei === "string") {
    const { data: a } = await supabase.from("appointments").select("*").eq("id", sp.frei).maybeSingle();
    slot = a as Appointment | null;
  }
  const slotDay = slot ? toZoned(slot.starts_at, tz).date : null;
  const matches = slot
    ? entries
        .filter((e) => (!e.doctor_id || e.doctor_id === slot!.doctor_id) && (!e.earliest_date || e.earliest_date <= slotDay!) && (!e.latest_date || e.latest_date >= slotDay!) && e.patient_id !== slot!.patient_id)
        .map((e) => ({ e, score: (e.doctor_id === slot!.doctor_id ? 2 : 0) + (e.type_id && e.type_id === slot!.type_id ? 2 : 0) + e.priority }))
        .sort((a, b) => b.score - a.score)
    : [];

  const bookLink = (e: Entry) => {
    const z = toZoned(slot!.starts_at, tz);
    const p = new URLSearchParams({
      patient: e.patient_id, datum: z.date, zeit: z.time, behandler: slot!.doctor_id, dauer: String(minutesBetween(slot!.starts_at, slot!.ends_at)), warteliste: e.id,
    });
    if (slot!.room_id) p.set("raum", slot!.room_id);
    if (e.type_id ?? slot!.type_id) p.set("typ", (e.type_id ?? slot!.type_id)!);
    return `/termine/neu?${p}`;
  };

  return (
    <>
      <PlanTabs active="warteliste" />
      <PageHeader title="Warteliste" subtitle="Patienten, die kurzfristig einen frei werdenden Termin übernehmen möchten." />

      {slot && (
        <Card title={`Freier Slot: ${fmtDateTime(slot.starts_at, tz)} · ${staffName(byId.get(slot.doctor_id))} · ${minutesBetween(slot.starts_at, slot.ends_at)} min`} className="mb-4 border-brand-300">
          {matches.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {matches.map(({ e }) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="flex-1">
                    <b>{patientName(e.patient)}</b> {e.patient?.phone && <a href={`tel:${e.patient.phone}`} className="text-brand-700">{e.patient.phone}</a>}
                    <span className="text-slate-500"> · {e.type_id ? typeName.get(e.type_id) : "beliebig"}{e.note ? ` · ${e.note}` : ""}</span>
                    {e.priority > 0 && <Badge tone="amber">Priorität</Badge>}
                  </span>
                  <Link href={bookLink(e)} className="btn-primary btn-sm">Termin vergeben</Link>
                </li>
              ))}
            </ul>
          ) : <Empty>Kein passender Eintrag auf der Warteliste.</Empty>}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`Offene Einträge (${entries.length})`} className="lg:col-span-2" bodyClass="px-4 py-1">
          {entries.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {entries.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                  <div className="flex-1">
                    <Link href={`/patienten/${e.patient_id}`} className="font-medium hover:underline">{patientName(e.patient)}</Link>
                    {e.priority > 0 && <Badge tone="amber">Priorität</Badge>}
                    <div className="text-xs text-slate-500">
                      {e.doctor_id ? staffName(byId.get(e.doctor_id)) : "Behandler egal"} · {e.type_id ? typeName.get(e.type_id) : "Leistung egal"}
                      {(e.earliest_date || e.latest_date) && ` · ${e.earliest_date ? fmtDate(e.earliest_date + "T12:00:00Z") : "…"} – ${e.latest_date ? fmtDate(e.latest_date + "T12:00:00Z") : "…"}`}
                      {e.note && ` · ${e.note}`} · seit {fmtDate(e.created_at, tz)}
                    </div>
                  </div>
                  <form action={resolveWaitlist}><input type="hidden" name="id" value={e.id} /><SubmitButton size="sm" variant="ghost">Erledigt</SubmitButton></form>
                </li>
              ))}
            </ul>
          ) : <Empty>Warteliste ist leer.</Empty>}
        </Card>

        <Card title="Patient hinzufügen">
          <form action={addWaitlist} className="space-y-2">
            <select name="patient_id" required className="input" defaultValue={typeof sp.patient === "string" ? sp.patient : ""}>
              <option value="">– Patient –</option>
              {(patients ?? []).map((p) => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
            </select>
            <select name="doctor_id" className="input">
              <option value="">Behandler egal</option>
              {providers.map((s) => <option key={s.id} value={s.id}>{staffName(s)}</option>)}
            </select>
            <select name="type_id" className="input">
              <option value="">Leistung egal</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="label">frühestens</span><input type="date" name="earliest_date" className="input" /></label>
              <label className="block"><span className="label">spätestens</span><input type="date" name="latest_date" className="input" /></label>
            </div>
            <input name="note" className="input" placeholder="Notiz, z. B. nur vormittags" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="priority" value="1" className="accent-brand-600" /> dringend</label>
            <SubmitButton>Auf Warteliste setzen</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
