import type { SupabaseClient } from "@supabase/supabase-js";
import type { Room } from "./types";

type Busy = { room_id: string | null; starts_at: string; ends_at: string };

/**
 * Wählt einen Raum für einen Zeitraum.
 * Regeln: Raum muss die nötige Ausstattung haben und frei sein. Unter den freien Räumen wird der genommen,
 * der an diesem Tag am wenigsten belegt ist (so werden möglichst viele Räume parallel genutzt; die Ärzte
 * wechseln dafür den Raum). Bei Gleichstand gewinnt der Raum mit weniger Ausstattung, damit Spezialräume
 * (z. B. Röntgen) für Termine frei bleiben, die sie wirklich brauchen.
 */
export function chooseRoom(rooms: Room[], busy: Busy[], startsAt: string, endsAt: string, required: string | null, dayLoad: Map<string, number>, prefer?: string | null) {
  const fit = rooms.filter((r) => r.active && (!required || r.capabilities?.includes(required)));
  const free = fit.filter((r) => !busy.some((b) => b.room_id === r.id && b.starts_at < endsAt && b.ends_at > startsAt));
  if (prefer && free.some((r) => r.id === prefer)) return prefer;
  free.sort((a, b) =>
    (dayLoad.get(a.id) ?? 0) - (dayLoad.get(b.id) ?? 0) ||
    (a.capabilities?.length ?? 0) - (b.capabilities?.length ?? 0) ||
    a.sort - b.sort,
  );
  return free[0]?.id ?? null;
}

/** Lädt Räume und Belegungen des Tages und wählt für jeden Zeitraum einen Raum (für Serien nacheinander). */
export async function autoAssignRooms(
  supabase: SupabaseClient, practiceId: string, slots: { starts_at: string; ends_at: string }[], required: string | null, excludeId?: string | null,
) {
  if (!slots.length) return [];
  const { data: roomData } = await supabase.from("rooms").select("*").eq("practice_id", practiceId).eq("active", true).order("sort");
  const rooms = (roomData ?? []) as Room[];
  const result: (string | null)[] = [];
  for (const sl of slots) {
    const d0 = new Date(new Date(sl.starts_at).getTime() - 12 * 3600_000).toISOString();
    const d1 = new Date(new Date(sl.starts_at).getTime() + 12 * 3600_000).toISOString();
    let q = supabase.from("appointments").select("id, room_id, starts_at, ends_at").eq("practice_id", practiceId)
      .not("room_id", "is", null).not("status", "in", "(abgesagt,nicht_erschienen)").gte("starts_at", d0).lt("starts_at", d1);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q;
    const busy = (data ?? []) as Busy[];
    const load = new Map<string, number>();
    for (const b of busy) load.set(b.room_id!, (load.get(b.room_id!) ?? 0) + 1);
    result.push(chooseRoom(rooms, busy, sl.starts_at, sl.ends_at, required, load));
  }
  return result;
}

/** Beim Aufrufen: geplanter Raum, wenn gerade frei – sonst ein freier passender Raum. */
export async function roomForCall(supabase: SupabaseClient, practiceId: string, apptId: string) {
  const { data: a } = await supabase.from("appointments").select("id, room_id, location_kind, type:appointment_types(required_capability)").eq("id", apptId).single();
  if (!a || a.location_kind !== "praxis") return undefined;
  const required = (a.type as unknown as { required_capability: string | null } | null)?.required_capability ?? null;
  const [{ data: roomData }, { data: active }] = await Promise.all([
    supabase.from("rooms").select("*").eq("practice_id", practiceId).eq("active", true).order("sort"),
    supabase.from("appointments").select("room_id").eq("practice_id", practiceId).eq("status", "in_behandlung").neq("id", apptId).not("room_id", "is", null),
  ]);
  const rooms = (roomData ?? []) as Room[];
  const occupied = new Set((active ?? []).map((x) => x.room_id as string));
  const fit = rooms.filter((r) => !required || r.capabilities?.includes(required));
  if (a.room_id && !occupied.has(a.room_id)) return a.room_id as string;
  const free = fit.filter((r) => !occupied.has(r.id)).sort((x, y) => (x.capabilities?.length ?? 0) - (y.capabilities?.length ?? 0) || x.sort - y.sort);
  return free[0]?.id ?? (a.room_id as string | null);
}
