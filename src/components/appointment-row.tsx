import Link from "next/link";
import { setStatus } from "@/app/actions/appointments";
import { StatusBadge, patientName, staffName } from "./ui";
import { SubmitButton } from "./submit-button";
import { fmtTime } from "@/lib/time";
import type { AppointmentWithPatient, Staff } from "@/lib/types";

const NEXT: Partial<Record<string, { status: string; label: string }>> = {
  geplant: { status: "eingecheckt", label: "Check-in" },
  bestaetigt: { status: "eingecheckt", label: "Check-in" },
  eingecheckt: { status: "in_behandlung", label: "Aufrufen" },
  in_behandlung: { status: "abgeschlossen", label: "Abschließen" },
};

export function QuickStatus({ a, back }: { a: { id: string; status: string }; back?: string }) {
  const next = NEXT[a.status];
  if (!next) return null;
  return (
    <form action={setStatus}>
      <input type="hidden" name="id" value={a.id} />
      <input type="hidden" name="status" value={next.status} />
      {back && <input type="hidden" name="back" value={back} />}
      <SubmitButton size="sm" variant={next.status === "abgeschlossen" ? "secondary" : "primary"}>{next.label}</SubmitButton>
    </form>
  );
}

export function AppointmentRow({ a, doctor, tz, showDoctor }: { a: AppointmentWithPatient; doctor?: Staff; tz: string; showDoctor?: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="w-14 shrink-0 text-sm font-semibold tabular-nums text-slate-800">
        {fmtTime(a.starts_at, tz)}
        {a.delay_minutes > 0 && <div className="text-[10px] font-medium text-amber-700">+{a.delay_minutes} min</div>}
      </div>
      <span className="h-8 w-1 shrink-0 rounded" style={{ background: doctor?.color ?? "#94a3b8" }} />
      <Link href={`/termine/${a.id}`} className="min-w-0 flex-1 hover:underline">
        <div className="truncate text-sm font-medium">
          {a.ticket_number ? <span className="mr-1 text-xs text-slate-500">#{a.ticket_number}</span> : null}
          {patientName(a.patient)} {a.is_emergency && <span className="text-xs font-semibold text-rose-700">AKUT</span>}
        </div>
        <div className="truncate text-xs text-slate-500">
          {a.reason}
          {showDoctor && doctor ? ` · ${staffName(doctor)}` : ""}
        </div>
      </Link>
      <StatusBadge status={a.status} />
      <QuickStatus a={a} back="/" />
    </li>
  );
}
