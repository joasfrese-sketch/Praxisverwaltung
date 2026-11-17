"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContext, PRACTICE_COOKIE } from "@/lib/context";

export async function switchPractice(formData: FormData) {
  (await cookies()).set(PRACTICE_COOKIE, String(formData.get("practice_id")), { path: "/", maxAge: 31536000, sameSite: "lax" });
  redirect("/");
}

export async function markNotificationsRead(formData: FormData) {
  const { supabase, me } = await getContext();
  const id = formData.get("id");
  let q = supabase.from("notifications").update({ status: "gelesen", read_at: new Date().toISOString() }).eq("recipient_staff_id", me.id).eq("status", "neu");
  if (id) q = q.eq("id", String(id));
  await q;
  revalidatePath("/", "layout");
}
