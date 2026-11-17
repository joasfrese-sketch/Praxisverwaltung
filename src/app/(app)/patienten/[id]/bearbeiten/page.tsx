import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { PageHeader } from "@/components/ui";
import { PatientForm } from "@/components/patient-form";
import type { Patient } from "@/lib/types";

export const metadata = { title: "Patient bearbeiten" };

export default async function EditPatient({ params }: PageProps<"/patienten/[id]/bearbeiten">) {
  const { id } = await params;
  const { supabase } = await getContext();
  const { data } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader title={`${data.last_name}, ${data.first_name} bearbeiten`} />
      <PatientForm p={data as Patient} />
    </div>
  );
}
