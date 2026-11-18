"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive } from "./nav-items";

export function SideNav({ tasks }: { tasks: number }) {
  const path = usePathname();
  return (
    <nav className="space-y-5" aria-label="Hauptmenü">
      {NAV.map((g, gi) => (
        <div key={gi}>
          {g.title && <div className="mb-1 px-3 text-xs text-slate-500">{g.title}</div>}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = isActive(path, it);
              const badge = it.badge === "tasks" ? tasks : 0;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                      active ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand-300" />}
                    <it.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{it.label}</span>
                    {badge > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-brand-900">{badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
