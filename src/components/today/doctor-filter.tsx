import Link from "next/link";

export interface DoctorChip { id: string; label: string; color: string; count: number }

/** Wer wird angezeigt? „Alle“ für den Empfang, der eigene Name für Ärztinnen und Ärzte. */
export function DoctorFilter({ chips, active, total }: { chips: DoctorChip[]; active: string; total: number }) {
  const base = "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors";
  const on = "border-brand-700 bg-brand-700 text-white";
  const off = "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <nav aria-label="Behandler wählen" className="flex flex-wrap items-center gap-1.5">
      <Link href="/?arzt=alle" className={`${base} ${active === "alle" ? on : off}`} aria-current={active === "alle" ? "true" : undefined}>
        Alle <span className="tabular-nums opacity-70">{total}</span>
      </Link>
      {chips.map((c) => (
        <Link key={c.id} href={`/?arzt=${c.id}`} className={`${base} ${active === c.id ? on : off}`} aria-current={active === c.id ? "true" : undefined}>
          <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white/70" style={{ background: c.color }} />
          {c.label} <span className="tabular-nums opacity-70">{c.count}</span>
        </Link>
      ))}
    </nav>
  );
}
