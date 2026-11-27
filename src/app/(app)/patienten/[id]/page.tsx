import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarPlus, CreditCard, Pencil, Paperclip } from "lucide-react";
import { getContext } from "@/lib/context";
import { loadStaff } from "@/lib/data";
import { addRecordEntry, assignCare, markCardChecked, removeCare, uploadAttachment } from "@/app/actions/patients";
import { needsCard, quarterOf } from "@/lib/insurance-card";
import { addNote } from "@/app/actions/appointments";
import { Badge, Card, Empty, Notice, PageHeader, StatusBadge, staffName } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { age, fmtDate, fmtDateTime, fmtTime, today } from "@/lib/time";
import type { Appointment, Patient } from "@/lib/types";

export const metadata = { title: "Patientenakte" };

export default async function PatientPage({ params, searchParams }: PageProps<"/patienten/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const kat = typeof sp.kategorie === "string" ? sp.kategorie : "";
  const { supabase, practice, canReadMedical } = await getContext();
  const tz = practice.timezone;
  const { data } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const p = data as Patient;
  const nowIso = new Date().toISOString();
  const [{ providers, byId }, care, upcoming, past, cats, entries, protocols, files, notes, waitlist] = await Promise.all([
    loadStaff(supabase, practice.id, true),
    supabase.from("care_assignments").select("*").eq("patient_id", id),
    supabase.from("appointments").select("*").eq("patient_id", id).gte("starts_at", nowIso).order("starts_at").limit(20),
    supabase.from("appointments").select("*").eq("patient_id", id).lt("starts_at", nowIso).order("starts_at", { ascending: false }).limit(50),
    supabase.from("record_categories").select("*").eq("practice_id", practice.id).order("sort"),
    canReadMedical ? supabase.from("patient_record_entries").select("*").eq("patient_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    canReadMedical ? supabase.from("appointment_protocols").select("*, appointment:appointments!inner(patient_id)").eq("appointment.patient_id", id) : Promise.resolve({ data: [] }),
    canReadMedical ? supabase.from("attachments").select("*").eq("patient_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("notes").select("*").eq("patient_id", id).is("appointment_id", null).order("created_at", { ascending: false }),
    supabase.from("waitlist_entries").select("id").eq("patient_id", id).is("resolved_at", null),
  ]);
  const catById = new Map((cats.data ?? []).map((c) => [c.id, c]));
  const warnings = (entries.data ?? []).filter((e) => e.category_id && catById.get(e.category_id)?.is_warning);
  const noShows = (past.data ?? []).filter((a) => a.status === "nicht_erschienen").length;
  const protoByAppt = new Map<string, typeof protocols.data>();
  for (const pr of protocols.data ?? []) {
    const list = protoByAppt.get(pr.appointment_id) ?? [];
    list.push(pr);
    protoByAppt.set(pr.appointment_id, list);
  }
  const shownEntries = (entries.data ?? []).filter((e) => !kat || e.category_id === kat);
  const assigned = new Set((care.data ?? []).map((c) => c.staff_id));

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2">{p.last_name}, {p.first_name}
          {noShows >= practice.no_show_warn_threshold && <Badge tone="rose">{noShows}× nicht erschienen</Badge>}
          {(waitlist.data ?? []).length > 0 && <Badge tone="amber">auf Warteliste</Badge>}
          {p.created_online && <Badge tone="brand">online angelegt – Stammdaten prüfen</Badge>}
        </span>}
        subtitle={[p.birth_date && `geb. ${fmtDate(p.birth_date + "T12:00:00Z")} (${age(p.birth_date)} J.)`, p.insurance_name ?? p.insurance_type, p.insurance_number].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/termine/neu?patient=${p.id}`} className="btn-primary"><CalendarPlus className="h-4 w-4" /> Termin</Link>
            <Link href={`/warteliste?patient=${p.id}`} className="btn-secondary">Auf Warteliste</Link>
            <Link href={`/patienten/${p.id}/bearbeiten`} className="btn-secondary"><Pencil className="h-4 w-4" /> Stammdaten</Link>
          </>
        }
      />
      {typeof sp.fehler === "string" && <Notice tone="error">{sp.fehler}</Notice>}
      {(p.insurance_type ?? "gesetzlich") === "gesetzlich" && (() => {
        const d0 = today(practice.timezone);
        const missing = needsCard(p, d0);
        return (
          <form action={markCardChecked} className={`mb-4 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${missing ? "border-amber-300 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
            <input type="hidden" name="patient_id" value={p.id} />
            <CreditCard className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              {missing
                ? <>Versichertenkarte für <b>{quarterOf(d0).label}</b> noch nicht vorgelegt{p.card_checked_on ? ` (zuletzt ${fmtDate(p.card_checked_on + "T12:00:00Z")})` : ""}.</>
                : <>Versichertenkarte für <b>{quarterOf(d0).label}</b> vorgelegt am {fmtDate(p.card_checked_on + "T12:00:00Z")}.</>}
              {!p.insurance_type && <span className="text-xs"> Versicherungsart unbekannt – bitte in den Stammdaten eintragen.</span>}
            </span>
            {missing ? <SubmitButton size="sm">Karte vorgelegt</SubmitButton> : <SubmitButton size="sm" variant="ghost" name="undo" value="1">Rückgängig</SubmitButton>}
          </form>
        );
      })()}
      {warnings.length > 0 && (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          <div className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" /> Warnhinweise</div>
          <ul className="ml-5 list-disc">{warnings.map((w) => <li key={w.id}><b>{w.title}</b>{w.content ? ` – ${w.content}` : ""}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Kommende Termine" bodyClass="px-4 py-1">
            {(upcoming.data ?? []).length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {(upcoming.data as Appointment[]).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2">
                    <Link href={`/termine/${a.id}`} className="flex-1 hover:underline"><b className="tabular-nums">{fmtDateTime(a.starts_at, tz)}</b> · {a.reason} · {staffName(byId.get(a.doctor_id))}</Link>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            ) : <Empty>Keine kommenden Termine.</Empty>}
          </Card>

          <Card title="Patientenakte" actions={
            canReadMedical && (
              <div className="flex flex-wrap gap-1 text-xs">
                <Link href={`/patienten/${p.id}`} className={`rounded px-2 py-0.5 ${!kat ? "bg-brand-600 text-white" : "bg-slate-100"}`}>Alle</Link>
                {(cats.data ?? []).map((c) => (
                  <Link key={c.id} href={`/patienten/${p.id}?kategorie=${c.id}`} className={`rounded px-2 py-0.5 ${kat === c.id ? "bg-brand-600 text-white" : "bg-slate-100"}`}>{c.name}</Link>
                ))}
              </div>
            )
          }>
            {!canReadMedical ? <Empty>Keine Berechtigung für medizinische Inhalte.</Empty> : (
              <>
                <details className="mb-4 rounded-md border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-brand-700">+ Eintrag hinzufügen</summary>
                  <form action={addRecordEntry} className="mt-3 grid gap-2 sm:grid-cols-3">
                    <input type="hidden" name="patient_id" value={p.id} />
                    <select name="category_id" className="input" defaultValue={kat}>
                      {(cats.data ?? []).filter((c) => c.name !== "Termine").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input name="title" required className="input sm:col-span-2" placeholder="Titel, z. B. Penicillin-Allergie / ICD M54.5" />
                    <textarea name="content" rows={2} className="input sm:col-span-3" placeholder="Details" />
                    <div><SubmitButton>Speichern</SubmitButton></div>
                  </form>
                </details>
                {shownEntries.length ? (
                  <ol className="relative space-y-3 border-l-2 border-brand-100 pl-4">
                    {shownEntries.map((e) => {
                      const cat = e.category_id ? catById.get(e.category_id) : null;
                      return (
                        <li key={e.id} className="text-sm">
                          <span className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-brand-400" />
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {fmtDateTime(e.created_at, tz)} · {staffName(byId.get(e.author_id))}
                            {cat && <Badge tone={cat.is_warning ? "rose" : "brand"}>{cat.name}</Badge>}
                          </div>
                          <div className="font-medium">
                            {e.appointment_id ? <Link href={`/termine/${e.appointment_id}`} className="hover:underline">{e.title}</Link> : e.title}
                          </div>
                          {e.content && <p className="whitespace-pre-wrap text-slate-700">{e.content}</p>}
                          {e.appointment_id && (protoByAppt.get(e.appointment_id) ?? []).map((pr) => (
                            <div key={pr.id} className="mt-1 rounded bg-slate-50 px-2 py-1 text-slate-700">
                              {Object.entries(pr.structured ?? {}).map(([k, v]) => <div key={k}><b>{k}:</b> {v === true ? "ja" : String(v)}</div>)}
                              {pr.content && <div className="whitespace-pre-wrap">{pr.content}</div>}
                            </div>
                          ))}
                        </li>
                      );
                    })}
                  </ol>
                ) : <Empty>Keine Einträge.</Empty>}
              </>
            )}
          </Card>

          <Card title="Vergangene Termine" bodyClass="px-4 py-1">
            {(past.data ?? []).length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {(past.data as Appointment[]).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-1.5">
                    <Link href={`/termine/${a.id}`} className="flex-1 hover:underline">{fmtDate(a.starts_at, tz)} {fmtTime(a.starts_at, tz)} · {a.reason}</Link>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            ) : <Empty>Keine.</Empty>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Kontakt">
            <dl className="space-y-1.5 text-sm">
              <div><dt className="label">Telefon</dt><dd>{p.phone ? <a href={`tel:${p.phone}`} className="text-brand-700">{p.phone}</a> : "—"}</dd></div>
              <div><dt className="label">E-Mail</dt><dd>{p.email ?? "—"} {p.email && !p.notify_email && <Badge>keine Benachr.</Badge>}</dd></div>
              <div><dt className="label">Adresse</dt><dd>{[p.street, [p.zip, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}</dd></div>
              <div><dt className="label">Notfallkontakt</dt><dd>{p.emergency_contact_name ? `${p.emergency_contact_name} ${p.emergency_contact_phone ?? ""}` : "—"}</dd></div>
              {p.notes && <div><dt className="label">Hinweise</dt><dd className="whitespace-pre-wrap">{p.notes}</dd></div>}
            </dl>
          </Card>

          <Card title="Zugeordnete Behandler">
            <ul className="mb-3 space-y-1 text-sm">
              {(care.data ?? []).map((c) => (
                <li key={c.staff_id} className="flex items-center justify-between gap-2">
                  <span>{staffName(byId.get(c.staff_id))} {c.is_primary && <Badge tone="brand">Haupt</Badge>}</span>
                  <form action={removeCare}>
                    <input type="hidden" name="patient_id" value={p.id} /><input type="hidden" name="staff_id" value={c.staff_id} />
                    <SubmitButton size="sm" variant="ghost">Entfernen</SubmitButton>
                  </form>
                </li>
              ))}
              {!(care.data ?? []).length && <li className="text-slate-500">Noch keine Zuordnung.</li>}
            </ul>
            <form action={assignCare} className="space-y-2">
              <input type="hidden" name="patient_id" value={p.id} />
              <select name="staff_id" className="input" required>
                {providers.filter((s) => !assigned.has(s.id)).map((s) => <option key={s.id} value={s.id}>{staffName(s)}</option>)}
              </select>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="is_primary" className="accent-brand-600" /> Hauptbehandler</label>
              <SubmitButton size="sm" variant="secondary">Zuordnen</SubmitButton>
            </form>
          </Card>

          {canReadMedical && (
            <Card title="Dokumente / Befunde">
              <ul className="mb-3 space-y-1 text-sm">
                {(files.data ?? []).map((f) => (
                  <li key={f.id} className="flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                    <a href={`/anhang/${f.id}`} target="_blank" className="truncate text-brand-700 hover:underline">{f.file_name}</a>
                    <span className="ml-auto shrink-0 text-xs text-slate-500">{fmtDate(f.created_at, tz)}</span>
                  </li>
                ))}
                {!(files.data ?? []).length && <li className="text-slate-500">Keine Dateien.</li>}
              </ul>
              <form action={uploadAttachment} className="space-y-2">
                <input type="hidden" name="patient_id" value={p.id} />
                <input type="file" name="file" required className="block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-brand-100 file:px-2 file:py-1 file:text-brand-800" />
                <SubmitButton size="sm" variant="secondary">Hochladen</SubmitButton>
              </form>
            </Card>
          )}

          <Card title="Angeheftete Nachrichten">
            <form action={addNote} className="mb-3 flex gap-2">
              <input type="hidden" name="patient_id" value={p.id} />
              <input name="body" className="input" placeholder="Nachricht ans Team …" />
              <SubmitButton size="sm">+</SubmitButton>
            </form>
            <ul className="space-y-2 text-sm">
              {(notes.data ?? []).map((n) => (
                <li key={n.id} className="rounded-md bg-slate-50 px-2 py-1.5">
                  <div className="text-xs text-slate-500">{staffName(byId.get(n.author_id))} · {fmtDateTime(n.created_at, tz)}</div>
                  {n.body}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
