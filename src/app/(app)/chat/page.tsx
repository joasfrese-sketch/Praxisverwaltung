import Link from "next/link";
import { Users } from "lucide-react";
import { getContext } from "@/lib/context";
import { loadStaff } from "@/lib/data";
import { STAFF_ROLES } from "@/lib/labels";
import { fmtDate, fmtTime, today, toZoned } from "@/lib/time";
import { PageHeader, staffName } from "@/components/ui";
import { ChatComposer, ScrollToEnd } from "./composer";

export const metadata = { title: "Chat" };

type Msg = { id: string; sender_id: string; recipient_id: string | null; body: string; created_at: string };

export default async function ChatPage({ searchParams }: PageProps<"/chat">) {
  const sp = await searchParams;
  const { supabase, practice, me } = await getContext();
  const tz = practice.timezone;
  const peer = typeof sp.mit === "string" && sp.mit ? sp.mit : "team";
  const { staff, byId } = await loadStaff(supabase, practice.id);
  const colleagues = staff.filter((s) => s.id !== me.id && s.active);
  const other = peer === "team" ? null : byId.get(peer);

  let q = supabase.from("chat_messages").select("id, sender_id, recipient_id, body, created_at").eq("practice_id", practice.id)
    .order("created_at", { ascending: false }).limit(200);
  q = peer === "team" ? q.is("recipient_id", null)
    : q.or(`and(sender_id.eq.${me.id},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${me.id})`);
  const [{ data }, { data: unreadRows }] = await Promise.all([
    q,
    supabase.rpc("chat_unread", { p_practice: practice.id }),
  ]);
  const msgs = ((data ?? []) as Msg[]).reverse();
  const unread = new Map(((unreadRows ?? []) as { peer: string; unread: number }[]).map((r) => [r.peer, Number(r.unread)]));
  unread.delete(peer);
  // Lesestand für das geöffnete Gespräch aktualisieren
  await supabase.from("chat_reads").upsert({ staff_id: me.id, peer, last_read_at: new Date().toISOString() });

  const d0 = today(tz);
  const convo = (id: string, label: string, sub: string | null, color?: string) => {
    const active = peer === id;
    const n = unread.get(id) ?? 0;
    return (
      <Link key={id} href={id === "team" ? "/chat" : `/chat?mit=${id}`} aria-current={active ? "page" : undefined}
        className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm lg:w-full ${active ? "bg-brand-100 font-medium text-brand-900" : "hover:bg-slate-100"}`}>
        {id === "team" ? <Users className="h-4 w-4 text-brand-700" /> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{label}</span>
          {sub && <span className="hidden truncate text-xs font-normal text-slate-500 lg:block">{sub}</span>}
        </span>
        {n > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-brand-900">{n}</span>}
      </Link>
    );
  };

  const days = msgs.map((m) => toZoned(m.created_at, tz).date);
  return (
    <>
      <PageHeader title="Chat" subtitle="Kurze Abstimmung im Team. Befunde und Medizinisches gehören in die Patientenakte." />
      <div className="grid gap-3 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Gespräche" className="card flex gap-1 overflow-x-auto p-1.5 lg:flex-col lg:overflow-visible">
          {convo("team", "Team (alle)", "Für alle sichtbar")}
          {colleagues.map((s) => convo(s.id, staffName(s), STAFF_ROLES[s.role], s.color))}
        </nav>
        <section className="card flex h-[calc(100dvh-15rem)] min-h-80 flex-col lg:h-[calc(100dvh-11rem)]">
          <header className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold">
            {other ? `Direktnachricht mit ${staffName(other)}` : "Team-Kanal"}
          </header>
          <ScrollToEnd count={msgs.length}>
            {msgs.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Noch keine Nachrichten. Schreib die erste!</p>}
            {msgs.map((m, i) => {
              const mine = m.sender_id === me.id;
              const showDay = i === 0 || days[i] !== days[i - 1];
              return (
                <div key={m.id}>
                  {showDay && <div className="my-3 text-center text-xs text-slate-500">{days[i] === d0 ? "Heute" : fmtDate(m.created_at, tz)}</div>}
                  <div className={`mb-1.5 flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm sm:max-w-[70%] ${mine ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-900"}`}>
                      {!mine && peer === "team" && <div className="text-xs font-semibold" style={{ color: byId.get(m.sender_id)?.color }}>{staffName(byId.get(m.sender_id))}</div>}
                      <p className="break-words whitespace-pre-wrap">{m.body}</p>
                      <div className={`text-right text-[0.6875rem] ${mine ? "text-brand-100" : "text-slate-500"}`}>{fmtTime(m.created_at, tz)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </ScrollToEnd>
          <ChatComposer to={peer} placeholder={other ? `Nachricht an ${staffName(other)}` : "Nachricht an alle"} />
        </section>
      </div>
    </>
  );
}
