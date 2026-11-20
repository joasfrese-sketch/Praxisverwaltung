"use server";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";

export type InviteState = { link?: string; email?: string; error?: string } | null;

/** Admin erzeugt einen persönlichen Einladungslink (7 Tage gültig, einmalig nutzbar). */
export async function createInvite(_prev: InviteState, f: FormData): Promise<InviteState> {
  const { supabase, practice, me } = await requireAdmin();
  const staffId = String(f.get("staff_id") ?? "");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Bitte eine gültige E-Mail-Adresse angeben." };
  const token = randomBytes(32).toString("base64url");
  const token_hash = createHash("sha256").update(token).digest("hex");
  // alte, unbenutzte Einladungen für diese Person ungültig machen
  await supabase.from("staff_invites").delete().eq("staff_id", staffId).is("used_at", null);
  const { error } = await supabase.from("staff_invites").insert({ practice_id: practice.id, staff_id: staffId, email, token_hash, created_by: me.id });
  if (error) return { error: error.message };
  await supabase.from("staff").update({ email }).eq("id", staffId);
  const h = await headers();
  const base = process.env.APP_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  revalidatePath(`/personal/${staffId}`);
  return { link: `${base}/einladung/${token}`, email };
}

export async function revokeInvites(f: FormData) {
  const { supabase } = await requireAdmin();
  const staffId = String(f.get("staff_id"));
  await supabase.from("staff_invites").delete().eq("staff_id", staffId).is("used_at", null);
  revalidatePath(`/personal/${staffId}`);
}

const MESSAGES: Record<string, string> = {
  ungueltig: "Dieser Einladungslink ist ungültig, abgelaufen oder wurde schon benutzt. Bitte in der Praxis einen neuen anfordern.",
  email_falsch: "Die E-Mail-Adresse passt nicht zur Einladung. Bitte die Adresse eingeben, an die die Einladung ging.",
  passwort_kurz: "Das Passwort muss mindestens 8 Zeichen lang sein.",
  bereits_verknuepft: "Dieses Profil ist bereits mit einem Konto verknüpft.",
  email_vergeben: "Zu dieser E-Mail gibt es schon ein Konto mit anderem Passwort. Bitte das bestehende Passwort verwenden.",
};

export type AcceptState = { error?: string } | null;

/** Öffentlich: Einladung annehmen → Konto anlegen (ohne Bestätigungsmail) → anmelden. */
export async function acceptInvite(_prev: AcceptState, f: FormData): Promise<AcceptState> {
  const token = String(f.get("token") ?? "");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const password = String(f.get("password") ?? "");
  if (password !== String(f.get("password2") ?? "")) return { error: "Die Passwörter stimmen nicht überein." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_staff_invite", { p_token: token, p_email: email, p_password: password });
  if (error) return { error: error.message };
  if (data !== "ok") return { error: MESSAGES[String(data)] ?? "Unbekannter Fehler." };
  const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signErr) return { error: `Konto angelegt, Anmeldung fehlgeschlagen: ${signErr.message}. Bitte unter /login anmelden.` };
  return { error: "" };
}
