import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Pencil, Video, MapPin, DoorOpen } from "lucide-react";
import { getContext } from "@/lib/context";
import { loadStaff } from "@/lib/data";
import { addNote, addProtocol, setStatus } from "@/app/actions/appointments";
import { Card, Empty, PageHeader, StatusBadge, staffName, patientName, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { QuickStatus } from "@/components/appointment-row";
import { EVENT_LABELS, LOCATION, STATUS } from "@/lib/labels";
import { fmtDateTime, fmtDay, fmtTime, minutesBetween, toZoned } from "@/lib/time";
import type { Appointment, AppointmentType, Patient } from "@/lib/types";

export const metadata = { title: "Termin" };

export default async function AppointmentPage({ params }: PageProps<"/termine/[id]">) {
  const { id } = await params;
  const { supabase, practice, canReadMedical } = await getContext();
  const tz = practice.timezone;
  const { data } = await supabase
    .from("appointments")
    .select("*, patient:patients(*), room:rooms(name), type:appointment_types(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const a = data as Appointment & { patient: Patient; room: { name: string } | null; type: AppointmentType | null };
  const [{ byId }, events, protocols, notes] = await Promise.all([
    loadStaff(supabase, practice.id, true),
    supabase.from("appointment_events").select("*").eq("appointment_id", id).order("created_at", { ascending: false }),
    canReadMedical ? supabase.from("appointment_protocols").select("*").eq("appointment_id", id).order("created_at") : Promise.resolve({ data: [] }),
    supabase.from("notes").select("*").eq("appointment_id", id).order("created_at", { ascending: false }),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const planned = minutesBetween(a.starts_at, a.ends_at);
  const actual = a.actual_start && a.actual_end ? minutesBetween(a.actual_start, a.actual_end) : null;
  const doc = byId.get(a.doctor_id);
  const template = a.type?.protocol_template ?? [];
  const active = ["geplant", "bestaetigt", "eingecheckt", "in_behandlung"].includes(a.status);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2">{a.reason} <StatusBadge status={a.status} />{a.is_emergency && <Badge tone="rose">Akut</Badge>}</span>}
        subtitle={`${fmtDay(toZoned(a.starts_at, tz).date)}, ${fmtTime(a.starts_at, tz)}–${fmtTime(a.ends_at, tz)} Uhr`}
        actions={
          <>
            <QuickStatus a={a} back={`/termine/${a.id}`} />
            <Link href={`/termine/${a.id}/bearbeiten`} className="btn-secondary"><Pencil className="h-4 w-4" /> Bearbeiten / Verschieben</Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Details">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="label">Patient</dt><dd><Link href={`/patienten/${a.patient.id}`} className="font-medium text-brand-700 hover:underline">{patientName(a.patient)}</Link>{a.patient.birth_date && <span className="text-slate-500"> · {a.patient.birth_date.split("-").reverse().join(".")}</span>}</dd></div>
              <div><dt className="label">Behandler</dt><dd className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: doc?.color }} />{staffName(doc)}</dd></div>
              <div><dt className="label">Assistenz</dt><dd>{a.assistant_id ? staffName(byId.get(a.assistant_id)) : "—"}</dd></div>
              <div><dt className="label">Ort</dt><dd className="flex items-center gap-1.5">
                {a.location_kind === "video" ? <Video className="h-4 w-4" /> : a.location_kind === "hausbesuch" ? <MapPin className="h-4 w-4" /> : <DoorOpen className="h-4 w-4" />}
                {LOCATION[a.location_kind]}{a.room ? ` · ${a.room.name}` : ""}
                {a.location_kind === "hausbesuch" && ` · ${a.address ?? [a.patient.street, a.patient.zip, a.patient.city].filter(Boolean).join(", ")}`}
                {a.video_url && <a href={a.video_url} target="_blank" className="text-brand-700 underline">Link</a>}
              </dd></div>
              <div><dt className="label">Aufwand geplant</dt><dd>{planned} min</dd></div>
              <div><dt className="label">Aufwand tatsächlich</dt><dd>{actual != null ? `${actual} min` : a.actual_start ? `läuft seit ${fmtTime(a.actual_start, tz)}` : "—"}</dd></div>
              {a.delay_minutes > 0 && <div><dt className="label">Verzögerung</dt><dd className="text-amber-700">+{a.delay_minutes} min</dd></div>}
              {a.ticket_number && <div><dt className="label">Wartenummer</dt><dd>#{a.ticket_number} (Check-in {a.checked_in_at && fmtTime(a.checked_in_at, tz)})</dd></div>}
              <div><dt className="label">Patientenbestätigung</dt><dd>{a.patient_confirmed_at ? `bestätigt ${fmtDateTime(a.patient_confirmed_at, tz)}` : "ausstehend"}</dd></div>
              {a.status === "abgesagt" && <div><dt className="label">Abgesagt durch</dt><dd>{a.cancelled_by === "patient" ? "Patient" : "Praxis"}{a.cancel_reason ? ` – ${a.cancel_reason}` : ""}</dd></div>}
              {a.notes && <div className="sm:col-span-2"><dt className="label">Interne Notiz</dt><dd className="whitespace-pre-wrap">{a.notes}</dd></div>}
            </dl>
          </Card>

          <Card title="Protokoll">
            {!canReadMedical ? (
              <Empty>Keine Berechtigung für medizinische Inhalte.</Empty>
            ) : (
              <>
                {(protocols.data ?? []).length ? (
                  <ol className="mb-4 space-y-3">
                    {(protocols.data ?? []).map((p) => (
                      <li key={p.id} className="rounded-md border border-slate-200 p-3 text-sm">
                        <div className="mb-1 text-xs text-slate-500">{fmtDateTime(p.created_at, tz)} · {staffName(byId.get(p.author_id))}</div>
                        {Object.entries(p.structured ?? {}).map(([k, v]) => (
                          <div key={k}><b>{template.find((f) => f.key === k)?.label ?? k}:</b> {v === true ? "ja" : String(v)}</div>
                        ))}
                        {p.content && <p className="mt-1 whitespace-pre-wrap">{p.content}</p>}
                      </li>
                    ))}
                  </ol>
                ) : <p className="mb-3 text-sm text-slate-500">Noch kein Protokoll.</p>}
                <form action={addProtocol} className="space-y-2">
                  <input type="hidden" name="appointment_id" value={a.id} />
                  {template.map((f) =>
                    f.type === "checkbox" ? (
                      <label key={f.key} className="flex items-center gap-2 text-sm"><input type="checkbox" name={`field_${f.key}`} className="accent-brand-600" /> {f.label}</label>
                    ) : (
                      <label key={f.key} className="block"><span className="label">{f.label}</span>
                        {f.type === "textarea" ? <textarea name={`field_${f.key}`} rows={2} className="input" /> : <input name={`field_${f.key}`} type={f.type === "number" ? "number" : "text"} className="input" />}
                      </label>
                    ),
                  )}
                  <label className="block"><span className="label">{template.length ? "Weitere Notizen" : "Protokoll"}</span>
                    <textarea name="content" rows={3} className="input" />
                  </label>
                  <SubmitButton>Protokolleintrag speichern</SubmitButton>
                  <p className="text-xs text-slate-500">Einträge sind revisionssicher und können nicht nachträglich geändert werden – Korrekturen als neuen Eintrag erfassen.</p>
                </form>
              </>
            )}
          </Card>

          <Card title="Angeheftete Nachrichten">
            <form action={addNote} className="mb-3 flex gap-2">
              <input type="hidden" name="appointment_id" value={a.id} />
              <input type="hidden" name="patient_id" value={a.patient.id} />
              <input name="body" className="input" placeholder="Nachricht ans Team zu diesem Termin …" />
              <SubmitButton>Senden</SubmitButton>
            </form>
            <ul className="space-y-2 text-sm">
              {(notes.data ?? []).map((n) => (
                <li key={n.id} className="rounded-md bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-500">{staffName(byId.get(n.author_id))} · {fmtDateTime(n.created_at, tz)}</div>
                  {n.body}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          {active && (
            <Card title="Status ändern">
              <div className="flex flex-wrap gap-2">
                {(["bestaetigt", "eingecheckt", "in_behandlung", "abgeschlossen", "nicht_erschienen"] as const)
                  .filter((s) => s !== a.status)
                  .map((s) => (
                    <form key={s} action={setStatus}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="status" value={s} />
                      <input type="hidden" name="back" value={`/termine/${a.id}`} />
                      <SubmitButton size="sm" variant="secondary">{STATUS[s].label}</SubmitButton>
                    </form>
                  ))}
              </div>
              <form action={setStatus} className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="status" value="abgesagt" />
                <input type="hidden" name="back" value={`/termine/${a.id}`} />
                <input name="cancel_reason" className="input" placeholder="Absagegrund (an Patient)" />
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="to_waitlist" value="1" defaultChecked className="accent-brand-600" /> Danach freien Slot aus Warteliste vergeben</label>
                <SubmitButton variant="danger" size="sm" confirm="Termin wirklich absagen?">Termin absagen</SubmitButton>
              </form>
            </Card>
          )}

          <Card title="Patienten-Link">
            <p className="mb-2 text-xs text-slate-500">Über diesen Link kann der Patient den Termin bestätigen oder (bis {practice.cancel_deadline_hours} h vorher) absagen.</p>
            <input readOnly className="input text-xs" value={`${origin}/t/${a.public_token}`} />
          </Card>

          <Card title="Verlauf">
            <ol className="space-y-2 text-sm">
              {(events.data ?? []).map((e) => (
                <li key={e.id} className="border-l-2 border-brand-200 pl-3">
                  <div className="font-medium">{EVENT_LABELS[e.kind] ?? e.kind}</div>
                  <div className="text-xs text-slate-500">
                    {e.kind === "status" && `${STATUS[e.details.von as keyof typeof STATUS]?.label} → ${STATUS[e.details.nach as keyof typeof STATUS]?.label}${e.details.durch === "patient" ? " (durch Patient)" : ""} · `}
                    {(e.kind === "verschoben" || e.kind === "verspaetung") && `${e.details.minuten > 0 ? "+" : ""}${e.details.minuten} min · `}
                    {e.kind === "behandler_gewechselt" && `${staffName(byId.get(e.details.von))} → ${staffName(byId.get(e.details.nach))} · `}
                    {fmtDateTime(e.created_at, tz)} · {e.actor_id ? staffName(byId.get(e.actor_id)) : "System/Patient"}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
