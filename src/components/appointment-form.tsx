"use client";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { saveAppointment, suggestSlots, type FormState, type Slot } from "@/app/actions/appointments";
import type { AppointmentType, LocationKind, Room, Staff } from "@/lib/types";
import { LOCATION, ROOM_CAPABILITIES, isProvider } from "@/lib/labels";
import { DayPlan } from "@/components/day-plan";

type P = { id: string; first_name: string; last_name: string; birth_date: string | null };
export type AppointmentDefaults = {
  id?: string; patient_id?: string; doctor_id?: string; assistant_id?: string | null; type_id?: string | null; reason?: string;
  date: string; time: string; duration: number; location_kind?: LocationKind; room_id?: string | null; address?: string | null;
  video_url?: string | null; is_emergency?: boolean; notes?: string | null; waitlist_id?: string;
};

const plusDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const dayLabel = (d: string) => new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

const name = (s: { title?: string | null; first_name: string; last_name: string }) => [s.title, s.first_name, s.last_name].filter(Boolean).join(" ");

export function AppointmentForm({ patients, staff, rooms, types, defaults, slot }: {
  patients: P[]; staff: Staff[]; rooms: Room[]; types: AppointmentType[]; defaults: AppointmentDefaults; slot: number;
}) {
  const providers = staff.filter((s) => isProvider(s.role));
  const assistants = staff.filter((s) => !isProvider(s.role));
  const [state, action, pending] = useActionState<FormState, FormData>(saveAppointment, {});
  const [patientId, setPatientId] = useState(defaults.patient_id ?? "");
  const [filter, setFilter] = useState("");
  const [typeId, setTypeId] = useState(defaults.type_id ?? "");
  const [duration, setDuration] = useState(defaults.duration);
  const [loc, setLoc] = useState<LocationKind>(defaults.location_kind ?? "praxis");
  const [repeat, setRepeat] = useState(false);
  const [doctorId, setDoctorId] = useState(defaults.doctor_id ?? (providers.length === 1 ? providers[0].id : ""));
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [weeks, setWeeks] = useState(0);
  const required = types.find((t) => t.id === typeId)?.required_capability ?? null;

  // Nächste freie Zeiten des gewählten Behandlers (Dauer, Sprechzeiten, Abwesenheit, bestehende Termine berücksichtigt)
  useEffect(() => {
    if (!doctorId || !(duration >= 1)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSlots(null);
      const r = await suggestSlots(doctorId, duration, plusDays(defaults.date, weeks * 14), defaults.id).catch(() => [] as Slot[]);
      if (!cancelled) setSlots(r);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [doctorId, duration, weeks, defaults.date, defaults.id]);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f ? patients.filter((p) => `${p.last_name} ${p.first_name} ${p.birth_date ?? ""}`.toLowerCase().includes(f)) : patients;
    return list.slice(0, 200);
  }, [filter, patients]);
  const selected = patients.find((p) => p.id === patientId);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,46rem)_minmax(0,1fr)]">
    <form action={action} className="min-w-0 space-y-4">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      {defaults.waitlist_id && <input type="hidden" name="waitlist_id" value={defaults.waitlist_id} />}
      <input type="hidden" name="patient_id" value={patientId} />

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Patient *</h2>
        {selected ? (
          <div className="flex items-center justify-between rounded-md bg-brand-50 px-3 py-2 text-sm">
            <span><b>{selected.last_name}, {selected.first_name}</b>{selected.birth_date && ` · geb. ${selected.birth_date.split("-").reverse().join(".")}`}</span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setPatientId("")}>Ändern</button>
          </div>
        ) : (
          <div>
            <input className="input" placeholder="Name oder Geburtsdatum tippen, Enter wählt den ersten Treffer" value={filter} onChange={(e) => setFilter(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (shown[0]) setPatientId(shown[0].id); } }} autoFocus />
            <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200 text-sm">
              {shown.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setPatientId(p.id)} className="w-full px-3 py-1.5 text-left hover:bg-brand-50">
                    {p.last_name}, {p.first_name} <span className="text-xs text-slate-500">{p.birth_date?.split("-").reverse().join(".")}</span>
                  </button>
                </li>
              ))}
              {!shown.length && <li className="px-3 py-2 text-slate-500">Kein Treffer. <Link href="/patienten/neu" className="text-brand-700 underline">Neuen Patienten anlegen</Link></li>}
            </ul>
          </div>
        )}
      </section>

      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Termin</h2>
        <label className="block"><span className="label">Behandler *</span>
          <select name="doctor_id" required className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">– wählen –</option>
            {providers.map((s) => <option key={s.id} value={s.id}>{name(s)}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">Termintyp / Leistung</span>
          <select name="type_id" className="input" value={typeId} onChange={(e) => {
            setTypeId(e.target.value);
            const t = types.find((x) => x.id === e.target.value);
            if (t) setDuration(t.default_minutes);
          }}>
            <option value="">– frei –</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.default_minutes} min)</option>)}
          </select>
        </label>

        <div className="sm:col-span-2">
          <span className="label">Nächste freie Zeiten ({duration} min)</span>
          <p className="-mt-0.5 mb-1.5 text-xs text-slate-500">
            Vorschläge im <b>{slot}-Minuten-Takt</b> der Praxis (Terminraster, einstellbar unter Einstellungen → Praxis). Die Uhrzeit unten kann trotzdem minutengenau eingetragen werden.
          </p>
          {!doctorId ? (
            <p className="text-sm text-slate-500">Behandler wählen, dann erscheinen die nächsten freien Zeiten zum Anklicken.</p>
          ) : slots === null ? (
            <p className="text-sm text-slate-500">Suche freie Zeiten …</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-slate-600">In diesem Zeitraum ist keine freie Zeit. Datum und Uhrzeit können unten von Hand eingegeben werden.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {slots.map((s) => {
                const on = s.date === date && s.time === time;
                return (
                  <button type="button" key={`${s.date}${s.time}`} onClick={() => { setDate(s.date); setTime(s.time); }} aria-pressed={on}
                    className={`rounded-md border px-2.5 py-1 text-sm tabular-nums ${on ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white hover:bg-brand-50"}`}>
                    <span className={on ? "text-brand-100" : "text-slate-500"}>{dayLabel(s.date)}</span> <b className="font-semibold">{s.time}</b>
                  </button>
                );
              })}
              <button type="button" className="btn-ghost btn-sm" onClick={() => setWeeks(weeks + 1)}>Spätere Zeiten</button>
              {weeks > 0 && <button type="button" className="btn-ghost btn-sm" onClick={() => setWeeks(0)}>Zurück zum Anfang</button>}
            </div>
          )}
        </div>

        <label className="block"><span className="label">Datum *</span>
          <input type="date" name="date" required className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="label">Uhrzeit *</span>
            <input type="time" name="time" required step={60} className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="block"><span className="label">Dauer (min)</span>
            <input type="number" name="duration" min={1} step={1} className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </label>
        </div>
        <label className="block"><span className="label">Grund {typeId ? "(optional)" : "*"}</span>
          <input name="reason" className="input" defaultValue={defaults.reason} placeholder={typeId ? types.find((t) => t.id === typeId)?.name : "z. B. Rückenschmerzen"} />
        </label>
        <label className="block"><span className="label">Assistenz / MFA</span>
          <select name="assistant_id" className="input" defaultValue={defaults.assistant_id ?? ""}>
            <option value="">– keine –</option>
            {assistants.map((s) => <option key={s.id} value={s.id}>{name(s)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="is_emergency" defaultChecked={defaults.is_emergency} className="accent-rose-600" /> Akut- oder Notfalltermin
        </label>
      </section>

      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Ort</h2>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          {(Object.keys(LOCATION) as LocationKind[]).map((k) => (
            <label key={k} className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${loc === k ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-300"}`}>
              <input type="radio" name="location_kind" value={k} checked={loc === k} onChange={() => setLoc(k)} className="sr-only" />
              {LOCATION[k]}
            </label>
          ))}
        </div>
        {loc === "praxis" && (
          <label className="block sm:col-span-2"><span className="label">Raum</span>
            <select name="room_id" className="input" defaultValue={defaults.room_id ?? "auto"}>
              <option value="auto">Automatisch – freien passenden Raum wählen</option>
              <option value="">Noch offen (Raum beim Aufrufen)</option>
              {rooms.map((r) => {
                const ok = !required || r.capabilities?.includes(required);
                return <option key={r.id} value={r.id} disabled={!ok}>{r.name}{r.capabilities?.length ? ` · ${r.capabilities.map((c) => ROOM_CAPABILITIES[c] ?? c).join(", ")}` : ""}{ok ? "" : " (ungeeignet)"}</option>;
              })}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              {required ? <>Diese Leistung braucht einen Raum mit <b>{ROOM_CAPABILITIES[required] ?? required}</b>. </> : null}
              „Automatisch“ verteilt Termine auf möglichst viele freie Räume; der Arzt kommt in den Raum des Patienten.
            </span>
          </label>
        )}
        {loc === "hausbesuch" && (
          <label className="block sm:col-span-2"><span className="label">Adresse</span>
            <input name="address" className="input" defaultValue={defaults.address ?? ""} placeholder="leer = Patientenadresse" />
          </label>
        )}
        {loc === "video" && (
          <label className="block sm:col-span-2"><span className="label">Video-Link</span>
            <input name="video_url" type="url" className="input" defaultValue={defaults.video_url ?? ""} placeholder="https://…" />
          </label>
        )}
        <label className="block sm:col-span-2"><span className="label">Interne Notiz</span>
          <textarea name="notes" rows={2} className="input" defaultValue={defaults.notes ?? ""} />
        </label>
      </section>

      {!defaults.id && (
        <section className="card space-y-2 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="accent-brand-600" /> Serientermin
          </label>
          {repeat && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input type="number" name="repeat_count" min={2} max={52} defaultValue={6} className="input w-20" /> Termine, alle
              <input type="number" name="repeat_days" min={1} max={90} defaultValue={7} className="input w-20" /> Tage
            </div>
          )}
        </section>
      )}

      {state.error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.error}</p>}
      {state.conflicts && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <b>Bitte prüfen:</b>
          <ul className="ml-4 list-disc">{state.conflicts.map((c) => <li key={c}>{c}</li>)}</ul>
          <button name="force" value="1" className="btn-secondary btn-sm mt-2">Trotzdem speichern (z. B. Notfall, Hausbesuch)</button>
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending || !patientId}>{pending ? "Speichern …" : defaults.id ? "Änderungen speichern" : "Termin anlegen"}</button>
      </div>
    </form>
    <div className="min-w-0 xl:sticky xl:top-16">
      <DayPlan date={date} onDate={setDate} doctorId={doctorId} time={time} duration={duration} slot={slot} excludeId={defaults.id}
        onPick={(d, t) => { setDoctorId(d); setTime(t); }} />
    </div>
    </div>
  );
}
