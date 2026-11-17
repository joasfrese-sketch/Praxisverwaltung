"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUser, PRACTICE_COOKIE } from "@/lib/context";
import { DEFAULT_TYPES, STAFF_COLORS } from "@/lib/labels";
import type { PracticeType, StaffRole } from "@/lib/types";

type Person = { title?: string; first_name: string; last_name: string; email?: string; role: StaffRole };
export type SetupPayload = {
  name: string; practice_type: PracticeType; phone?: string; street?: string; zip?: string; city?: string;
  me: Person; rooms: number; staff: Person[];
};

export async function createPractice(_: unknown, formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await getUser();
  const p = JSON.parse(String(formData.get("payload"))) as SetupPayload;
  if (!p.name?.trim() || !p.me.first_name?.trim() || !p.me.last_name?.trim()) return { error: "Bitte Praxisname und deinen Namen angeben." };

  const { data: id, error } = await supabase.rpc("create_practice", {
    p_name: p.name.trim(), p_type: p.practice_type, p_first_name: p.me.first_name.trim(),
    p_last_name: p.me.last_name.trim(), p_role: p.me.role, p_title: p.me.title?.trim() || null,
  });
  if (error || !id) return { error: error?.message ?? "Praxis konnte nicht angelegt werden." };

  await supabase.from("practices").update({ phone: p.phone || null, street: p.street || null, zip: p.zip || null, city: p.city || null }).eq("id", id);

  const rooms = Array.from({ length: Math.max(0, Math.min(50, p.rooms)) }, (_, i) => ({ practice_id: id, name: `Raum ${i + 1}`, sort: i }));
  if (rooms.length) await supabase.from("rooms").insert(rooms);

  await supabase.from("appointment_types").insert(
    DEFAULT_TYPES[p.practice_type].map((t, i) => ({
      practice_id: id, name: t.name, default_minutes: t.minutes, protocol_template: t.template, color: STAFF_COLORS[i % STAFF_COLORS.length],
    })),
  );

  const staff = p.staff
    .filter((s) => s.first_name?.trim() && s.last_name?.trim())
    .map((s, i) => ({
      practice_id: id, role: s.role, title: s.title?.trim() || null, first_name: s.first_name.trim(), last_name: s.last_name.trim(),
      email: s.email?.trim().toLowerCase() || null, color: STAFF_COLORS[(i + 1) % STAFF_COLORS.length],
    }));
  if (staff.length) {
    const { error: e2 } = await supabase.from("staff").insert(staff);
    if (e2) return { error: e2.message };
  }

  (await cookies()).set(PRACTICE_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect("/?willkommen=1");
}
