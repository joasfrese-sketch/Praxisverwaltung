import Link from "next/link";
import { getContext } from "@/lib/context";
import { Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { age } from "@/lib/time";

export const metadata = { title: "Patienten" };

export default async function Patients({ searchParams }: PageProps<"/patienten">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const { supabase, practice } = await getContext();
  let query = supabase.from("patients").select("id, first_name, last_name, birth_date, phone, insurance_type, insurance_name, city")
    .eq("practice_id", practice.id).order("last_name").order("first_name").limit(200);
  if (q) {
    const de = q.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (de) query = query.eq("birth_date", `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}`);
    else {
      const term = q.replace(/[%,()]/g, " ");
      query = query.or(`last_name.ilike.%${term}%,first_name.ilike.%${term}%,insurance_number.ilike.%${term}%,phone.ilike.%${term}%`);
    }
  }
  const { data } = await query;
  return (
    <>
      <PageHeader title="Patienten" subtitle={q ? `Suche: „${q}“` : "Alle Patienten der Praxis"} actions={<LinkButton href="/patienten/neu" variant="primary">Neuer Patient</LinkButton>} />
      <Card bodyClass="p-0">
        {data?.length ? (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Geburtsdatum</th><th className="hidden px-4 py-2 md:table-cell">Telefon</th><th className="hidden px-4 py-2 md:table-cell">Versicherung</th><th className="hidden px-4 py-2 lg:table-cell">Ort</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-brand-50/50">
                  <td className="px-4 py-2"><Link href={`/patienten/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.last_name}, {p.first_name}</Link></td>
                  <td className="px-4 py-2 tabular-nums">{p.birth_date ? `${p.birth_date.split("-").reverse().join(".")} (${age(p.birth_date)})` : "—"}</td>
                  <td className="hidden px-4 py-2 md:table-cell">{p.phone ?? "—"}</td>
                  <td className="hidden px-4 py-2 md:table-cell">{p.insurance_name ?? p.insurance_type ?? "—"}</td>
                  <td className="hidden px-4 py-2 lg:table-cell">{p.city ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>{q ? "Keine Treffer." : "Noch keine Patienten angelegt."}</Empty>}
      </Card>
    </>
  );
}
