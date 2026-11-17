import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getContext } from "@/lib/context";
import { saveCategory, saveOpeningHours, savePractice, saveRoom, saveType, sendTestMail } from "@/app/actions/admin";
import { smtpConfig } from "@/lib/mail";
import { Card, Notice, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PRACTICE_TYPES } from "@/lib/labels";
import type { AppointmentType } from "@/lib/types";

export const metadata = { title: "Einstellungen" };
const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export default async function Settings({ searchParams }: PageProps<"/einstellungen">) {
  const sp = await searchParams;
  const { supabase, practice: p, me, email } = await getContext();
  const cfg = smtpConfig();
  const smtp = cfg ? { host: cfg.host, port: cfg.port, from: cfg.from } : null;
  const [{ data: hours }, { data: rooms }, { data: types }, { data: cats }] = await Promise.all([
    supabase.from("opening_hours").select("*").eq("practice_id", p.id).order("opens"),
    supabase.from("rooms").select("*").eq("practice_id", p.id).eq("active", true).order("sort"),
    supabase.from("appointment_types").select("*").eq("practice_id", p.id).eq("active", true).order("name"),
    supabase.from("record_categories").select("*").eq("practice_id", p.id).order("sort"),
  ]);
  const ro = !me.is_admin;
  const tmpl = (t: AppointmentType) => t.protocol_template.map((f) => (f.type === "textarea" ? f.label : `${f.label} | ${f.type}`)).join("\n");

  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader title="Einstellungen" subtitle={ro ? "Nur Administratoren können Einstellungen ändern." : undefined}
        actions={<Link href="/einstellungen/sicherheit" className="btn-secondary"><ShieldCheck className="h-4 w-4" /> Mein Konto & 2FA</Link>} />
      {sp.gespeichert && <Notice tone="success">Gespeichert.</Notice>}

      <Card title="Praxis & Regeln">
        <form action={savePractice}>
          <fieldset disabled={ro} className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-2"><span className="label">Name</span><input name="name" className="input" defaultValue={p.name} /></label>
            <label className="block"><span className="label">Art der Praxis</span>
              <select name="practice_type" className="input" defaultValue={p.practice_type}>{Object.entries(PRACTICE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="block"><span className="label">Telefon</span><input name="phone" className="input" defaultValue={p.phone ?? ""} /></label>
            <label className="block"><span className="label">E-Mail</span><input name="email" type="email" className="input" defaultValue={p.email ?? ""} /></label>
            <label className="block"><span className="label">Straße</span><input name="street" className="input" defaultValue={p.street ?? ""} /></label>
            <label className="block"><span className="label">PLZ</span><input name="zip" className="input" defaultValue={p.zip ?? ""} /></label>
            <label className="block"><span className="label">Ort</span><input name="city" className="input" defaultValue={p.city ?? ""} /></label>
            <div />
            <label className="block"><span className="label">Terminraster (min)</span><input name="slot_minutes" type="number" min={1} className="input" defaultValue={p.slot_minutes} /></label>
            <label className="block"><span className="label">Puffer zwischen Terminen (min)</span><input name="buffer_minutes" type="number" min={0} className="input" defaultValue={p.buffer_minutes} /></label>
            <label className="block"><span className="label">Akut-Slots pro Tag freihalten</span><input name="emergency_slots_per_day" type="number" min={0} className="input" defaultValue={p.emergency_slots_per_day} /></label>
            <label className="block"><span className="label">Absagefrist Patient (Std.)</span><input name="cancel_deadline_hours" type="number" min={0} className="input" defaultValue={p.cancel_deadline_hours} /></label>
            <label className="block"><span className="label">Erinnerungen (Std. vorher)</span><input name="reminder_hours" className="input" defaultValue={p.reminder_hours.join(", ")} /></label>
            <label className="block"><span className="label">Patient informieren bei Verspätung ab (min)</span><input name="delay_notify_minutes" type="number" min={0} className="input" defaultValue={p.delay_notify_minutes} /></label>
            <label className="block"><span className="label">Warnung ab x „nicht erschienen“</span><input name="no_show_warn_threshold" type="number" min={1} className="input" defaultValue={p.no_show_warn_threshold} /></label>
            {!ro && <div className="sm:col-span-3"><SubmitButton>Speichern</SubmitButton></div>}
          </fieldset>
        </form>
      </Card>

      <Card title="Öffnungs- / Sprechzeiten" className="scroll-mt-20" >
        <form action={saveOpeningHours} id="zeiten">
          <fieldset disabled={ro} className="space-y-2">
            {DAYS.map((d, i) => {
              const h = (hours ?? []).filter((x) => x.weekday === i + 1);
              return (
                <div key={d} className="grid grid-cols-[7rem_1fr] items-center gap-2 text-sm sm:grid-cols-[7rem_repeat(4,8rem)]">
                  <span className="font-medium">{d}</span>
                  <div className="col-span-1 flex gap-1 sm:contents">
                    <input type="time" name={`d${i + 1}_o1`} className="input" defaultValue={h[0]?.opens?.slice(0, 5)} />
                    <input type="time" name={`d${i + 1}_c1`} className="input" defaultValue={h[0]?.closes?.slice(0, 5)} />
                  </div>
                  <span className="sm:hidden" />
                  <div className="col-span-1 flex gap-1 sm:contents">
                    <input type="time" name={`d${i + 1}_o2`} className="input" defaultValue={h[1]?.opens?.slice(0, 5)} />
                    <input type="time" name={`d${i + 1}_c2`} className="input" defaultValue={h[1]?.closes?.slice(0, 5)} />
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-slate-500">Zwei Zeitfenster pro Tag (z. B. Vormittag/Nachmittag). Leer = geschlossen.</p>
            {!ro && <SubmitButton>Zeiten speichern</SubmitButton>}
          </fieldset>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Räume">
          <ul className="mb-3 space-y-1.5">
            {(rooms ?? []).map((r) => (
              <li key={r.id}>
                <form action={saveRoom} className="flex gap-1">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="name" className="input py-1" defaultValue={r.name} disabled={ro} />
                  {!ro && <><SubmitButton size="sm" variant="secondary">✓</SubmitButton><SubmitButton size="sm" variant="ghost" name="delete" value="1" confirm="Raum entfernen?">✕</SubmitButton></>}
                </form>
              </li>
            ))}
          </ul>
          {!ro && <form action={saveRoom} className="flex gap-1"><input name="name" className="input" placeholder="Neuer Raum" /><SubmitButton size="sm">+</SubmitButton></form>}
        </Card>

        <Card title="Kategorien der Patientenakte">
          <ul className="mb-3 space-y-1 text-sm">
            {(cats ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="flex-1">{c.name} {c.is_warning && <span className="text-xs text-rose-700">(Warnhinweis)</span>}</span>
                {!ro && c.name !== "Termine" && <form action={saveCategory}><input type="hidden" name="id" value={c.id} /><SubmitButton size="sm" variant="ghost" name="delete" value="1" confirm="Kategorie löschen?">✕</SubmitButton></form>}
              </li>
            ))}
          </ul>
          {!ro && (
            <form action={saveCategory} className="flex flex-wrap items-center gap-1">
              <input name="name" className="input flex-1" placeholder="Eigene Kategorie, z. B. Impfungen" />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="is_warning" className="accent-rose-600" /> Warnhinweis</label>
              <SubmitButton size="sm">+</SubmitButton>
            </form>
          )}
        </Card>
      </div>

      <Card title="Termintypen / Leistungen & Protokoll-Vorlagen">
        <p className="mb-3 text-xs text-slate-500">Vorlage: ein Feld pro Zeile. Optional Typ anhängen: <code>Blutdruck | text</code>, <code>Impulse | number</code>, <code>Anästhesie | checkbox</code> (Standard: mehrzeiliger Text).</p>
        <div className="space-y-3">
          {[...((types ?? []) as AppointmentType[]), undefined].map((t, i) => (
            <form key={t?.id ?? `neu-${i}`} action={saveType} className={`grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_7rem_6rem] ${t ? "border-slate-200" : "border-dashed border-brand-300"}`}>
              {t && <input type="hidden" name="id" value={t.id} />}
              <fieldset disabled={ro} className="contents">
                <input name="name" className="input" defaultValue={t?.name} placeholder="Neuer Termintyp" />
                <input name="default_minutes" type="number" min={1} className="input" defaultValue={t?.default_minutes ?? p.slot_minutes} title="Standarddauer (min)" />
                <input name="color" type="color" className="input h-9 p-1" defaultValue={t?.color ?? "#6b8bb0"} />
                <textarea name="template" rows={2} className="input sm:col-span-3" defaultValue={t ? tmpl(t) : ""} placeholder="Protokollfelder (eine Zeile pro Feld)" />
                {!ro && (
                  <div className="flex gap-2 sm:col-span-3">
                    <SubmitButton size="sm">{t ? "Speichern" : "Hinzufügen"}</SubmitButton>
                    {t && <SubmitButton size="sm" variant="ghost" name="delete" value="1" confirm="Termintyp entfernen?">Entfernen</SubmitButton>}
                  </div>
                )}
              </fieldset>
            </form>
          ))}
        </div>
      </Card>

      <Card title="E-Mail-Versand (SMTP)" className="scroll-mt-20">
        <div id="email" />
        {typeof sp.mail === "string" && <Notice tone={sp.mail.startsWith("Fehler") ? "error" : "success"}>{sp.mail}</Notice>}
        {smtp ? (
          <div className="space-y-3 text-sm">
            <p className="text-emerald-700">✓ Verbunden mit <b>{smtp.host}:{smtp.port}</b> · Absender <b>{smtp.from}</b></p>
            <p className="text-slate-600">Patienten-E-Mails (Bestätigung, Erinnerung, Verschiebung, Verspätung, Absage) werden alle 5 Minuten automatisch versendet. Medizinische Inhalte (Anlass, Befunde) werden aus Datenschutzgründen nicht per E-Mail übertragen.</p>
            {!ro && (
              <form action={sendTestMail} className="flex flex-wrap gap-2">
                <input name="to" type="email" className="input w-72" placeholder={email} />
                <SubmitButton variant="secondary">Testmail senden</SubmitButton>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-2 text-sm text-slate-600">
            <p className="text-amber-700">SMTP ist noch nicht eingerichtet – Patienten-E-Mails werden im <Link href="/benachrichtigungen" className="underline">Ausgang</Link> gesammelt und nach der Einrichtung automatisch nachgeholt.</p>
            <p>Einrichtung: In Vercel unter <i>Project → Settings → Environment Variables</i> folgende Werte anlegen und neu deployen:</p>
            <code className="block rounded bg-slate-100 p-2 text-xs">SMTP_HOST · SMTP_PORT (465 oder 587) · SMTP_USER · SMTP_PASSWORD · SMTP_FROM</code>
          </div>
        )}
      </Card>
    </div>
  );
}
