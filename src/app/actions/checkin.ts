"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

export type CheckinResult =
  | { result: "ok" | "bereits"; ticket: number; time: string }
  | { result: "zu_frueh"; time: string; ab: string }
  | { result: "nicht_gefunden" | "gesperrt" | "deaktiviert" | "eingabe" };

/** Öffentlich (ohne Login): Patient meldet sich mit Nachname + Geburtsdatum selbst an. */
export async function selfCheckIn(token: string, lastName: string, birth: { d: string; m: string; y: string }): Promise<CheckinResult> {
  const d = Number(birth.d), m = Number(birth.m), y = Number(birth.y);
  const date = new Date(Date.UTC(y, m - 1, d));
  const valid = y >= 1900 && y <= 2100 && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  if (!lastName.trim() || !valid || !/^[0-9a-f-]{36}$/i.test(token)) return { result: "eingabe" };
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("self_check_in", { p_token: token, p_last_name: lastName.trim().slice(0, 100), p_birth_date: iso });
  if (error || !data) return { result: "nicht_gefunden" };
  return data as CheckinResult;
}

export async function saveSelfCheckin(f: FormData) {
  const { supabase, practice } = await requireAdmin();
  const early = Math.min(240, Math.max(5, Number(f.get("self_checkin_early_minutes") ?? 60) || 60));
  await supabase.from("practices").update({ self_checkin_enabled: f.get("self_checkin_enabled") === "on", self_checkin_early_minutes: early }).eq("id", practice.id);
  revalidatePath("/einstellungen");
}

/** Neuer Link: alte QR-Codes/Tablet-Links funktionieren danach nicht mehr. */
export async function rotateCheckinToken() {
  const { supabase, practice } = await requireAdmin();
  await supabase.from("practices").update({ checkin_token: randomUUID() }).eq("id", practice.id);
  revalidatePath("/einstellungen");
}
