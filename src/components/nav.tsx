"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Users, Stethoscope, AlertTriangle, ListOrdered, Armchair, CheckSquare, Bell, Settings, Menu, X,
} from "lucide-react";
import { useState } from "react";

const ITEMS = [
  { href: "/", label: "Mein Tag", icon: LayoutDashboard },
  { href: "/kalender", label: "Kalender", icon: CalendarDays },
  { href: "/wartezimmer", label: "Wartezimmer", icon: Armchair },
  { href: "/patienten", label: "Patienten", icon: Users },
  { href: "/stoerungen", label: "Störungen", icon: AlertTriangle },
  { href: "/warteliste", label: "Warteliste", icon: ListOrdered },
  { href: "/aufgaben", label: "Aufgaben", icon: CheckSquare },
  { href: "/benachrichtigungen", label: "Benachrichtigungen", icon: Bell },
  { href: "/personal", label: "Personal", icon: Stethoscope },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
];

export function Nav({ badges }: { badges: Record<string, number> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const links = (
    <nav className="space-y-0.5">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        const badge = badges[href];
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${active ? "bg-brand-700 text-white" : "text-brand-100 hover:bg-brand-700/60"}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {badge ? <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-brand-900">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <>
      <button className="btn-ghost text-white lg:hidden" onClick={() => setOpen(!open)} aria-label="Menü">
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      <div className="hidden lg:block">{links}</div>
      {open && <div className="fixed inset-x-0 top-14 z-40 bg-brand-800 p-3 shadow-lg lg:hidden">{links}</div>}
    </>
  );
}
