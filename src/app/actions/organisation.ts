"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";

const s = (f: FormData, k: string) => {
  const v = f.get(k);
  return v == null || String(v).trim() === "" ? null : String(v).trim();
};

export async function addAbsence(f: FormData) {
  const { supabase, practice, me } = await getContext();
  const starts_on = s(f, "starts_on");
  const ends_on = s(f, "ends_on") ?? starts_on;
  if (!starts_on || !s(f, "staff_id")) return;
  const { error } = await supabase.from("staff_absences").insert({
    practice_id: practice.id, staff_id: s(f, "staff_id"), kind: s(f, "kind") ?? "sonstiges", starts_on, ends_on, note: s(f, "note"), created_by: me.id,
  });
  if (error) redirect(`/stoerungen?fehler=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
}

export async function deleteAbsence(f: FormData) {
  const { supabase } = await getContext();
  await supabase.from("staff_absences").delete().eq("id", String(f.get("id")));
  revalidatePath("/", "layout");
}

export async function addWaitlist(f: FormData) {
  const { supabase, practice } = await getContext();
  if (!s(f, "patient_id")) return;
  await supabase.from("waitlist_entries").insert({
    practice_id: practice.id, patient_id: s(f, "patient_id"), doctor_id: s(f, "doctor_id"), type_id: s(f, "type_id"), note: s(f, "note"),
    earliest_date: s(f, "earliest_date"), latest_date: s(f, "latest_date"), priority: Number(s(f, "priority") ?? 0),
  });
  revalidatePath("/warteliste");
  redirect("/warteliste");
}

export async function resolveWaitlist(f: FormData) {
  const { supabase } = await getContext();
  await supabase.from("waitlist_entries").update({ resolved_at: new Date().toISOString() }).eq("id", String(f.get("id")));
  revalidatePath("/warteliste");
}

export async function saveTask(f: FormData) {
  const { supabase, practice, me } = await getContext();
  const title = s(f, "title");
  if (!title) return;
  await supabase.from("tasks").insert({
    practice_id: practice.id, title, description: s(f, "description"), patient_id: s(f, "patient_id"), assignee_id: s(f, "assignee_id"),
    due_date: s(f, "due_date"), created_by: me.id,
  });
  const assignee = s(f, "assignee_id");
  if (assignee && assignee !== me.id)
    await supabase.from("notifications").insert({ practice_id: practice.id, recipient_staff_id: assignee, kind: "aufgabe", title: `Neue Aufgabe: ${title}`, body: s(f, "description") });
  revalidatePath("/", "layout");
}

export async function toggleTask(f: FormData) {
  const { supabase } = await getContext();
  const done = f.get("done") === "1";
  await supabase.from("tasks").update({ done_at: done ? new Date().toISOString() : null }).eq("id", String(f.get("id")));
  revalidatePath("/", "layout");
}
