import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { loadStaff } from "@/lib/data";
import { saveStaff } from "@/app/actions/admin";
import { addAbsence, decideAbsence, deleteAbsence } from "@/app/actions/organisation";
import { InviteBox } from "@/components/invite-box";
import { Card, Notice, PageHeader, staffName } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ABSENCE, ABSENCE_STATUS, STAFF_COLORS, STAFF_ROLES } from "@/lib/labels";
import { fmtDate, fmtDateTime, today } from "@/lib/time";
import type { Absence, Staff } from "@/lib/types";

export const metadata = { title: "Mitarbeiter" };

export default async function StaffDetail({ params, searchParams }: PageProps<"/personal/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, practice, me, canManageAbsences } = await getContext();
  const { staff, providers } = await loadStaff(supabase, practice.id, true);
  const isNew = id === "neu";
  const s = isNew ? undefined : staff.find((x) => x.id === id);
  if (!isNew && !s) notFound();
  const { data: absences } = isNew ? { data: [] } : await supabase.from("staff_absences").select("*").eq("staff_id", id).gte("ends_on", today(practice.timezone)).order("starts_on");
  const { data: invite } = isNew || !me.is_admin ? { data: null } : await supabase.from("staff_invites").select("created_at").eq("staff_id", id).is("used_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const ro = !me.is_admin;
  const self = s?.id === me.id;
  const v = (k: keyof Staff) => (s?.[k] as string | null) ?? "";

  return (
    <div className="max-w-4xl">
      <PageHeader title={isNew ? "Mitarbeiter anlegen" : staffName(s)} subtitle={s ? STAFF_ROLES[s.role] : undefined} />
      {sp.gespeichert && <Notice tone="success">Gespeichert.</Notice>}
      <form action={saveStaff}>
        {s && <input type="hidden" name="id" value={s.id} />}
        <fieldset disabled={ro} className="card grid gap-3 p-4 sm:grid-cols-3">
          <label className="block"><span className="label">Titel</span><input name="title" className="input" defaultValue={v("title")} /></label>
          <label className="block"><span className="label">Vorname *</span><input name="first_name" required className="input" defaultValue={v("first_name")} /></label>
          <label className="block"><span className="label">Nachname *</span><input name="last_name" required className="input" defaultValue={v("last_name")} /></label>
          <label className="block"><span className="label">Rolle *</span>
            <select name="role" className="input" defaultValue={s?.role ?? "arzt"}>{Object.entries(STAFF_ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <label className="block"><span className="label">Fachrichtung</span><input name="specialty" className="input" defaultValue={v("specialty")} /></label>
          <label className="block"><span className="label">Farbe im Kalender</span>
            <select name="color" className="input" defaultValue={s?.color ?? STAFF_COLORS[0]}>{STAFF_COLORS.map((c) => <option key={c} value={c} style={{ background: c, color: "white" }}>{c}</option>)}</select>
          </label>
          <label className="block"><span className="label">E-Mail</span><input name="email" type="email" className="input" defaultValue={v("email")} /></label>
          <label className="block"><span className="label">Telefon</span><input name="phone" className="input" defaultValue={v("phone")} /></label>
          <label className="block"><span className="label">Vertretung bei Ausfall</span>
            <select name="substitute_id" className="input" defaultValue={s?.substitute_id ?? ""}>
              <option value="">– keine –</option>
              {providers.filter((p) => p.id !== s?.id && p.active).map((p) => <option key={p.id} value={p.id}>{staffName(p)}</option>)}
            </select>
          </label>
          <div className="space-y-1.5 text-sm sm:col-span-3">
            <label className="flex items-center gap-2"><input type="checkbox" name="can_read_medical" defaultChecked={s?.can_read_medical} className="accent-brand-600" /> Darf medizinische Inhalte (Protokolle, Akte, Befunde) lesen und schreiben <span className="text-xs text-slate-500">(Ärzte/Therapeuten immer)</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" name="is_admin" defaultChecked={s?.is_admin} className="accent-brand-600" /> Administrator (Einstellungen, Personal)</label>
            {s && s.id !== me.id && <label className="flex items-center gap-2"><input type="checkbox" name="active" value="off" defaultChecked={!s.active} className="accent-rose-600" /> Deaktiviert (kein Zugriff mehr)</label>}
          </div>
          {!ro && <div><SubmitButton>{isNew ? "Anlegen" : "Speichern"}</SubmitButton></div>}
        </fieldset>
      </form>

      {s && me.is_admin && (
        <Card title="Zugang (Login)" className="mt-4">
          <InviteBox staffId={s.id} defaultEmail={s.email ?? ""} practiceName={practice.name} linked={!!s.user_id} pendingSince={invite ? fmtDateTime(invite.created_at) : null} />
        </Card>
      )}

      {s && (
        <Card title="Abwesenheiten (aktuell & geplant)" className="mt-4">
          <ul className="mb-3 space-y-1 text-sm">
            {((absences ?? []) as Absence[]).map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className="flex-1">{ABSENCE[a.kind]}: {fmtDate(a.starts_on + "T12:00:00Z")} – {fmtDate(a.ends_on + "T12:00:00Z")} {a.note && `(${a.note})`}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ABSENCE_STATUS[a.status].cls}`}>{ABSENCE_STATUS[a.status].label}</span>
                {me.is_admin && a.status === "beantragt" && (
                  <form action={decideAbsence} className="flex gap-1"><input type="hidden" name="id" value={a.id} />
                    <SubmitButton size="sm" name="decision" value="genehmigt">Genehmigen</SubmitButton>
                    <SubmitButton size="sm" variant="secondary" name="decision" value="abgelehnt">Ablehnen</SubmitButton>
                  </form>
                )}
                {(me.is_admin || (a.status === "beantragt" && a.created_by === me.id)) && <form action={deleteAbsence}><input type="hidden" name="id" value={a.id} /><SubmitButton size="sm" variant="ghost">{me.is_admin ? "Löschen" : "Zurückziehen"}</SubmitButton></form>}
              </li>
            ))}
            {!(absences ?? []).length && <li className="text-slate-500">Keine.</li>}
          </ul>
          {(canManageAbsences || self) && (
            <form action={addAbsence} className="grid gap-2 sm:grid-cols-5">
              <input type="hidden" name="staff_id" value={s.id} />
              <select name="kind" className="input">{Object.entries(ABSENCE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input type="date" name="starts_on" required className="input" />
              <input type="date" name="ends_on" className="input" />
              <input name="note" className="input" placeholder="Notiz" />
              <SubmitButton>{me.is_admin ? "Eintragen" : "Beantragen"}</SubmitButton>
            </form>
          )}
          {!me.is_admin && (canManageAbsences || self) && <p className="mt-2 text-xs text-slate-500">Abwesenheiten werden als <b>Antrag</b> gespeichert und gelten erst, wenn ein Admin sie genehmigt.</p>}
        </Card>
      )}
    </div>
  );
}
