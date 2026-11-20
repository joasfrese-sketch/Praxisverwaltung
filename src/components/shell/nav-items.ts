import { CalendarDays, Hourglass, LayoutDashboard, ListChecks, MessagesSquare, Settings, Stethoscope, TriangleAlert, Users } from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: string[];
  exact?: boolean;
  badge?: "tasks" | "chat";
}
export interface NavGroup {
  title: string | null;
  items: NavItem[];
}

/** Der Tagesablauf (Check-in, Wartezimmer, Behandlung) liegt komplett auf „Heute“. */
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
      { href: "/stoerungen", label: "Störungen", icon: TriangleAlert, match: ["/stoerungen"] },
      { href: "/warteliste", label: "Warteliste", icon: Hourglass, match: ["/warteliste"] },
      { href: "/aufgaben", label: "Aufgaben", icon: ListChecks, match: ["/aufgaben"], badge: "tasks" },
      { href: "/chat", label: "Chat", icon: MessagesSquare, match: ["/chat"], badge: "chat" },
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
