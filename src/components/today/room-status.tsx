import { DoorClosed, DoorOpen } from "lucide-react";
import { ROOM_CAPABILITIES } from "@/lib/labels";

export interface RoomState {
  id: string;
  name: string;
  capabilities: string[];
  busy: { patient: string; doctor: string; since: string; color: string } | null;
  next: string | null;
}

/** Zustandsanzeige der Räume: frei / belegt (belegt = dort läuft gerade eine Behandlung). */
export function RoomStatus({ rooms }: { rooms: RoomState[] }) {
  if (!rooms.length) return null;
  const free = rooms.filter((r) => !r.busy).length;
  return (
    <section aria-label="Räume" className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <h2 className="mb-1.5 text-xs font-medium text-slate-500">Räume · <span className="text-st-done-d">{free} frei</span> · <span className="text-st-active-d">{rooms.length - free} belegt</span></h2>
      <ul className="flex gap-2 overflow-x-auto pb-0.5">
        {rooms.map((r) => (
          <li key={r.id} title={r.capabilities.map((c) => ROOM_CAPABILITIES[c] ?? c).join(", ")}
            className={`min-w-36 shrink-0 rounded-md border px-2.5 py-1.5 text-sm ${r.busy ? "border-st-active/40 bg-st-active/10" : "border-st-done/40 bg-st-done/10"}`}>
            <div className="flex items-center gap-1.5 font-medium">
              {r.busy ? <DoorClosed className="h-4 w-4 text-st-active-d" /> : <DoorOpen className="h-4 w-4 text-st-done-d" />}
              {r.name}
              <span className={`ml-auto text-xs font-semibold ${r.busy ? "text-st-active-d" : "text-st-done-d"}`}>{r.busy ? "belegt" : "frei"}</span>
            </div>
            <div className="truncate text-xs text-slate-600">
              {r.busy ? <><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: r.busy.color }} />{r.busy.doctor} · {r.busy.patient} · seit {r.busy.since}</>
                : r.next ? `nächster Termin ${r.next}` : "heute nichts mehr geplant"}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
