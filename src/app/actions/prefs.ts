"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/context";
import { FONT_SCALES } from "@/lib/labels";

const FONT_COOKIE = "schrift";

export async function setFontScale(f: FormData) {
  const { supabase, userId } = await getUser();
  const v = Number(f.get("font_scale"));
  if (!FONT_SCALES.some((s) => s.value === v)) return;
  await supabase.from("user_prefs").upsert({ user_id: userId, font_scale: v, updated_at: new Date().toISOString() });
  (await cookies()).set(FONT_COOKIE, String(v), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
