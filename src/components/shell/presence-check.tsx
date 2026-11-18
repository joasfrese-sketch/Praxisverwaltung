"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { setStatus } from "@/app/actions/appointments";
import { SubmitButton } from "@/components/submit-button";
import { fmtTime, minutesBetween } from "@/lib/time";

export interface PresenceCandidate {
  id: string;
  starts_at: string;
  patientName: string;
  doctorName: string;
  reason: string;
}

const SNOOZE_MINUTES = 10;
const KEY = "praxis.presence-snooze";

// „Später fragen“ merkt sich der Browser (pro Gerät), damit die Frage nicht ständig wiederkommt.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const snapshot = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
const parse = (raw: string): Record<string, number> => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
function snooze(id: string) {
  const map = parse(snapshot());
  const now = Date.now();
  for (const k of Object.keys(map)) if (map[k] < now - 3600_000) delete map[k];
  map[id] = now + SNOOZE_MINUTES * 60_000;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
  listeners.forEach((l) => l());
}

/**
 * Fragt an der Anmeldung nach, ob ein Patient da ist, wenn er X Minuten nach Terminbeginn nicht eingecheckt wurde.
 * Erscheint auf jeder Seite, damit die Frage nicht übersehen wird; so bleiben keine Termine „hängen“.
 */
export function PresenceCheck({ candidates, askAfterMinutes, nowIso, tz }: {
  candidates: PresenceCandidate[]; askAfterMinutes: number; nowIso: string; tz: string;
}) {
  const [now, setNow] = useState(() => new Date(nowIso).getTime());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const snoozed = useMemo(() => parse(raw), [raw]);

  const due = candidates
    .filter((c) => now - new Date(c.starts_at).getTime() >= askAfterMinutes * 60_000 && (snoozed[c.id] ?? 0) <= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const current = due[0];

  const boxRef = useRef<HTMLDivElement>(null);
  const currentId = current?.id;
  useEffect(() => {
    if (currentId) boxRef.current?.focus();
  }, [currentId]);

  if (!current) return null;
  const late = minutesBetween(current.starts_at, new Date(now));
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 p-4">
      <div
        ref={boxRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="presence-title"
        aria-describedby="presence-text"
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl outline-none"
      >
        <p className="text-sm text-slate-500">
          Rückfrage an der Anmeldung{due.length > 1 ? `, noch ${due.length - 1} weitere` : ""}
        </p>
        <h2 id="presence-title" className="mt-1 text-lg font-semibold">Ist {current.patientName} erschienen?</h2>
        <p id="presence-text" className="mt-1 text-sm text-slate-600">
          Termin um <b className="tabular-nums">{fmtTime(current.starts_at, tz)}</b> bei {current.doctorName}, {current.reason}. Seit {late} Minuten nicht eingecheckt.
        </p>
        <div className="mt-4 grid gap-2">
          <form action={setStatus}>
            <input type="hidden" name="id" value={current.id} />
            <input type="hidden" name="status" value="eingecheckt" />
            <SubmitButton className="w-full bg-st-waiting-d text-white hover:brightness-95">Ja, ist da (einchecken)</SubmitButton>
          </form>
          <form action={setStatus}>
            <input type="hidden" name="id" value={current.id} />
            <input type="hidden" name="status" value="nicht_erschienen" />
            <SubmitButton variant="secondary" className="w-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-50">Nein, nicht erschienen</SubmitButton>
          </form>
          <button type="button" className="btn-ghost" onClick={() => snooze(current.id)}>Später fragen (in {SNOOZE_MINUTES} Minuten)</button>
        </div>
      </div>
    </div>
  );
}
