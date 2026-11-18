"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { AlarmClock, CalendarDays, CalendarPlus, CornerDownLeft, LayoutDashboard, ListChecks, Search, Settings, Stethoscope, TriangleAlert, UserPlus, Users } from "lucide-react";
import { searchPatients, type PatientHit } from "@/app/actions/search";

interface Item {
  key: string; group: string; title: string; sub?: string; href: string;
  icon: ComponentType<{ className?: string }>; alt?: { label: string; href: string };
}

const STATIC: Item[] = [
  { key: "a-termin", group: "Aktionen", title: "Neuer Termin", sub: "Taste N", href: "/termine/neu", icon: CalendarPlus },
  { key: "a-patient", group: "Aktionen", title: "Neuer Patient", href: "/patienten/neu", icon: UserPlus },
  { key: "a-abw", group: "Aktionen", title: "Abwesenheit eintragen", sub: "Krank, Urlaub, Fortbildung", href: "/stoerungen#abwesenheit", icon: AlarmClock },
  { key: "g-heute", group: "Gehe zu", title: "Heute", sub: "Patientenfluss", href: "/", icon: LayoutDashboard },
  { key: "g-kal", group: "Gehe zu", title: "Kalender", href: "/kalender", icon: CalendarDays },
  { key: "g-pat", group: "Gehe zu", title: "Patienten", href: "/patienten", icon: Users },
  { key: "g-stoer", group: "Gehe zu", title: "Störungen und Warteliste", sub: "Ausfall, Vertretung, freie Termine", href: "/stoerungen", icon: TriangleAlert },
  { key: "g-auf", group: "Gehe zu", title: "Aufgaben", href: "/aufgaben", icon: ListChecks },
  { key: "g-pers", group: "Gehe zu", title: "Personal", href: "/personal", icon: Stethoscope },
  { key: "g-set", group: "Gehe zu", title: "Einstellungen", href: "/einstellungen", icon: Settings },
];

const fmtBirth = (d: string | null) => (d ? d.split("-").reverse().join(".") : "");

export function CommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Tastenkürzel: Strg/Cmd+K oder „/“ öffnet die Suche, „N“ legt einen Termin an
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (!typing && e.key === "/") {
        e.preventDefault();
        setOpen(true);
      } else if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "n") {
        router.push("/termine/neu");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // Patientensuche mit kurzer Verzögerung
  const term = q.trim();
  useEffect(() => {
    if (!open || term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setBusy(true);
      const r = await searchPatients(term).catch(() => [] as PatientHit[]);
      if (!cancelled) {
        setHits(r);
        setBusy(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, open]);

  const shownHits = term.length >= 2 ? hits : [];
  const low = term.toLowerCase();
  const stat = STATIC.filter((i) => !low || i.title.toLowerCase().includes(low) || (i.sub ?? "").toLowerCase().includes(low));
  const patientItems: Item[] = shownHits.map((h) => ({
    key: "p" + h.id, group: "Patienten", title: `${h.last_name}, ${h.first_name}`,
    sub: [fmtBirth(h.birth_date), h.phone].filter(Boolean).join("   "), href: `/patienten/${h.id}`, icon: Users,
    alt: { label: "Termin", href: `/termine/neu?patient=${h.id}` },
  }));
  const items = [...patientItems, ...stat];
  const active = Math.min(sel, Math.max(0, items.length - 1));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open, items.length]);

  const close = () => {
    setOpen(false);
    setQ("");
    setSel(0);
  };
  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 text-left text-sm text-slate-500 hover:bg-white sm:max-w-md"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Patient suchen oder Aktion wählen</span>
        <span className="kbd ml-auto hidden sm:inline">Strg K</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 px-3 pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div role="dialog" aria-modal="true" aria-label="Suche und Aktionen" className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-200 px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSel(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setSel(Math.min(items.length - 1, active + 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setSel(Math.max(0, active - 1)); }
                  else if (e.key === "Enter" && items[active]) { e.preventDefault(); go(items[active].href); }
                  else if (e.key === "Escape") { e.preventDefault(); close(); }
                }}
                placeholder="Name, Geburtsdatum, Versichertennummer …"
                aria-label="Suchen"
                className="min-h-12 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
              />
              {busy && <span className="text-xs text-slate-400">sucht …</span>}
            </div>
            <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-1.5" role="listbox">
              {items.map((it, i) => (
                <div key={it.key}>
                  {(i === 0 || items[i - 1].group !== it.group) && <div className="px-2.5 pt-2 pb-1 text-xs text-slate-500">{it.group}</div>}
                  <div
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setSel(i)}
                    onClick={() => go(it.href)}
                    className={`flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 ${i === active ? "bg-brand-100" : ""}`}
                  >
                    <it.icon className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{it.title}</span>
                      {it.sub && <span className="block truncate text-xs text-slate-500 tabular-nums">{it.sub}</span>}
                    </span>
                    {it.alt && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); go(it.alt!.href); }}
                        className="btn-secondary btn-sm"
                      >
                        {it.alt.label}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {term.length >= 2 && !busy && shownHits.length === 0 && (
                <div className="px-3 py-3 text-sm text-slate-600">
                  Kein Patient gefunden.{" "}
                  <button type="button" className="font-medium text-brand-700 underline" onClick={() => go("/patienten/neu")}>Neuen Patienten anlegen</button>
                </div>
              )}
            </div>
            <div className="hidden items-center gap-4 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 sm:flex">
              <span><span className="kbd">↑</span> <span className="kbd">↓</span> auswählen</span>
              <span><span className="kbd inline-flex items-center"><CornerDownLeft className="h-3 w-3" /></span> öffnen</span>
              <span><span className="kbd">Esc</span> schließen</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
