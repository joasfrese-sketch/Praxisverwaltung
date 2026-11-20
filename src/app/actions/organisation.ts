"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";

const s = (f: FormData, k: string) => {
  const v = f.get(k);
  return v == null || String(v).trim() === "" ? null : String(v).trim();
};

/** Admins tragen Abwesenheiten direkt ein, alle anderen stellen einen Antrag. */
export async function addAbsence(f: FormData) {
  const { supabase, practice, me } = await getContext();
  const starts_on = s(f, "starts_on");
  const ends_on = s(f, "ends_on") ?? starts_on;
  if (!starts_on || !s(f, "staff_id")) return;
  if (ends_on! < starts_on) redirect(`/stoerungen?fehler=${encodeURIComponent("Ende liegt vor dem Beginn.")}`);
  const { error } = await supabase.from("staff_absences").insert({
    practice_id: practice.id, staff_id: s(f, "staff_id"), kind: s(f, "kind") ?? "sonstiges", starts_on, ends_on, note: s(f, "note"), created_by: me.id,
    status: me.is_admin ? "genehmigt" : "beantragt",
    ...(me.is_admin ? { decided_by: me.id, decided_at: new Date().toISOString() } : {}),
  });
  if (error) redirect(`/stoerungen?fehler=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
}

export async function decideAbsence(f: FormData) {
  const { supabase, me } = await getContext();
  if (!me.is_admin) return;
  const decision = f.get("decision") === "genehmigt" ? "genehmigt" : "abgelehnt";
  await supabase.from("staff_absences")
    .update({ status: decision, decided_by: me.id, decided_at: new Date().toISOString(), decision_note: s(f, "decision_note") })
    .eq("id", String(f.get("id")));
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

export async function updateWaitlist(f: FormData) {
  const { supabase } = await getContext();
  const id = s(f, "id");
  if (!id) return;
  await supabase.from("waitlist_entries").update({
    doctor_id: s(f, "doctor_id"), type_id: s(f, "type_id"), note: s(f, "note"),
    earliest_date: s(f, "earliest_date"), latest_date: s(f, "latest_date"), priority: Number(s(f, "priority") ?? 0),
  }).eq("id", id);
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
