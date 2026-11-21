import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, LogOut, Plus, UserPlus } from "lucide-react";
import { SideNav } from "./side-nav";
import { BottomNav } from "./bottom-nav";
import { CommandBar } from "./command-bar";
import { PresenceCheck, type PresenceCandidate } from "./presence-check";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { switchPractice } from "@/app/actions/misc";

export interface ShellProps {
  practiceName: string;
  practiceId: string;
  practices: { id: string; name: string }[];
  user: { name: string; role: string };
  unread: number;
  tasks: number;
  chat?: number;
  realtime?: boolean;
  presence?: { candidates: PresenceCandidate[]; askAfterMinutes: number; nowIso: string; tz: string };
  children: ReactNode;
}

export function AppShell({ practiceName, practiceId, practices, user, unread, tasks, chat = 0, realtime = true, presence, children }: ShellProps) {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden bg-brand-900 text-slate-300 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-auto lg:shrink-0 lg:flex-col lg:px-2.5 lg:py-4">
        <Link href="/" className="mb-5 flex items-center gap-2.5 px-2 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-7 w-7 shrink-0" />
          <span className="w-0 flex-1 truncate text-[0.9375rem] font-semibold" title={practiceName}>{practiceName}</span>
        </Link>
        <SideNav tasks={tasks} chat={chat} />
        <div className="mt-auto space-y-2 border-t border-white/10 pt-3">
          {practices.length > 1 && (
            <form action={switchPractice} className="flex w-0 min-w-full gap-1 px-1">
              <select name="practice_id" defaultValue={practiceId} className="min-w-0 flex-1 rounded-md border border-white/20 bg-white/5 px-2 py-1 text-xs text-white" aria-label="Praxis">
                {practices.map((p) => <option key={p.id} value={p.id} className="text-slate-900">{p.name}</option>)}
              </select>
              <button className="rounded-md px-2 text-xs text-slate-300 hover:bg-white/10">Wechseln</button>
            </form>
          )}
          <Link href="/einstellungen/sicherheit" className="block w-0 min-w-full rounded-md px-2 py-1 hover:bg-white/10" title="Mein Konto: Schriftgröße, 2FA">
            <div className="truncate text-sm font-medium text-white">{user.name}</div>
            <div className="truncate text-xs text-slate-400">{user.role} · Mein Konto</div>
          </Link>
          <form action="/auth/abmelden" method="post">
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" /> Benutzer wechseln
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-20 lg:pb-0">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 lg:px-6">
          <Link href="/" className="mr-1 flex items-center lg:hidden" aria-label="Zur Startseite">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="h-8 w-8" />
          </Link>
          <CommandBar />
          <div className="ml-auto flex items-center gap-2">
            <Link href="/termine/neu" className="btn-primary" title="Neuer Termin (Taste N)">
              <Plus className="h-4 w-4" /><span className="hidden sm:inline">Termin</span>
            </Link>
            <Link href="/patienten/neu" className="btn-secondary hidden sm:inline-flex" title="Neuer Patient">
              <UserPlus className="h-4 w-4" /><span className="hidden md:inline">Patient</span>
            </Link>
            <Link href="/benachrichtigungen" className="btn-ghost relative px-2" aria-label={unread ? `${unread} neue Benachrichtigungen` : "Benachrichtigungen"}>
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-warn px-1 text-center text-[0.625rem] leading-4 font-semibold text-white">{unread}</span>}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1560px] p-4 lg:p-6">{children}</main>
      </div>

      <BottomNav tasks={tasks} unread={unread} chat={chat} />
      {realtime && <RealtimeRefresh practiceId={practiceId} />}
      {presence && <PresenceCheck {...presence} />}
    </div>
  );
}
