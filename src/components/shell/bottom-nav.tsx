"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, CalendarDays, CircleUser, Ellipsis, LayoutDashboard, LogOut, Plus, Users, X } from "lucide-react";
import { NAV, isActive } from "./nav-items";

/** Untere Leiste für Tablet und Handy: die vier häufigsten Ziele, „+ Termin“ in der Mitte, Rest unter „Mehr“. */
export function BottomNav({ tasks, unread, chat = 0 }: { tasks: number; unread: number; chat?: number }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const flat = NAV.flatMap((g) => g.items);
  const find = (href: string) => flat.find((i) => i.href === href)!;
  const tab = (href: string, label: string, Icon: typeof Users) => {
    const active = isActive(path, find(href));
    return (
      <Link href={href} onClick={() => setMore(false)} aria-current={active ? "page" : undefined}
        className={`flex flex-col items-center gap-0.5 py-1.5 text-[0.6875rem] ${active ? "font-medium text-brand-700" : "text-slate-500"}`}>
        <Icon className="h-5 w-5" />
        {label}
      </Link>
    );
  };
  const rest = flat.filter((i) => !["/", "/kalender", "/patienten"].includes(i.href));
  return (
    <div className="lg:hidden">
      {more && (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" aria-label="Menü schließen" onClick={() => setMore(false)} />
          <div className="fixed inset-x-0 bottom-14 z-50 rounded-t-xl border-t border-slate-200 bg-white p-3 shadow-lg">
            <div className="mb-1 flex items-center justify-between px-2 text-sm font-medium">
              Mehr
              <button className="btn-ghost btn-sm" onClick={() => setMore(false)} aria-label="Schließen"><X className="h-4 w-4" /></button>
            </div>
            <ul className="grid grid-cols-2 gap-1">
              {rest.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} onClick={() => setMore(false)} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-slate-50">
                    <i.icon className="h-4 w-4 text-slate-500" />
                    <span className="flex-1">{i.label}</span>
                    {(i.badge === "tasks" ? tasks : i.badge === "chat" ? chat : 0) > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold">{i.badge === "tasks" ? tasks : chat}</span>}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/benachrichtigungen" onClick={() => setMore(false)} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-slate-50">
                  <Bell className="h-4 w-4 text-slate-500" /><span className="flex-1">Benachrichtigungen</span>
                  {unread > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold">{unread}</span>}
                </Link>
              </li>
              <li>
                <Link href="/einstellungen/sicherheit" onClick={() => setMore(false)} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-slate-50">
                  <CircleUser className="h-4 w-4 text-slate-500" /><span className="flex-1">Mein Konto · Schrift</span>
                </Link>
              </li>
              <li>
                <form action="/auth/abmelden" method="post">
                  <button className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-slate-50"><LogOut className="h-4 w-4 text-slate-500" />Benutzer wechseln</button>
                </form>
              </li>
            </ul>
          </div>
        </>
      )}
      <nav aria-label="Schnellzugriff" className="fixed inset-x-0 bottom-0 z-50 grid h-14 grid-cols-5 items-center border-t border-slate-200 bg-white">
        {tab("/", "Heute", LayoutDashboard)}
        {tab("/kalender", "Kalender", CalendarDays)}
        <Link href="/termine/neu" onClick={() => setMore(false)} aria-label="Neuer Termin"
          className="mx-auto -mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-white shadow-md">
          <Plus className="h-6 w-6" />
        </Link>
        {tab("/patienten", "Patienten", Users)}
        <button onClick={() => setMore(!more)} aria-expanded={more}
          className={`relative flex flex-col items-center gap-0.5 py-1.5 text-[0.6875rem] ${more ? "font-medium text-brand-700" : "text-slate-500"}`}>
          {tasks + chat + unread > 0 && <span className="absolute top-1 right-[calc(50%-16px)] h-2 w-2 rounded-full bg-amber-400" aria-hidden />}
          <Ellipsis className="h-5 w-5" />
          Mehr
        </button>
      </nav>
    </div>
  );
}
