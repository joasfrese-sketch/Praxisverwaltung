"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/context";
import { addDays, hhmmToMinutes, toZoned, weekday, zonedToUtc } from "@/lib/time";
import type { AppointmentStatus } from "@/lib/types";
import { autoAssignRooms, roomForCall } from "@/lib/rooms";

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
    .from("staff_absences").select("id").eq("staff_id", a.doctor_id).eq("status", "genehmigt").lte("starts_on", day).gte("ends_on", day).limit(1);
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
    room_id: location_kind === "praxis" && s(f, "room_id") !== "auto" ? s(f, "room_id") : null,
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
  const autoRoom = a.location_kind === "praxis" && s(f, "room_id") === "auto";
  if (f.get("force") !== "1") {
    const conflicts = await findConflicts(ctx, a, id ?? undefined);
    if (conflicts.length) return { conflicts };
  }
  const repeat = Math.max(1, Math.min(52, Number(s(f, "repeat_count") ?? 1)));
  const interval = Number(s(f, "repeat_days") ?? 7);
  const shift = (iso: string, i: number) => new Date(new Date(iso).getTime() + i * interval * 86400000).toISOString();
  const times = Array.from({ length: id ? 1 : repeat }, (_, i) => ({ starts_at: shift(a.starts_at, i), ends_at: shift(a.ends_at, i) }));
  let rooms: (string | null)[] = times.map(() => a.room_id);
  if (autoRoom) {
    let required: string | null = null;
    if (a.type_id) {
      const { data: t } = await ctx.supabase.from("appointment_types").select("required_capability").eq("id", a.type_id).single();
      required = t?.required_capability ?? null;
    }
    rooms = await autoAssignRooms(ctx.supabase, ctx.practice.id, times, required, id);
  }

  if (id) {
    const { error } = await ctx.supabase.from("appointments").update({ ...a, room_id: rooms[0] }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    redirect(`/termine/${id}`);
  }
  const rows = times.map((t, i) => ({ ...a, ...t, room_id: rooms[i], practice_id: ctx.practice.id, created_by: ctx.me.id }));
  const { data, error } = await ctx.supabase.from("appointments").insert(rows).select("id");
  if (error) return { error: error.message };
  const wl = s(f, "waitlist_id");
  if (wl) await ctx.supabase.from("waitlist_entries").update({ resolved_at: new Date().toISOString(), resolved_appointment_id: data![0].id }).eq("id", wl);
  revalidatePath("/", "layout");
  redirect(`/termine/${data![0].id}`);
}

export async function setStatus(f: FormData) {
  const { supabase, practice } = await getContext();
  const id = String(f.get("id"));
  const status = String(f.get("status")) as AppointmentStatus;
  const patch: Record<string, unknown> = { status };
  // Aufrufen: freien, passenden Raum festlegen – die Aufrufanzeige zeigt ihn dem Patienten
  if (status === "in_behandlung") {
    const room = await roomForCall(supabase, practice.id, id);
    if (room !== undefined) patch.room_id = room;
  }
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


/**
 * Nächste freie Zeiten eines Behandlers für eine bestimmte Dauer (14 Tage ab „fromDate“).
 * Beachtet Sprechzeiten, bestehende Termine inkl. Pufferzeit, Abwesenheiten und bereits vergangene Uhrzeiten.
 * Pro Tag höchstens drei Vorschläge, damit die Auswahl über mehrere Tage reicht.
 */

export type PlanAppt = { id: string; start: number; end: number; label: string; reason: string; status: string; emergency: boolean };
export type DayPlan = {
  day: string; open: [number, number][];
  providers: { id: string; name: string; color: string; absent: string | null; appts: PlanAppt[] }[];
};

/** Tagesplan aller Behandler für die Terminvergabe (belegte Zeiten, Sprechzeiten, Abwesenheiten). */
export async function loadDayPlan(day: string): Promise<DayPlan | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const { supabase, practice } = await getContext();
  const tz = practice.timezone;
  const from = zonedToUtc(`${day}T00:00`, tz).toISOString();
  const to = zonedToUtc(`${addDays(day, 1)}T00:00`, tz).toISOString();
  const [{ data: staff }, { data: hours }, { data: appts }, { data: abs }] = await Promise.all([
    supabase.from("staff").select("id, title, first_name, last_name, role, color").eq("practice_id", practice.id).eq("active", true).in("role", ["arzt", "therapeut"]).order("last_name"),
    supabase.from("opening_hours").select("opens, closes").eq("practice_id", practice.id).eq("weekday", weekday(day)).order("opens"),
    supabase.from("appointments").select("id, doctor_id, starts_at, ends_at, reason, status, is_emergency, patient:patients(last_name)")
      .eq("practice_id", practice.id).not("status", "in", "(abgesagt,nicht_erschienen)").lt("starts_at", to).gt("ends_at", from).order("starts_at"),
    supabase.from("staff_absences").select("staff_id, kind").eq("practice_id", practice.id).eq("status", "genehmigt").lte("starts_on", day).gte("ends_on", day),
  ]);
  const mins = (iso: string) => {
    const z = toZoned(iso, tz);
    return z.date < day ? 0 : z.date > day ? 24 * 60 : z.minutes;
  };
  const kinds: Record<string, string> = { urlaub: "Urlaub", krank: "krank", fortbildung: "Fortbildung", sonstiges: "abwesend" };
  return {
    day,
    open: (hours ?? []).map((h) => [hhmmToMinutes(h.opens), hhmmToMinutes(h.closes)] as [number, number]),
    providers: (staff ?? []).map((s) => ({
      id: s.id, color: s.color, name: [s.title, s.last_name].filter(Boolean).join(" ") || s.first_name,
      absent: (() => { const a = (abs ?? []).find((x) => x.staff_id === s.id); return a ? kinds[a.kind] ?? "abwesend" : null; })(),
      appts: (appts ?? []).filter((a) => a.doctor_id === s.id).map((a) => ({
        id: a.id, start: mins(a.starts_at), end: mins(a.ends_at), reason: a.reason, status: a.status, emergency: a.is_emergency,
        label: (a.patient as unknown as { last_name: string } | null)?.last_name ?? "Termin",
      })),
    })),
  };
}

export type RangeDay = { day: string; open: [number, number][]; absent: string | null; appts: PlanAppt[] };
export type RangePlan = { from: string; to: string; today: string; nowMin: number; buffer: number; days: RangeDay[] };

/** Zeitraum-Plan eines Behandlers (max. 6 Wochen): Sprechzeiten, Abwesenheiten, belegte Zeiten je Tag. */
export async function loadRangePlan(doctorId: string, from: string, to: string): Promise<RangePlan | null> {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!doctorId || !re.test(from) || !re.test(to) || to < from) return null;
  const { supabase, practice } = await getContext();
  const tz = practice.timezone;
  const nowZ = toZoned(new Date(), tz);
  const start = from < nowZ.date ? nowZ.date : from;
  const end = to > addDays(start, 42) ? addDays(start, 42) : to;
  if (end < start) return { from: start, to: end, today: nowZ.date, nowMin: nowZ.minutes, buffer: practice.buffer_minutes ?? 0, days: [] };
  const [{ data: hours }, { data: appts }, { data: abs }] = await Promise.all([
    supabase.from("opening_hours").select("weekday, opens, closes").eq("practice_id", practice.id).order("opens"),
    supabase.from("appointments").select("id, starts_at, ends_at, reason, status, is_emergency, patient:patients(last_name)")
      .eq("doctor_id", doctorId).not("status", "in", "(abgesagt,nicht_erschienen)")
      .lt("starts_at", zonedToUtc(`${addDays(end, 1)}T00:00`, tz).toISOString()).gt("ends_at", zonedToUtc(`${start}T00:00`, tz).toISOString()).order("starts_at"),
    supabase.from("staff_absences").select("kind, starts_on, ends_on").eq("staff_id", doctorId).eq("status", "genehmigt").lte("starts_on", end).gte("ends_on", start),
  ]);
  const kinds: Record<string, string> = { urlaub: "Urlaub", krank: "krank", fortbildung: "Fortbildung", sonstiges: "abwesend" };
  const days: RangeDay[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const open = (hours ?? []).filter((h) => h.weekday === weekday(d)).map((h) => [hhmmToMinutes(h.opens), hhmmToMinutes(h.closes)] as [number, number]);
    if (!open.length) continue; // geschlossene Tage (Wochenende) weglassen
    const ab = (abs ?? []).find((a) => a.starts_on <= d && a.ends_on >= d);
    const mins = (iso: string) => { const z = toZoned(iso, tz); return z.date < d ? 0 : z.date > d ? 24 * 60 : z.minutes; };
    days.push({
      day: d, open, absent: ab ? kinds[ab.kind] ?? "abwesend" : null,
      appts: (appts ?? []).filter((a) => { const s = toZoned(a.starts_at, tz).date; const e = toZoned(a.ends_at, tz).date; return s <= d && e >= d; }).map((a) => ({
        id: a.id, start: mins(a.starts_at), end: mins(a.ends_at), reason: a.reason, status: a.status, emergency: a.is_emergency,
        label: (a.patient as unknown as { last_name: string } | null)?.last_name ?? "Termin",
      })),
    });
  }
  return { from: start, to: end, today: nowZ.date, nowMin: nowZ.minutes, buffer: practice.buffer_minutes ?? 0, days };
}
