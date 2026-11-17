import type { AppointmentWithPatient } from "./types";
import { minutesBetween } from "./time";

export interface DelaySuggestion {
  doctorId: string;
  delay: number;      // wie viele Minuten der nächste Termin zu früh liegt
  shift: number;      // vorgeschlagene Verschiebung (auf 5 min gerundet)
  cause: string;
  affected: AppointmentWithPatient[];
  firstStart: string; // Schutz gegen doppeltes Verschieben (Stand beim Anzeigen)
}

const PENDING = ["geplant", "bestaetigt", "eingecheckt"];

/**
 * Erkennt Verzögerungen je Behandler – auf Basis der *aktuellen* Planung:
 * Der Behandler ist frühestens frei, wenn die laufende Behandlung endet (bei Überziehen: jetzt).
 * Liegt der nächste offene Termin davor, ist er verspätet. Betroffen sind nur Termine, die nach
 * dem Verschieben tatsächlich kollidieren würden – Lücken im Plan fangen die Verzögerung auf.
 * Nach dem Verschieben verschwindet der Vorschlag daher, bis die Verzögerung erneut wächst.
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
    // frühester Zeitpunkt, ab dem der Behandler frei ist
    let freeAt = now;
    let cause = "";
    if (running) {
      const plannedEnd = new Date(running.ends_at);
      freeAt = plannedEnd > now ? plannedEnd : now;
      cause = plannedEnd < now ? `Behandlung ${running.patient?.last_name ?? ""} überzieht` : "";
    }
    const pending = list.filter((a) => PENDING.includes(a.status) && a.id !== running?.id);
    // Bezugstermin: bei laufender Behandlung der nächste danach geplante Termin,
    // sonst ein bereits wartender (eingecheckter) Patient, dessen Beginn überschritten ist.
    // Nicht erschienene / vergessene Termine (geplant, aber längst vorbei) zählen nicht.
    const first = running
      ? pending.find((a) => a.starts_at >= running.starts_at)
      : pending.find((a) => a.status === "eingecheckt" && new Date(a.starts_at) < now);
    if (!first) continue;
    const delay = minutesBetween(first.starts_at, freeAt);
    if (delay < threshold) continue;
    if (!cause) cause = first.status === "eingecheckt" ? `${first.patient?.last_name ?? "Patient"} wartet seit Terminbeginn` : "Behandler ist noch nicht frei";
    const shift = Math.ceil(delay / 5) * 5;
    // Kaskade: nur Termine verschieben, die nach dem Verschieben noch kollidieren
    const affected: AppointmentWithPatient[] = [];
    let cursor = new Date(freeAt.getTime());
    for (const a of pending.slice(pending.indexOf(first))) {
      const start = new Date(a.starts_at);
      if (start >= cursor) break;
      affected.push(a);
      const dur = new Date(a.ends_at).getTime() - start.getTime();
      cursor = new Date(start.getTime() + shift * 60000 + dur);
    }
    if (!affected.length) continue;
    out.push({ doctorId, delay, shift, cause, affected, firstStart: first.starts_at });
  }
  return out;
}
