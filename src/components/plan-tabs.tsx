import Link from "next/link";

/** Gemeinsame Reiter: Ausfälle und frei werdende Termine gehören zusammen. */
export function PlanTabs({ active }: { active: "stoerungen" | "warteliste" }) {
  const tab = (href: string, id: string, label: string) => (
    <Link
      href={href}
      aria-current={active === id ? "page" : undefined}
      className={`-mb-px border-b-2 px-4 py-2 text-sm ${active === id ? "border-brand-700 font-medium text-brand-800" : "border-transparent text-slate-600 hover:text-slate-900"}`}
    >
      {label}
    </Link>
  );
  return <nav aria-label="Bereich" className="mb-4 flex border-b border-slate-300">{tab("/stoerungen", "stoerungen", "Störungen und Ausfälle")}{tab("/warteliste", "warteliste", "Warteliste")}</nav>;
}
