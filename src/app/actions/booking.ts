"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type OnlineSlot = { d: string; t: string };
export type BookResult =
  | { result: "ok"; token: string; starts_at: string; ends_at: string; doctor: string; type: string }
  | { result: "belegt" | "eingabe" | "limit" | "ungueltig" | "deaktiviert" | "fehler" };

/** Öffentlich: freie Zeiten (nur Uhrzeiten, keine Termindaten). */
export async function loadOnlineSlots(token: string, typeId: string, doctorId: string | null, from: string, to: string): Promise<OnlineSlot[]> {
  if (!UUID.test(token) || !UUID.test(typeId) || (doctorId && !UUID.test(doctorId)) || !DAY.test(from) || !DAY.test(to)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("online_slots", { p_token: token, p_type: typeId, p_doctor: doctorId, p_from: from, p_to: to });
  return (data ?? []) as OnlineSlot[];
}

/** Öffentlich: Termin buchen. Prüft den Slot in der Datenbank erneut (kein Doppelbuchen). */
export async function bookOnline(input: {
  token: string; typeId: string; doctorId: string; startsAt: string;
  first: string; last: string; birth: string; phone: string; email: string; insurance: string; note: string; consent: boolean;
}): Promise<BookResult> {
  if (!input.consent || !UUID.test(input.token) || !UUID.test(input.typeId) || !UUID.test(input.doctorId) || !DAY.test(input.birth) || Number.isNaN(Date.parse(input.startsAt)))
    return { result: "eingabe" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("online_book", {
    p_token: input.token, p_type: input.typeId, p_doctor: input.doctorId, p_starts: input.startsAt,
    p_first: input.first.slice(0, 100), p_last: input.last.slice(0, 100), p_birth: input.birth, p_phone: input.phone.slice(0, 40),
    p_email: input.email.slice(0, 200), p_insurance: input.insurance, p_note: input.note.slice(0, 500),
  });
  if (error || !data) return { result: "fehler" };
  return data as BookResult;
}

export async function saveOnlineBooking(f: FormData) {
  const { supabase, practice } = await requireAdmin();
  const num = (k: string, min: number, max: number, def: number) => Math.min(max, Math.max(min, Number(f.get(k)) || def));
  await supabase.from("practices").update({
    online_booking_enabled: f.get("online_booking_enabled") === "on",
    online_lead_hours: num("online_lead_hours", 0, 336, 24),
    online_horizon_days: num("online_horizon_days", 1, 400, 90),
  }).eq("id", practice.id);
  revalidatePath("/einstellungen");
}

export async function rotateBookingToken() {
  const { supabase, practice } = await requireAdmin();
  await supabase.from("practices").update({ booking_token: randomUUID() }).eq("id", practice.id);
  revalidatePath("/einstellungen");
}
