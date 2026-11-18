import { CalendarDays, LayoutDashboard, ListChecks, Settings, Stethoscope, TriangleAlert, Users } from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: string[];
  exact?: boolean;
  badge?: "tasks";
}
export interface NavGroup {
  title: string | null;
  items: NavItem[];
}

/** Sechs Einträge statt zehn: der Tagesablauf (Check-in, Wartezimmer, Behandlung) liegt komplett auf „Heute“. */
export const NAV: NavGroup[] = [
  {
    title: null,
    items: [
      { href: "/", label: "Heute", icon: LayoutDashboard, match: ["/"], exact: true },
      { href: "/kalender", label: "Kalender", icon: CalendarDays, match: ["/kalender"] },
      { href: "/patienten", label: "Patienten", icon: Users, match: ["/patienten"] },
    ],
  },
  {
    title: "Praxisbetrieb",
    items: [
      { href: "/stoerungen", label: "Störungen & Warteliste", icon: TriangleAlert, match: ["/stoerungen", "/warteliste"] },
      { href: "/aufgaben", label: "Aufgaben", icon: ListChecks, match: ["/aufgaben"], badge: "tasks" },
    ],
  },
  {
    title: "Verwaltung",
    items: [
      { href: "/personal", label: "Personal", icon: Stethoscope, match: ["/personal"] },
      { href: "/einstellungen", label: "Einstellungen", icon: Settings, match: ["/einstellungen"] },
    ],
  },
];

export function isActive(path: string, item: NavItem) {
  return item.exact ? path === "/" : item.match.some((m) => path === m || path.startsWith(m + "/"));
}
