import { getContext } from "@/lib/context";
import { loadStaff } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { PatientForm } from "@/components/patient-form";

export const metadata = { title: "Neuer Patient" };

export default async function NewPatient() {
  const { supabase, practice } = await getContext();
  const { providers } = await loadStaff(supabase, practice.id);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Neuer Patient" />
      <PatientForm providers={providers} />
    </div>
  );
}
