"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/context";

const s = (f: FormData, k: string) => {
  const v = f.get(k);
  return v == null || String(v).trim() === "" ? null : String(v).trim();
};
const ints = (v: string | null) => (v ? v.split(/[,; ]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0) : null);

export async function savePatient(_: { error?: string }, f: FormData): Promise<{ error?: string }> {
  const { supabase, practice } = await getContext();
  const id = s(f, "id");
  const row = {
    first_name: s(f, "first_name"), last_name: s(f, "last_name"), birth_date: s(f, "birth_date"), gender: s(f, "gender"),
    email: s(f, "email")?.toLowerCase() ?? null, phone: s(f, "phone"), street: s(f, "street"), zip: s(f, "zip"), city: s(f, "city"),
    insurance_type: s(f, "insurance_type"), insurance_name: s(f, "insurance_name"), insurance_number: s(f, "insurance_number"),
    emergency_contact_name: s(f, "emergency_contact_name"), emergency_contact_phone: s(f, "emergency_contact_phone"),
    notify_email: f.get("notify_email") === "on", reminder_hours: ints(s(f, "reminder_hours")),
    delay_notify_minutes: s(f, "delay_notify_minutes") ? Number(s(f, "delay_notify_minutes")) : null, notes: s(f, "notes"),
  };
  if (!row.first_name || !row.last_name) return { error: "Vor- und Nachname sind Pflicht." };
  if (id) {
    const { error } = await supabase.from("patients").update(row).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath(`/patienten/${id}`);
    redirect(`/patienten/${id}`);
  }
  const { data, error } = await supabase.from("patients").insert({ ...row, practice_id: practice.id }).select("id").single();
  if (error) return { error: error.message };
  const primary = s(f, "primary_doctor");
  if (primary) await supabase.from("care_assignments").insert({ practice_id: practice.id, patient_id: data.id, staff_id: primary, is_primary: true });
  redirect(`/patienten/${data.id}`);
}

export async function assignCare(f: FormData) {
  const { supabase, practice } = await getContext();
  const patient_id = String(f.get("patient_id"));
  const staff_id = String(f.get("staff_id"));
  const is_primary = f.get("is_primary") === "on";
  if (is_primary) await supabase.from("care_assignments").update({ is_primary: false }).eq("patient_id", patient_id);
  await supabase.from("care_assignments").upsert({ practice_id: practice.id, patient_id, staff_id, is_primary });
  revalidatePath(`/patienten/${patient_id}`);
}

export async function removeCare(f: FormData) {
  const { supabase } = await getContext();
  const patient_id = String(f.get("patient_id"));
  await supabase.from("care_assignments").delete().eq("patient_id", patient_id).eq("staff_id", String(f.get("staff_id")));
  revalidatePath(`/patienten/${patient_id}`);
}

export async function addRecordEntry(f: FormData) {
  const { supabase, practice, me } = await getContext();
  const patient_id = String(f.get("patient_id"));
  const title = s(f, "title");
  if (!title) return;
  await supabase.from("patient_record_entries").insert({
    practice_id: practice.id, patient_id, category_id: s(f, "category_id"), title, content: s(f, "content"), author_id: me.id,
  });
  revalidatePath(`/patienten/${patient_id}`);
}

export async function uploadAttachment(f: FormData) {
  const { supabase, practice, me } = await getContext();
  const patient_id = String(f.get("patient_id"));
  const file = f.get("file") as File | null;
  if (!file || !file.size) return;
  const path = `${practice.id}/${patient_id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type || undefined });
  if (error) redirect(`/patienten/${patient_id}?fehler=${encodeURIComponent(error.message)}`);
  await supabase.from("attachments").insert({
    practice_id: practice.id, patient_id, appointment_id: s(f, "appointment_id"), storage_path: path, file_name: file.name,
    mime_type: file.type || null, size_bytes: file.size, uploaded_by: me.id,
  });
  revalidatePath(`/patienten/${patient_id}`);
}
