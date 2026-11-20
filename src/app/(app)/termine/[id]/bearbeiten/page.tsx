import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { loadRooms, loadStaff, loadTypes } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { AppointmentForm } from "@/components/appointment-form";
import { minutesBetween, toZoned } from "@/lib/time";
import type { Appointment } from "@/lib/types";

export const metadata = { title: "Termin bearbeiten" };

export default async function EditAppointment({ params }: PageProps<"/termine/[id]/bearbeiten">) {
  const { id } = await params;
  const { supabase, practice } = await getContext();
  const { data } = await supabase.from("appointments").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as Appointment;
  const [{ staff }, rooms, types, { data: patients }] = await Promise.all([
    loadStaff(supabase, practice.id),
    loadRooms(supabase, practice.id),
    loadTypes(supabase, practice.id),
    supabase.from("patients").select("id, first_name, last_name, birth_date").eq("practice_id", practice.id).order("last_name").limit(5000),
  ]);
  const z = toZoned(a.starts_at, practice.timezone);
  return (
    <div className="max-w-[1500px]">
      <PageHeader title="Termin bearbeiten" subtitle="Änderungen werden protokolliert; der Patient wird bei Zeit- oder Behandlerwechsel informiert." />
      <AppointmentForm
        patients={patients ?? []} staff={staff} rooms={rooms} types={types} slot={practice.slot_minutes}
        defaults={{ ...a, date: z.date, time: z.time, duration: minutesBetween(a.starts_at, a.ends_at) }}
      />
    </div>
  );
}
