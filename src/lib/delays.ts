import type { AppointmentWithPatient } from "./types";
import { minutesBetween } from "./time";

export interface DelaySuggestion {
  doctorId: string;
  delay: number;      // aktuelle Verzögerung in Minuten
  shift: number;      // vorgeschlagene Verschiebung (auf 5 min gerundet)
  cause: string;
  affected: AppointmentWithPatient[];
}

/**
 * Erkennt automatisch Verzögerungen je Behandler:
 * – laufende Behandlung überzieht ihr geplantes Ende
 * – Patient wartet bereits (eingecheckt), aber Terminbeginn ist überschritten
 */
export function detectDelays(appts: AppointmentWithPatient[], now = new Date(), threshold = 5): DelaySuggestion[] {
  const byDoctor = new Map<string, AppointmentWithPatient[]>();
  for (const a of appts) {
    if (!byDoctor.has(a.doctor_id)) byDoctor.set(a.doctor_id, []);
    byDoctor.get(a.doctor_id)!.push(a);
  }
  const out: DelaySuggestion[] = [];
  for (const [doctorId, list] of byDoctor) {
    list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const running = list.find((a) => a.status === "in_behandlung");
    let delay = 0;
    let cause = "";
    let pivot: string | null = null;
    if (running && new Date(running.ends_at) < now) {
      delay = minutesBetween(running.ends_at, now);
      cause = `Behandlung ${running.patient?.last_name ?? ""} überzieht`;
      pivot = running.ends_at;
    } else if (!running) {
      const waiting = list.find((a) => a.status === "eingecheckt" && new Date(a.starts_at) < now);
      if (waiting) {
        delay = minutesBetween(waiting.starts_at, now);
        cause = `${waiting.patient?.last_name ?? "Patient"} wartet seit Terminbeginn`;
        pivot = waiting.starts_at;
      }
    }
    if (delay < threshold || !pivot) continue;
    const affected = list.filter(
      (a) => ["geplant", "bestaetigt", "eingecheckt"].includes(a.status) && a.starts_at >= pivot! && a.id !== running?.id,
    );
    if (!affected.length) continue;
    out.push({ doctorId, delay, shift: Math.ceil(delay / 5) * 5, cause, affected });
  }
  return out;
}
