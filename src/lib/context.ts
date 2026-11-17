import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Practice, Staff } from "./types";
import { isProvider } from "./labels";

export const PRACTICE_COOKIE = "praxis";

/** Angemeldeter Benutzer (oder Weiterleitung zum Login). Prüft 2FA-Stufe. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect("/login/2fa");
  return { supabase, userId: data.claims.sub as string, email: (data.claims.email as string) ?? "" };
});

/** Aktuelle Praxis + eigenes Mitarbeiterprofil (oder Weiterleitung zum Einrichten). */
export const getContext = cache(async () => {
  const { supabase, userId, email } = await getUser();
  let { data: memberships } = await supabase.from("staff").select("*, practice:practices(*)").eq("user_id", userId).eq("active", true);
  if (!memberships?.length) {
    const { data: claimed } = await supabase.rpc("claim_staff_invitations");
    if (claimed) {
      ({ data: memberships } = await supabase.from("staff").select("*, practice:practices(*)").eq("user_id", userId).eq("active", true));
    }
  }
  if (!memberships?.length) redirect("/einrichten");
  const wanted = (await cookies()).get(PRACTICE_COOKIE)?.value;
  const m = memberships.find((x) => x.practice_id === wanted) ?? memberships[0];
  const { practice, ...me } = m as Staff & { practice: Practice };
  return {
    supabase,
    userId,
    email,
    me: me as Staff,
    practice,
    practices: memberships.map((x) => ({ id: x.practice_id as string, name: (x.practice as Practice).name })),
    canReadMedical: me.is_admin || me.can_read_medical || isProvider(me.role),
    canManageAbsences: me.is_admin || me.role === "mfa" || me.role === "verwaltung",
  };
});

export async function requireAdmin() {
  const ctx = await getContext();
  if (!ctx.me.is_admin) redirect("/?fehler=Nur+für+Admins");
  return ctx;
}
