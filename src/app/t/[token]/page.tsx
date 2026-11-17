import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fmtDay, fmtTime, toZoned } from "@/lib/time";
import { LOCATION, STATUS } from "@/lib/labels";
import type { AppointmentStatus, LocationKind } from "@/lib/types";

export const metadata = { title: "Ihr Termin", robots: { index: false } };

type Info = {
  practice: string; practice_phone: string | null; timezone: string; starts_at: string; ends_at: string; status: AppointmentStatus;
  reason: string; location_kind: LocationKind; room: string | null; address: string | null; video_url: string | null; doctor: string;
  patient_first_name: string; confirmed: boolean; can_cancel: boolean; cancel_deadline_hours: number;
};

const RESULT: Record<string, string> = {
  bestaetigt: "Vielen Dank – Ihr Termin ist bestätigt.",
  abgesagt: "Ihr Termin wurde abgesagt. Die Praxis wurde informiert.",
  frist_abgelaufen: "Die Absagefrist ist abgelaufen. Bitte rufen Sie die Praxis an.",
  nicht_moeglich: "Dieser Termin kann nicht mehr geändert werden.",
};

export default async function PatientLink({ params, searchParams }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("appointment_by_token", { p_token: token });
  if (!data) notFound();
  const a = data as Info;

  async function respond(formData: FormData) {
    "use server";
    const sb = await createClient();
    const { data: r } = await sb.rpc("respond_to_appointment", { p_token: token, p_action: String(formData.get("action")) });
    revalidatePath(`/t/${token}`);
    const { redirect } = await import("next/navigation");
    redirect(`/t/${token}?ergebnis=${r}`);
  }

  const result = typeof sp.ergebnis === "string" ? RESULT[sp.ergebnis] : null;
  const open = a.status === "geplant" || a.status === "bestaetigt";
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-800 to-brand-600 p-4">
      <div className="card w-full max-w-md space-y-4 p-6">
        <div>
          <div className="text-sm text-slate-500">{a.practice}</div>
          <h1 className="text-xl font-semibold">Hallo {a.patient_first_name},</h1>
          <p className="text-sm text-slate-600">hier sind die Details zu Ihrem Termin:</p>
        </div>
        {result && <div className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">{result}</div>}
        <dl className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
          <div><dt className="label">Wann</dt><dd className="font-semibold">{fmtDay(toZoned(a.starts_at, a.timezone).date)}, {fmtTime(a.starts_at, a.timezone)} Uhr</dd></div>
          <div><dt className="label">Bei</dt><dd>{a.doctor}</dd></div>
          <div><dt className="label">Anlass</dt><dd>{a.reason}</dd></div>
          <div><dt className="label">Ort</dt><dd>{LOCATION[a.location_kind]}{a.room ? ` · ${a.room}` : ""}{a.address ? ` · ${a.address}` : ""}</dd></div>
          {a.video_url && <div><dt className="label">Video</dt><dd><a href={a.video_url} className="text-brand-700 underline">Zur Videosprechstunde</a></dd></div>}
          <div><dt className="label">Status</dt><dd>{STATUS[a.status].label}{a.confirmed && a.status === "bestaetigt" ? " ✓" : ""}</dd></div>
        </dl>
        {open && (
          <form action={respond} className="flex flex-wrap gap-2">
            {!a.confirmed && <button name="action" value="bestaetigen" className="btn-primary flex-1">Termin bestätigen</button>}
            {a.can_cancel ? (
              <button name="action" value="absagen" className="btn-danger flex-1">Termin absagen</button>
            ) : (
              <p className="text-xs text-slate-500">Eine Online-Absage ist nur bis {a.cancel_deadline_hours} Stunden vor dem Termin möglich{a.practice_phone ? ` – bitte rufen Sie an: ${a.practice_phone}` : ""}.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
