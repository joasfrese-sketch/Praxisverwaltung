import { setStatus } from "@/app/actions/appointments";
import { SubmitButton } from "./submit-button";

const NEXT: Partial<Record<string, { status: string; label: string; cls: string }>> = {
  geplant: { status: "eingecheckt", label: "Check-in", cls: "bg-st-waiting-d text-white hover:brightness-95" },
  bestaetigt: { status: "eingecheckt", label: "Check-in", cls: "bg-st-waiting-d text-white hover:brightness-95" },
  eingecheckt: { status: "in_behandlung", label: "Aufrufen", cls: "bg-st-active-d text-white hover:brightness-95" },
  in_behandlung: { status: "abgeschlossen", label: "Abschließen", cls: "bg-st-done-d text-white hover:brightness-95" },
};

/** Nächster Schritt eines Termins mit einem Klick. Die Farbe zeigt die Spalte, in die der Patient wandert. */
export function QuickStatus({ a, back }: { a: { id: string; status: string }; back?: string }) {
  const next = NEXT[a.status];
  if (!next) return null;
  return (
    <form action={setStatus}>
      <input type="hidden" name="id" value={a.id} />
      <input type="hidden" name="status" value={next.status} />
      {back && <input type="hidden" name="back" value={back} />}
      <SubmitButton size="sm" className={next.cls}>{next.label}</SubmitButton>
    </form>
  );
}
