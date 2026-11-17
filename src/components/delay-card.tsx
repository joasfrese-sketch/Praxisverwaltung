import { Clock } from "lucide-react";
import { applyDelay } from "@/app/actions/appointments";
import { SubmitButton } from "./submit-button";
import { patientName, staffName } from "./ui";
import { fmtTime } from "@/lib/time";
import type { DelaySuggestion } from "@/lib/delays";
import type { Staff } from "@/lib/types";

export function DelayCard({ d, doctor, tz }: { d: DelaySuggestion; doctor?: Staff; tz: string }) {
  return (
    <form action={applyDelay} className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <input type="hidden" name="first_id" value={d.affected[0].id} />
      <input type="hidden" name="first_start" value={d.firstStart} />
      <div className="flex flex-wrap items-center gap-2 text-sm text-amber-900">
        <Clock className="h-4 w-4" />
        <b>Verzögerung erkannt: {staffName(doctor)}</b>
        <span>– nächster Termin ca. {d.delay} min zu früh ({d.cause})</span>
      </div>
      <p className="mt-1 text-xs text-amber-800">Vorschlag: folgende Termine verschieben. Patienten mit E-Mail werden ab der eingestellten Schwelle automatisch informiert.</p>
      <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
        {d.affected.map((a) => (
          <li key={a.id}>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="ids" value={a.id} defaultChecked className="accent-brand-600" />
              <span className="tabular-nums">{fmtTime(a.starts_at, tz)}</span> {patientName(a.patient)}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm">um</span>
        <input type="number" name="minutes" defaultValue={d.shift} min={5} step={5} className="input w-20" />
        <span className="text-sm">Minuten</span>
        <SubmitButton>Verschieben & informieren</SubmitButton>
      </div>
    </form>
  );
}
