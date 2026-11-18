"use server";
import { getContext } from "@/lib/context";

export interface PatientHit {
  id: string; first_name: string; last_name: string; birth_date: string | null; phone: string | null;
}

/** Sofort-Suche für die Befehlsleiste: Name, Geburtsdatum (TT.MM.JJJJ), Versichertennummer oder Telefon. */
export async function searchPatients(q: string): Promise<PatientHit[]> {
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  const { supabase, practice } = await getContext();
  let query = supabase
    .from("patients")
    .select("id, first_name, last_name, birth_date, phone")
    .eq("practice_id", practice.id)
    .order("last_name")
    .order("first_name")
    .limit(8);
  const de = term.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) {
    query = query.eq("birth_date", `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}`);
  } else {
    // mehrere Wörter („anna schmidt“): jedes Wort muss irgendwo passen
    for (const w of term.replace(/[%,()*]/g, " ").split(/\s+/).filter(Boolean)) {
      query = query.or(`last_name.ilike.%${w}%,first_name.ilike.%${w}%,insurance_number.ilike.%${w}%,phone.ilike.%${w}%`);
    }
  }
  const { data } = await query;
  return (data ?? []) as PatientHit[];
}
