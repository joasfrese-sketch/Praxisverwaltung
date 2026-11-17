import Link from "next/link";
import { getContext } from "@/lib/context";
import { markNotificationsRead } from "@/app/actions/misc";
import { Badge, Card, Empty, Notice, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { fmtDateTime } from "@/lib/time";

export const metadata = { title: "Benachrichtigungen" };

export default async function Notifications() {
  const { supabase, practice, me } = await getContext();
  const tz = practice.timezone;
  const [{ data: mine }, { data: outbox }] = await Promise.all([
    supabase.from("notifications").select("*").eq("recipient_staff_id", me.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("notifications").select("*, patient:patients(first_name, last_name, email)").eq("practice_id", practice.id)
      .not("recipient_patient_id", "is", null).order("created_at", { ascending: false }).limit(100),
  ]);
  return (
    <>
      <PageHeader title="Benachrichtigungen" actions={<form action={markNotificationsRead}><SubmitButton variant="secondary">Alle als gelesen markieren</SubmitButton></form>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Für mich (In-App)" bodyClass="px-4 py-1">
          {mine?.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {mine.map((n) => (
                <li key={n.id} className={`flex items-start gap-2 py-2 ${n.status === "neu" ? "" : "opacity-60"}`}>
                  {n.status === "neu" && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  <div className="flex-1">
                    {n.appointment_id ? <Link href={`/termine/${n.appointment_id}`} className="font-medium hover:underline">{n.title}</Link> : <span className="font-medium">{n.title}</span>}
                    <div className="text-xs text-slate-500">{n.body} · {fmtDateTime(n.created_at, tz)}</div>
                  </div>
                  {n.status === "neu" && (
                    <form action={markNotificationsRead}><input type="hidden" name="id" value={n.id} /><SubmitButton size="sm" variant="ghost">✓</SubmitButton></form>
                  )}
                </li>
              ))}
            </ul>
          ) : <Empty>Keine Benachrichtigungen.</Empty>}
        </Card>
        <Card title="Patienten-Benachrichtigungen (Ausgang)" bodyClass="px-4 py-2">
          <Notice tone="info">E-Mails werden versendet, sobald der eigene SMTP-Server in den Einstellungen hinterlegt ist. Bis dahin werden sie hier gesammelt.</Notice>
          {outbox?.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {outbox.map((n) => (
                <li key={n.id} className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 font-medium">{n.title}</span>
                    <Badge tone={n.status === "gesendet" ? "emerald" : n.status === "fehler" ? "rose" : "amber"}>{n.status}</Badge>
                  </div>
                  <div className="text-xs text-slate-500">
                    an {n.patient?.last_name}, {n.patient?.first_name} &lt;{n.patient?.email}&gt; · {fmtDateTime(n.created_at, tz)}
                    {n.appointment_id && <> · <Link href={`/termine/${n.appointment_id}`} className="text-brand-700 hover:underline">Termin</Link></>}
                  </div>
                  {n.body && <div className="text-xs text-slate-600">{n.body}</div>}
                </li>
              ))}
            </ul>
          ) : <Empty>Noch nichts im Ausgang.</Empty>}
        </Card>
      </div>
    </>
  );
}
