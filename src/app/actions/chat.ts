"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/context";

export type ChatState = { error?: string; sentAt?: number } | null;

export async function sendChatMessage(_prev: ChatState, f: FormData): Promise<ChatState> {
  const { supabase, practice, me } = await getContext();
  const body = String(f.get("body") ?? "").trim();
  if (!body) return null;
  if (body.length > 4000) return { error: "Nachricht ist zu lang (max. 4000 Zeichen)." };
  const to = String(f.get("to") ?? "");
  const { error } = await supabase.from("chat_messages").insert({
    practice_id: practice.id, sender_id: me.id, recipient_id: to && to !== "team" ? to : null, body,
  });
  if (error) return { error: error.message };
  revalidatePath("/chat");
  return { sentAt: Date.now() };
}
