import Link from "next/link";
import { getContext } from "@/lib/context";
import { loadAbsences, loadStaff } from "@/lib/data";
import { Badge, Card, Notice, PageHeader, staffName } from "@/components/ui";
import { ABSENCE, STAFF_ROLES } from "@/lib/labels";
import { isAbsent } from "@/lib/data";
import { today } from "@/lib/time";

export const metadata = { title: "Personal" };

export default async function StaffPage({ searchParams }: PageProps<"/personal">) {
  const sp = await searchParams;
  const { supabase, practice, me } = await getContext();
  const day = today(practice.timezone);
  const [{ staff, byId }, absences] = await Promise.all([loadStaff(supabase, practice.id, true), loadAbsences(supabase, practice.id, day, day)]);
  return (
    <>
      <PageHeader title="Personal" subtitle="Ärzte, Therapeuten und Praxisteam mit Rollen, Rechten und Vertretung."
        actions={me.is_admin && <Link href="/personal/neu" className="btn-primary">Mitarbeiter anlegen</Link>} />
      {typeof sp.fehler === "string" && <Notice tone="error">{sp.fehler}</Notice>}
      <Card bodyClass="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
            <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Rolle</th><th className="hidden px-4 py-2 md:table-cell">Vertretung</th><th className="hidden px-4 py-2 md:table-cell">Login</th><th className="px-4 py-2">Heute</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map((s) => {
              const ab = isAbsent(absences, s.id, day);
              return (
                <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                  <td className="px-4 py-2">
                    <Link href={`/personal/${s.id}`} className="flex items-center gap-2 font-medium text-brand-700 hover:underline">
                      <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />{staffName(s)}
                    </Link>
                    {s.specialty && <div className="text-xs text-slate-500">{s.specialty}</div>}
                  </td>
                  <td className="px-4 py-2">{STAFF_ROLES[s.role]} {s.is_admin && <Badge tone="brand">Admin</Badge>} {s.can_read_medical && !["arzt", "therapeut"].includes(s.role) && <Badge>Akte</Badge>}</td>
                  <td className="hidden px-4 py-2 md:table-cell">{s.substitute_id ? staffName(byId.get(s.substitute_id)) : "—"}</td>
                  <td className="hidden px-4 py-2 md:table-cell">{s.user_id ? <Badge tone="emerald">aktiv</Badge> : s.email ? <Badge tone="amber">eingeladen</Badge> : <Badge>ohne Login</Badge>}</td>
                  <td className="px-4 py-2">{!s.active ? "inaktiv" : ab ? <Badge tone="rose">{ABSENCE[ab.kind]}</Badge> : <Badge tone="emerald">anwesend</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-500">Eingeladene Mitarbeiter registrieren sich mit der hinterlegten E-Mail-Adresse und werden automatisch zugeordnet.</p>
    </>
  );
}
