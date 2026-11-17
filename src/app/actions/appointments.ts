"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/context";
import { hhmmToMinutes, toZoned, weekday, zonedToUtc } from "@/lib/time";
import type { AppointmentStatus } from "@/lib/types";

const s = (f: FormData, k: string) => {
  const v = f.get(k);
  return v == null || String(v).trim() === "" ? null : String(v).trim();
};

export type FormState = { error?: string; conflicts?: string[] };

async function findConflicts(
  ctx: Awaited<ReturnType<typeof getContext>>, a: { doctor_id: string; room_id: string | null; patient_id: string; starts_at: string; ends_at: string }, excludeId?: string,
) {
  const { supabase, practice } = ctx;
  let q = supabase
    .from("appointments")
    .select("id, doctor_id, room_id, patient_id, starts_at, reason, patient:patients(last_name)")
    .eq("practice_id", practice.id)
    .lt("starts_at", a.ends_at)
    .gt("ends_at", a.starts_at)
    .not("status", "in", "(abgesagt,nicht_erschienen)");
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  const msgs: string[] = [];
  for (const c of data ?? []) {
    const name = (c.patient as unknown as { last_name: string } | null)?.last_name ?? "";
    if (c.doctor_id === a.doctor_id) msgs.push(`Behandler ist bereits belegt (${name}, ${c.reason}).`);
    if (a.room_id && c.room_id === a.room_id) msgs.push(`Raum ist bereits belegt (${name}).`);
    if (c.patient_id === a.patient_id) msgs.push(`Patient hat zur selben Zeit bereits einen Termin.`);
  }
  // Öffnungszeiten: Termin muss vollständig in einem Sprechzeiten-Fenster liegen
  const tz = ctx.practice.timezone;
  const s = toZoned(a.starts_at, tz);
  const e = toZoned(a.ends_at, tz);
  const { data: hours } = await supabase.from("opening_hours").select("opens, closes").eq("practice_id", practice.id).eq("weekday", weekday(s.date));
  const endMin = e.date === s.date ? e.minutes : 24 * 60;
  const inside = (hours ?? []).some((h) => hhmmToMinutes(h.opens) <= s.minutes && endMin <= hhmmToMinutes(h.closes));
  if (!inside) {
    const windows = (hours ?? []).map((h) => `${h.opens.slice(0, 5)}–${h.closes.slice(0, 5)}`).join(", ");
    msgs.push(windows ? `Außerhalb der Öffnungszeiten (an diesem Tag: ${windows} Uhr).` : "Die Praxis ist an diesem Tag geschlossen.");
  }
  const day = s.date;
  const { data: abs } = await supabase
    .from("staff_absences").select("id").eq("staff_id", a.doctor_id).lte("starts_on", day).gte("ends_on", day).limit(1);
  if (abs?.length) msgs.push("Behandler ist an diesem Tag abwesend.");
  return [...new Set(msgs)];
}

function readAppointment(f: FormData, tz: string) {
  const date = s(f, "date")!;
  const time = s(f, "time")!;
  const duration = Number(s(f, "duration") ?? 15);
  const start = zonedToUtc(`${date}T${time}`, tz);
  const end = new Date(start.getTime() + duration * 60000);
  const location_kind = (s(f, "location_kind") ?? "praxis") as "praxis" | "hausbesuch" | "video";
  return {
    patient_id: s(f, "patient_id")!,
    doctor_id: s(f, "doctor_id")!,
    assistant_id: s(f, "assistant_id"),
    type_id: s(f, "type_id"),
    reason: s(f, "reason") ?? "",
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    location_kind,
    room_id: location_kind === "praxis" ? s(f, "room_id") : null,
    address: location_kind === "hausbesuch" ? s(f, "address") : null,
    video_url: location_kind === "video" ? s(f, "video_url") : null,
    is_emergency: f.get("is_emergency") === "on",
    notes: s(f, "notes"),
  };
}

export async function saveAppointment(_: FormState, f: FormData): Promise<FormState> {
  const ctx = await getContext();
  const id = s(f, "id");
  if (!s(f, "patient_id") || !s(f, "doctor_id") || !s(f, "date") || !s(f, "time")) return { error: "Patient, Behandler, Datum und Uhrzeit sind Pflicht." };
  const a = readAppointment(f, ctx.practice.timezone);
  if (!a.reason) {
    if (a.type_id) {
      const { data: t } = await ctx.supabase.from("appointment_types").select("name").eq("id", a.type_id).single();
      a.reason = t?.name ?? "";
    }
    if (!a.reason) return { error: "Bitte einen Grund angeben oder einen Termintyp wählen." };
  }
  if (f.get("force") !== "1") {
    const conflicts = await findConflicts(ctx, a, id ?? undefined);
    if (conflicts.length) return { conflicts };
  }
  const repeat = Math.max(1, Math.min(52, Number(s(f, "repeat_count") ?? 1)));
  const interval = Number(s(f, "repeat_days") ?? 7);

  if (id) {
    const { error } = await ctx.supabase.from("appointments").update(a).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    redirect(`/termine/${id}`);
  }
  const rows = Array.from({ length: repeat }, (_, i) => ({
    ...a,
    practice_id: ctx.practice.id,
    created_by: ctx.me.id,
    starts_at: new Date(new Date(a.starts_at).getTime() + i * interval * 86400000).toISOString(),
    ends_at: new Date(new Date(a.ends_at).getTime() + i * interval * 86400000).toISOString(),
  }));
  const { data, error } = await ctx.supabase.from("appointments").insert(rows).select("id");
  if (error) return { error: error.message };
  const wl = s(f, "waitlist_id");
  if (wl) await ctx.supabase.from("waitlist_entries").update({ resolved_at: new Date().toISOString(), resolved_appointment_id: data![0].id }).eq("id", wl);
  revalidatePath("/", "layout");
  redirect(`/termine/${data![0].id}`);
}

export async function setStatus(f: FormData) {
  const { supabase } = await getContext();
  const id = String(f.get("id"));
  const status = String(f.get("status")) as AppointmentStatus;
  const patch: Record<string, unknown> = { status };
  if (status === "abgesagt") {
    patch.cancelled_by = "praxis";
    patch.cancel_reason = s(f, "cancel_reason");
  }
  await supabase.from("appointments").update(patch).eq("id", id);
  revalidatePath("/", "layout");
  const back = s(f, "back");
  if (status === "abgesagt" && f.get("to_waitlist") === "1") redirect(`/warteliste?frei=${id}`);
  if (back) redirect(back);
}

export async function applyDelay(f: FormData) {
  const { supabase } = await getContext();
  const minutes = Number(f.get("minutes"));
  const ids = f.getAll("ids").map(String);
  if (!minutes || !ids.length) return;
  const { data } = await supabase.from("appointments").select("id, starts_at, ends_at, delay_minutes").in("id", ids);
  // Schutz gegen doppeltes Absenden / veraltete Ansicht: nur verschieben, wenn der Plan unverändert ist
  const firstId = f.get("first_id");
  const firstStart = f.get("first_start");
  const current = (data ?? []).find((x) => x.id === firstId);
  if (firstId && firstStart && current && new Date(current.starts_at).getTime() !== new Date(String(firstStart)).getTime()) {
    revalidatePath("/", "layout");
    return;
  }
  // spätere Termine zuerst verschieben – vermeidet Zwischen-Überschneidungen
  for (const a of (data ?? []).sort((x, y) => y.starts_at.localeCompare(x.starts_at))) {
    await supabase
      .from("appointments")
      .update({
        starts_at: new Date(new Date(a.starts_at).getTime() + minutes * 60000).toISOString(),
        ends_at: new Date(new Date(a.ends_at).getTime() + minutes * 60000).toISOString(),
        delay_minutes: a.delay_minutes + minutes,
      })
      .eq("id", a.id);
  }
  revalidatePath("/", "layout");
}

export async function reassign(f: FormData) {
  const { supabase } = await getContext();
  const doctor = String(f.get("doctor_id"));
  const ids = f.getAll("ids").map(String);
  if (!doctor || !ids.length) return;
  await supabase.from("appointments").update({ doctor_id: doctor }).in("id", ids);
  revalidatePath("/", "layout");
}

export async function addProtocol(f: FormData) {
  const { supabase, practice, me } = await getContext();
  const appointment_id = String(f.get("appointment_id"));
  const structured: Record<string, string | boolean> = {};
  for (const [k, v] of f.entries()) if (k.startsWith("field_") && String(v).trim()) structured[k.slice(6)] = v === "on" ? true : String(v);
  const content = s(f, "content");
  if (!content && !Object.keys(structured).length) return;
  await supabase.from("appointment_protocols").insert({ practice_id: practice.id, appointment_id, author_id: me.id, content, structured });
  revalidatePath(`/termine/${appointment_id}`);
}

export async function addNote(f: FormData) {
  const { supabase, practice, me } = await getContext();
  const body = s(f, "body");
  if (!body) return;
  await supabase.from("notes").insert({ practice_id: practice.id, author_id: me.id, body, patient_id: s(f, "patient_id"), appointment_id: s(f, "appointment_id") });
  revalidatePath("/", "layout");
}
