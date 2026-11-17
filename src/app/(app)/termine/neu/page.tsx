import { getContext } from "@/lib/context";
import { loadRooms, loadStaff, loadTypes } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { AppointmentForm } from "@/components/appointment-form";
import { isProvider } from "@/lib/labels";
import { today, toZoned } from "@/lib/time";

export const metadata = { title: "Neuer Termin" };

export default async function NewAppointment({ searchParams }: PageProps<"/termine/neu">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const { supabase, practice, me } = await getContext();
  const [{ staff }, rooms, types, { data: patients }] = await Promise.all([
    loadStaff(supabase, practice.id),
    loadRooms(supabase, practice.id),
    loadTypes(supabase, practice.id),
    supabase.from("patients").select("id, first_name, last_name, birth_date").eq("practice_id", practice.id).order("last_name").limit(5000),
  ]);
  const now = toZoned(new Date(), practice.timezone);
  const roundedNow = Math.ceil(now.minutes / practice.slot_minutes) * practice.slot_minutes;
  let defaults = {
    date: str("datum") ?? today(practice.timezone),
    time: str("zeit") ?? `${String(Math.floor(roundedNow / 60) % 24).padStart(2, "0")}:${String(roundedNow % 60).padStart(2, "0")}`,
    duration: practice.slot_minutes,
    doctor_id: str("behandler") ?? (isProvider(me.role) ? me.id : undefined),
    room_id: str("raum"),
    patient_id: str("patient"),
    type_id: str("typ"),
    waitlist_id: str("warteliste"),
  } as Parameters<typeof AppointmentForm>[0]["defaults"];
  const t = types.find((x) => x.id === defaults.type_id);
  if (t) defaults = { ...defaults, duration: t.default_minutes };
  if (str("dauer")) defaults.duration = Number(str("dauer"));

  return (
    <div className="max-w-3xl">
      <PageHeader title="Neuer Termin" />
      <AppointmentForm patients={patients ?? []} staff={staff} rooms={rooms} types={types} defaults={defaults} slot={practice.slot_minutes} />
    </div>
  );
}
