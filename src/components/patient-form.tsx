"use client";
import { useActionState } from "react";
import { savePatient } from "@/app/actions/patients";
import type { Patient, Staff } from "@/lib/types";

function F({ p, name, label, type = "text", className = "", ...rest }: {
  p?: Patient; name: keyof Patient; label: string; type?: string; className?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <label className={`block ${className}`}><span className="label">{label}</span>
      <input name={name} type={type} className="input" defaultValue={(p?.[name] as string | null) ?? ""} {...rest} />
    </label>
  );
}

export function PatientForm({ p, providers }: { p?: Patient; providers?: Staff[] }) {
  const [state, action, pending] = useActionState(savePatient, {});
  return (
    <form action={action} className="space-y-4">
      {p && <input type="hidden" name="id" value={p.id} />}
      <section className="card grid gap-3 p-4 sm:grid-cols-3">
        <h2 className="text-sm font-semibold sm:col-span-3">Stammdaten</h2>
        <F p={p} name="first_name" label="Vorname *" required />
        <F p={p} name="last_name" label="Nachname *" required />
        <F p={p} name="birth_date" label="Geburtsdatum" type="date" />
        <label className="block"><span className="label">Geschlecht</span>
          <select name="gender" className="input" defaultValue={p?.gender ?? ""}>
            <option value="">–</option><option value="w">weiblich</option><option value="m">männlich</option><option value="d">divers</option>
          </select>
        </label>
        <F p={p} name="phone" label="Telefon" type="tel" />
        <F p={p} name="email" label="E-Mail" type="email" />
        <F p={p} name="street" label="Straße" />
        <F p={p} name="zip" label="PLZ" />
        <F p={p} name="city" label="Ort" />
        {!p && providers && (
          <label className="block sm:col-span-3"><span className="label">Hauptbehandler</span>
            <select name="primary_doctor" className="input">
              <option value="">– später –</option>
              {providers.map((s) => <option key={s.id} value={s.id}>{[s.title, s.first_name, s.last_name].filter(Boolean).join(" ")}</option>)}
            </select>
          </label>
        )}
      </section>
      <section className="card grid gap-3 p-4 sm:grid-cols-3">
        <h2 className="text-sm font-semibold sm:col-span-3">Versicherung & Notfall</h2>
        <label className="block"><span className="label">Versicherungsart</span>
          <select name="insurance_type" className="input" defaultValue={p?.insurance_type ?? ""}>
            <option value="">–</option><option value="gesetzlich">gesetzlich</option><option value="privat">privat</option><option value="selbstzahler">Selbstzahler</option>
          </select>
        </label>
        <F p={p} name="insurance_name" label="Krankenkasse" />
        <F p={p} name="insurance_number" label="Versichertennummer" />
        <F p={p} name="emergency_contact_name" label="Notfallkontakt" />
        <F p={p} name="emergency_contact_phone" label="Notfall-Telefon" type="tel" />
      </section>
      <section className="card grid gap-3 p-4 sm:grid-cols-3">
        <h2 className="text-sm font-semibold sm:col-span-3">Benachrichtigungen</h2>
        <label className="flex items-center gap-2 text-sm sm:col-span-3">
          <input type="checkbox" name="notify_email" defaultChecked={p?.notify_email ?? true} className="accent-brand-600" /> Per E-Mail informieren (Bestätigung, Erinnerung, Änderungen)
        </label>
        <label className="block"><span className="label">Erinnerung (Std. vorher)</span>
          <input name="reminder_hours" className="input" defaultValue={p?.reminder_hours?.join(", ") ?? ""} placeholder="Praxis-Standard, z. B. 24, 2" />
        </label>
        <label className="block"><span className="label">Bei Verspätung ab (min)</span>
          <input name="delay_notify_minutes" type="number" min={0} className="input" defaultValue={p?.delay_notify_minutes ?? ""} placeholder="Praxis-Standard" />
        </label>
        <label className="block sm:col-span-3"><span className="label">Organisatorische Hinweise</span>
          <textarea name="notes" rows={2} className="input" defaultValue={p?.notes ?? ""} placeholder="z. B. braucht Rollstuhl, nur vormittags" />
        </label>
      </section>
      {state.error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Speichern …" : p ? "Speichern" : "Patient anlegen"}</button>
    </form>
  );
}
