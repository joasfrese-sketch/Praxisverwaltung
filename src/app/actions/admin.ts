"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/context";
import type { ProtocolField } from "@/lib/types";
import { headers } from "next/headers";
import { isMailConfigured, processOutbox, smtpConfig, transporter } from "@/lib/mail";

const s = (f: FormData, k: string) => {
  const v = f.get(k);
  return v == null || String(v).trim() === "" ? null : String(v).trim();
};

export async function saveStaff(f: FormData) {
  const { supabase, practice, me } = await requireAdmin();
  const id = s(f, "id");
  const row = {
    role: s(f, "role"), title: s(f, "title"), first_name: s(f, "first_name"), last_name: s(f, "last_name"), specialty: s(f, "specialty"),
    email: s(f, "email")?.toLowerCase() ?? null, phone: s(f, "phone"), color: s(f, "color") ?? "#4f6d8f",
    can_read_medical: f.get("can_read_medical") === "on", is_admin: f.get("is_admin") === "on" || id === me.id,
    substitute_id: s(f, "substitute_id"), active: id === me.id ? true : f.get("active") !== "off",
  };
  if (!row.first_name || !row.last_name || !row.role) redirect(`/personal?fehler=${encodeURIComponent("Name und Rolle sind Pflicht.")}`);
  const { data, error } = id
    ? await supabase.from("staff").update(row).eq("id", id).select("id").single()
    : await supabase.from("staff").insert({ ...row, practice_id: practice.id }).select("id").single();
  if (error) redirect(`/personal?fehler=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect(`/personal/${data!.id}?gespeichert=1`);
}

export async function savePractice(f: FormData) {
  const { supabase, practice } = await requireAdmin();
  const reminder = (s(f, "reminder_hours") ?? "").split(/[,; ]+/).map(Number).filter((n) => n > 0);
  await supabase.from("practices").update({
    name: s(f, "name"), practice_type: s(f, "practice_type"), phone: s(f, "phone"), email: s(f, "email"), street: s(f, "street"), zip: s(f, "zip"), city: s(f, "city"),
    slot_minutes: Number(s(f, "slot_minutes") ?? 15), buffer_minutes: Number(s(f, "buffer_minutes") ?? 0),
    emergency_slots_per_day: Number(s(f, "emergency_slots_per_day") ?? 0), cancel_deadline_hours: Number(s(f, "cancel_deadline_hours") ?? 24),
    reminder_hours: reminder.length ? reminder : [24], delay_notify_minutes: Number(s(f, "delay_notify_minutes") ?? 15),
    no_show_warn_threshold: Number(s(f, "no_show_warn_threshold") ?? 3),
  }).eq("id", practice.id);
  revalidatePath("/", "layout");
  redirect("/einstellungen?gespeichert=1");
}

export async function saveOpeningHours(f: FormData) {
  const { supabase, practice } = await requireAdmin();
  const rows: { practice_id: string; weekday: number; opens: string; closes: string }[] = [];
  for (let d = 1; d <= 7; d++) {
    for (const i of [1, 2]) {
      const o = s(f, `d${d}_o${i}`);
      const c = s(f, `d${d}_c${i}`);
      if (o && c && c > o) rows.push({ practice_id: practice.id, weekday: d, opens: o, closes: c });
    }
  }
  await supabase.from("opening_hours").delete().eq("practice_id", practice.id);
  if (rows.length) await supabase.from("opening_hours").insert(rows);
  revalidatePath("/", "layout");
  redirect("/einstellungen?gespeichert=1#zeiten");
}

export async function saveRoom(f: FormData) {
  const { supabase, practice } = await requireAdmin();
  const id = s(f, "id");
  if (f.get("delete") === "1" && id) await supabase.from("rooms").update({ active: false }).eq("id", id);
  else if (id) await supabase.from("rooms").update({ name: s(f, "name") }).eq("id", id);
  else if (s(f, "name")) await supabase.from("rooms").insert({ practice_id: practice.id, name: s(f, "name"), sort: 99 });
  revalidatePath("/einstellungen");
}

export async function saveType(f: FormData) {
  const { supabase, practice } = await requireAdmin();
  const id = s(f, "id");
  if (f.get("delete") === "1" && id) {
    await supabase.from("appointment_types").update({ active: false }).eq("id", id);
  } else {
    const template: ProtocolField[] = (s(f, "template") ?? "")
      .split("\n").map((l) => l.trim()).filter(Boolean)
      .map((l) => {
        const [label, type] = l.split("|").map((x) => x.trim());
        const key = label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        return { key, label, type: (["text", "textarea", "number", "checkbox"].includes(type) ? type : "textarea") as ProtocolField["type"] };
      });
    const row = { name: s(f, "name"), default_minutes: Number(s(f, "default_minutes") ?? 15), color: s(f, "color") ?? "#6b8bb0", protocol_template: template };
    if (!row.name) return;
    if (id) await supabase.from("appointment_types").update(row).eq("id", id);
    else await supabase.from("appointment_types").insert({ ...row, practice_id: practice.id });
  }
  revalidatePath("/einstellungen");
}

export async function saveCategory(f: FormData) {
  const { supabase, practice } = await requireAdmin();
  const id = s(f, "id");
  if (f.get("delete") === "1" && id) await supabase.from("record_categories").delete().eq("id", id);
  else if (s(f, "name")) await supabase.from("record_categories").insert({ practice_id: practice.id, name: s(f, "name"), is_warning: f.get("is_warning") === "on", sort: 50 });
  revalidatePath("/einstellungen");
}

export async function sendTestMail(f: FormData) {
  const { practice, email } = await requireAdmin();
  const to = s(f, "to") ?? email;
  const cfg = smtpConfig();
  if (!cfg) redirect(`/einstellungen?mail=${encodeURIComponent("SMTP ist noch nicht konfiguriert.")}#email`);
  let msg: string;
  try {
    await transporter().verify();
    await transporter().sendMail({
      from: `"${practice.name.replace(/"/g, "")}" <${cfg.from}>`,
      to,
      subject: `Testmail – ${practice.name}`,
      text: `Der E-Mail-Versand der Praxisverwaltung funktioniert.\n\nServer: ${cfg.host}:${cfg.port}\nAbsender: ${cfg.from}`,
    });
    msg = `Testmail an ${to} verschickt ✓`;
  } catch (e) {
    msg = `Fehler: ${e instanceof Error ? e.message : String(e)}`;
  }
  redirect(`/einstellungen?mail=${encodeURIComponent(msg)}#email`);
}

export async function sendOutboxNow() {
  await requireAdmin();
  if (!isMailConfigured()) redirect(`/benachrichtigungen?mail=${encodeURIComponent("SMTP ist noch nicht konfiguriert.")}`);
  const h = await headers();
  let msg: string;
  try {
    const r = await processOutbox(process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`);
    msg = `${r.sent} versendet, ${r.failed} fehlgeschlagen`;
  } catch (e) {
    msg = `Fehler: ${e instanceof Error ? e.message : String(e)}`;
  }
  revalidatePath("/benachrichtigungen");
  redirect(`/benachrichtigungen?mail=${encodeURIComponent(msg)}`);
}
