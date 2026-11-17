import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Absence, AppointmentType, AppointmentWithPatient, Room, Staff } from "./types";
import { isProvider } from "./labels";

export const APPT_SELECT = "*, patient:patients(id, first_name, last_name, birth_date)";

export async function loadAppointments(
  supabase: SupabaseClient, practiceId: string, from: string, to: string, opts: { doctorId?: string; includeCancelled?: boolean } = {},
) {
  let q = supabase.from("appointments").select(APPT_SELECT).eq("practice_id", practiceId).lt("starts_at", to).gt("ends_at", from).order("starts_at");
  if (opts.doctorId) q = q.eq("doctor_id", opts.doctorId);
  if (!opts.includeCancelled) q = q.neq("status", "abgesagt");
  const { data } = await q;
  return (data ?? []) as AppointmentWithPatient[];
}

export async function loadStaff(supabase: SupabaseClient, practiceId: string, includeInactive = false) {
  let q = supabase.from("staff").select("*").eq("practice_id", practiceId).order("last_name");
  if (!includeInactive) q = q.eq("active", true);
  const { data } = await q;
  const staff = (data ?? []) as Staff[];
  return { staff, providers: staff.filter((s) => isProvider(s.role)), byId: new Map(staff.map((s) => [s.id, s])) };
}

export async function loadRooms(supabase: SupabaseClient, practiceId: string) {
  const { data } = await supabase.from("rooms").select("*").eq("practice_id", practiceId).eq("active", true).order("sort");
  return (data ?? []) as Room[];
}

export async function loadTypes(supabase: SupabaseClient, practiceId: string) {
  const { data } = await supabase.from("appointment_types").select("*").eq("practice_id", practiceId).eq("active", true).order("name");
  return (data ?? []) as AppointmentType[];
}

export async function loadAbsences(supabase: SupabaseClient, practiceId: string, fromDay: string, toDay: string) {
  const { data } = await supabase.from("staff_absences").select("*").eq("practice_id", practiceId).lte("starts_on", toDay).gte("ends_on", fromDay).order("starts_on");
  return (data ?? []) as Absence[];
}

export function isAbsent(absences: Absence[], staffId: string, day: string) {
  return absences.find((a) => a.staff_id === staffId && a.starts_on <= day && a.ends_on >= day);
}
