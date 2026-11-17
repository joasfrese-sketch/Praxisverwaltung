import Link from "next/link";
import { LogOut, Plus, Search } from "lucide-react";
import { getContext } from "@/lib/context";
import { Nav } from "@/components/nav";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { staffName } from "@/components/ui";
import { STAFF_ROLES } from "@/lib/labels";
import { switchPractice } from "@/app/actions/misc";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase, me, practice, practices } = await getContext();
  const [{ count: unread }, { count: openTasks }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_staff_id", me.id).eq("status", "neu"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("practice_id", practice.id).is("done_at", null).eq("assignee_id", me.id),
  ]);

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 z-30 flex h-14 items-center justify-between bg-brand-800 px-3 lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:items-stretch lg:justify-start lg:gap-4 lg:px-3 lg:py-4">
        <Link href="/" className="flex items-center gap-2 px-2 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-7 w-7" />
          <span className="truncate font-semibold">{practice.name}</span>
        </Link>
        <Nav badges={{ "/benachrichtigungen": unread ?? 0, "/aufgaben": openTasks ?? 0 }} />
        <div className="mt-auto hidden space-y-2 border-t border-brand-700 pt-3 lg:block">
          {practices.length > 1 && (
            <form action={switchPractice}>
              <select name="practice_id" defaultValue={practice.id} className="input bg-brand-700 text-xs text-white border-brand-600">
                {practices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn-ghost btn-sm mt-1 text-brand-100">Praxis wechseln</button>
            </form>
          )}
          <div className="px-2 text-sm text-white">{staffName(me)}</div>
          <div className="px-2 text-xs text-brand-200">{STAFF_ROLES[me.role]}{me.is_admin ? " · Admin" : ""}</div>
          <form action="/auth/abmelden" method="post">
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-brand-100 hover:bg-brand-700">
              <LogOut className="h-4 w-4" /> Benutzer wechseln
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="sticky top-14 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur lg:top-0">
          <form action="/patienten" className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-slate-400" />
            <input name="q" placeholder="Patient suchen (Name, Geburtsdatum, Versichertennr.)" className="input pl-8" />
          </form>
          <Link href="/termine/neu" className="btn-primary"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Termin</span></Link>
          <Link href="/patienten/neu" className="btn-secondary"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Patient</span></Link>
          <form action="/auth/abmelden" method="post" className="lg:hidden">
            <button className="btn-ghost" aria-label="Abmelden"><LogOut className="h-4 w-4" /></button>
          </form>
        </div>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
      <RealtimeRefresh practiceId={practice.id} />
    </div>
  );
}
