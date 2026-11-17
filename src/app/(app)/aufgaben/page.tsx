import Link from "next/link";
import { getContext } from "@/lib/context";
import { loadStaff } from "@/lib/data";
import { saveTask, toggleTask } from "@/app/actions/organisation";
import { Badge, Card, Empty, PageHeader, patientName, staffName } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { today } from "@/lib/time";

export const metadata = { title: "Aufgaben" };

export default async function Tasks({ searchParams }: PageProps<"/aufgaben">) {
  const sp = await searchParams;
  const filter = sp.filter === "alle" ? "alle" : sp.filter === "erledigt" ? "erledigt" : "meine";
  const { supabase, practice, me } = await getContext();
  const day = today(practice.timezone);
  let q = supabase.from("tasks").select("*, patient:patients(id, first_name, last_name)").eq("practice_id", practice.id).order("due_date", { nullsFirst: false }).limit(200);
  if (filter === "erledigt") q = q.not("done_at", "is", null).order("done_at", { ascending: false });
  else q = q.is("done_at", null);
  if (filter === "meine") q = q.or(`assignee_id.eq.${me.id},assignee_id.is.null`);
  const [{ data }, { staff, byId }, { data: patients }] = await Promise.all([
    q,
    loadStaff(supabase, practice.id),
    supabase.from("patients").select("id, first_name, last_name").eq("practice_id", practice.id).order("last_name").limit(5000),
  ]);
  return (
    <>
      <PageHeader title="Aufgaben" subtitle="To-dos im Team, z. B. „Befund anfordern“, „Rückruf“."
        actions={<div className="flex rounded-md border border-slate-300 bg-white text-sm">
          {(["meine", "alle", "erledigt"] as const).map((f) => (
            <Link key={f} href={`/aufgaben?filter=${f}`} className={`px-3 py-1.5 capitalize first:rounded-l-md last:rounded-r-md ${filter === f ? "bg-brand-600 text-white" : ""}`}>{f}</Link>
          ))}
        </div>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" bodyClass="px-4 py-1">
          {data?.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.map((t) => (
                <li key={t.id} className="flex items-start gap-3 py-2">
                  <form action={toggleTask} className="pt-0.5">
                    <input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value={t.done_at ? "0" : "1"} />
                    <button className={`h-5 w-5 rounded border ${t.done_at ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-400 hover:border-brand-500"}`} aria-label="Erledigt">{t.done_at ? "✓" : ""}</button>
                  </form>
                  <div className="flex-1">
                    <div className={`font-medium ${t.done_at ? "text-slate-400 line-through" : ""}`}>{t.title}</div>
                    <div className="text-xs text-slate-500">
                      {t.patient && <><Link href={`/patienten/${t.patient.id}`} className="text-brand-700 hover:underline">{patientName(t.patient)}</Link> · </>}
                      {t.assignee_id ? staffName(byId.get(t.assignee_id)) : "Alle"}
                      {t.description && ` · ${t.description}`}
                    </div>
                  </div>
                  {t.due_date && <Badge tone={!t.done_at && t.due_date < day ? "rose" : "slate"}>{t.due_date.split("-").reverse().join(".")}</Badge>}
                </li>
              ))}
            </ul>
          ) : <Empty>Keine Aufgaben.</Empty>}
        </Card>
        <Card title="Neue Aufgabe">
          <form action={saveTask} className="space-y-2">
            <input name="title" required className="input" placeholder="Titel" />
            <textarea name="description" rows={2} className="input" placeholder="Beschreibung" />
            <select name="assignee_id" className="input" defaultValue={me.id}>
              <option value="">Alle (Team)</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{staffName(s)}</option>)}
            </select>
            <select name="patient_id" className="input" defaultValue="">
              <option value="">– ohne Patientenbezug –</option>
              {(patients ?? []).map((p) => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
            </select>
            <label className="block"><span className="label">Fällig</span><input type="date" name="due_date" className="input" /></label>
            <SubmitButton>Anlegen</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
