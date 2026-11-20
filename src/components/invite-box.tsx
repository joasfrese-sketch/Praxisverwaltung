"use client";
import { useActionState, useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { createInvite, type InviteState } from "@/app/actions/invites";

export function InviteBox({ staffId, defaultEmail, practiceName, linked, pendingSince }: {
  staffId: string; defaultEmail: string; practiceName: string; linked: boolean; pendingSince: string | null;
}) {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvite, null);
  const [copied, setCopied] = useState(false);

  if (linked) return <p className="text-sm text-emerald-700">✓ Konto verknüpft – diese Person kann sich anmelden.</p>;

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600">
        Erzeugt einen persönlichen Link (7 Tage gültig, nur einmal nutzbar). Die Person öffnet ihn, gibt <strong>genau diese E-Mail</strong> ein
        und wählt ein Passwort – eine Bestätigungsmail ist nicht nötig.
      </p>
      {pendingSince && !state?.link && <p className="text-amber-700">Es gibt bereits eine offene Einladung (erstellt {pendingSince}). Eine neue ersetzt sie.</p>}
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="staff_id" value={staffId} />
        <label className="block min-w-56 flex-1"><span className="label">E-Mail der Person</span>
          <input name="email" type="email" required className="input" defaultValue={defaultEmail} />
        </label>
        <button className="btn-primary" disabled={pending}>{pending ? "…" : "Einladungslink erstellen"}</button>
      </form>
      {state?.error && <p className="text-rose-700">{state.error}</p>}
      {state?.link && (
        <div className="rounded-md border border-brand-200 bg-brand-50 p-3">
          <p className="mb-1 font-medium text-brand-900">Link für {state.email} – nur jetzt sichtbar:</p>
          <input readOnly value={state.link} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={async () => { await navigator.clipboard.writeText(state.link!); setCopied(true); }}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Kopiert" : "Kopieren"}
            </button>
            <a className="btn-secondary btn-sm" href={`mailto:${state.email}?subject=${encodeURIComponent(`Einladung: ${practiceName}`)}&body=${encodeURIComponent(`Hallo,\n\nhier ist dein Zugang zur Praxisverwaltung von ${practiceName}:\n${state.link}\n\nLink öffnen, deine E-Mail-Adresse eingeben und ein Passwort wählen. Der Link ist 7 Tage gültig.`)}`}>
              <Mail size={14} /> Per E-Mail senden
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
