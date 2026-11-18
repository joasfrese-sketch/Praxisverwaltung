import { Clock } from "lucide-react";
import { applyDelay } from "@/app/actions/appointments";
import { SubmitButton } from "./submit-button";
import { fmtTime } from "@/lib/time";
import type { DelaySuggestion } from "@/lib/delays";
import type { Staff } from "@/lib/types";

const nm = (s?: Pick<Staff, "title" | "first_name" | "last_name">) => (s ? [s.title, s.last_name].filter(Boolean).join(" ") : "Behandler");

/** Verzögerung in einer Zeile: Vorschlag prüfen, Minuten anpassen, ein Klick verschiebt und informiert. */
export function DelayCard({ d, doctor, tz, patientNames }: {
  d: DelaySuggestion; doctor?: Staff; tz: string; patientNames?: Record<string, string>;
}) {
  return (
    <form action={applyDelay} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
      <input type="hidden" name="first_id" value={d.affected[0].id} />
      <input type="hidden" name="first_start" value={d.firstStart} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Clock className="h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-48 flex-1 text-sm">
          <b>{nm(doctor)}</b> liegt etwa <b>{d.delay} min</b> hinter dem Plan <span className="text-amber-900/80">({d.cause})</span>
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          Verschieben um
          <input type="number" name="minutes" defaultValue={d.shift} min={5} step={5} className="input min-h-8 w-16 py-1" aria-label="Minuten" />
          min
        </label>
        <SubmitButton size="sm">Verschieben und informieren</SubmitButton>
      </div>
      <details className="mt-1.5 text-sm">
        <summary className="cursor-pointer text-amber-900">{d.affected.length} betroffene Termine prüfen</summary>
        <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
          {d.affected.map((a) => (
            <li key={a.id}>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="ids" value={a.id} defaultChecked className="accent-brand-600" />
                <span className="tabular-nums">{fmtTime(a.starts_at, tz)}</span>
                {patientNames?.[a.id] ?? (a.patient ? `${a.patient.last_name}, ${a.patient.first_name}` : "")}
              </label>
            </li>
          ))}
        </ul>
      </details>
    </form>
  );
}
